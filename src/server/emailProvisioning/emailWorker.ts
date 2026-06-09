import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { auditRepository } from "../repositories/audit";
import { hasGoogleCredentials } from "./googleWorkspaceClient";

const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SCHOOL_EMAIL_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN || "mcna.edu.vn";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || `noreply@${SCHOOL_EMAIL_DOMAIN}`;
const SMTP_FROM = process.env.SMTP_FROM || `"LMS E16-MCNA" <${SMTP_USER}>`;

let activeTransporter: nodemailer.Transporter | null = null;

/**
 * Check if the SMTP OAuth2 config is available
 */
function hasSmtpOauth2Config(): boolean {
  return hasGoogleCredentials() && !!process.env.SMTP_USER;
}

/**
 * Initialize nodemailer transporter using Service Account OAuth2 flow
 */
function getTransporter(): nodemailer.Transporter {
  if (activeTransporter) return activeTransporter;

  if (hasSmtpOauth2Config()) {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON!);
    console.log(`[EmailWorker] Initializing OAuth2 SMTP transport for user: ${SMTP_USER}`);
    
    activeTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        type: "OAuth2",
        user: SMTP_USER,
        serviceClient: creds.client_id,
        privateKey: creds.private_key.replace(/\\n/g, "\n"),
      },
    } as any);
    return activeTransporter!;
  }

  throw new Error("SMTP OAuth2 credentials are not configured. Falling back to local file logging.");
}

/**
 * Log email mock output locally to scratch/emails.log in the workspace
 */
function logEmailMock(to: string, name: string, subject: string, htmlContent: string) {
  const scratchDir = path.join(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[EMAIL MOCK DISPATCHED]
Timestamp: ${new Date().toISOString()}
To: "${name}" <${to}>
Subject: ${subject}
----------------------------------------
${htmlContent}
========================================
\n`;
  fs.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Mock] Sent to ${to}. Logged in scratch/emails.log`);
}

/**
 * Retry utility with backoff: 5s / 30s / 120s
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delays = [5000, 30000, 120000]
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const delay = delays[attempt - 1] || 5000;
      console.warn(`[EmailWorker] Attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate premium HTML envelope template
 */
function wrapHtmlBody(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #4f46e5;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 24px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .content p.greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .message-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      color: #1e293b;
      margin: 20px 0;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 24px 0 0 0;
    }
    .button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 12px 28px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>LMS E16-MCNA</h1>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} E16 LMS. Mọi quyền được bảo lưu.</p>
        <p>Đây là email thông báo tự động từ hệ thống quản lý học tập E16. Vui lòng không trả lời thư này.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send welcome email containing school email, instructions and tempPassword
 */
export async function sendWelcomeEmail(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    name: string;
    schoolEmail: string;
    tempPassword?: string;
    lmsLoginUrl: string;
  }
): Promise<void> {
  const subject = `[LMS E16] Chào mừng tân sinh viên - Cấp tài khoản Email trường`;

  const htmlContent = wrapHtmlBody(
    "Chào mừng tân sinh viên",
    `
      <p class="greeting">Chào bạn ${params.name},</p>
      <p>Chúc mừng bạn đã gia nhập trường học E16-MCNA! Tài khoản Email chính thức của bạn tại trường đã được tạo thành công:</p>
      <div class="message-box">
        <strong>Email trường:</strong> ${params.schoolEmail}<br/>
        ${params.tempPassword ? `<strong>Mật khẩu tạm thời:</strong> ${params.tempPassword}<br/>` : ""}
        <strong>Liên kết cổng thông tin LMS:</strong> <a href="${params.lmsLoginUrl}">${params.lmsLoginUrl}</a>
      </div>
      <p><strong>Hướng dẫn kích hoạt:</strong></p>
      <ol style="font-size: 14px; line-height: 1.6; padding-left: 20px;">
        <li>Truy cập vào <a href="https://gmail.com" target="_blank">Gmail.com</a> và đăng nhập bằng Email trường ở trên.</li>
        <li>Hệ thống Google sẽ yêu cầu bạn đổi mật khẩu mới trong lần đăng nhập đầu tiên. Hãy chọn mật khẩu bảo mật của riêng bạn.</li>
        <li>Sử dụng Email trường này để nhận mọi thông báo, lịch học, điểm thi và học phí tiếp theo từ LMS.</li>
      </ol>
      <div class="button-container">
        <a href="${params.lmsLoginUrl}" class="button" target="_blank">Đăng nhập LMS</a>
      </div>
    `
  );

  const action = async () => {
    if (hasSmtpOauth2Config()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: SMTP_FROM,
        to: params.to,
        subject,
        html: htmlContent,
        text: `Chào mừng ${params.name},\n\nTài khoản email trường của bạn đã được tạo:\nEmail: ${params.schoolEmail}\nPassword tạm thời: ${params.tempPassword || "Đã cấu hình"}\n\nVui lòng đăng nhập Gmail và cổng thông tin LMS.`,
      });
      console.log(`[EmailWorker] Welcome email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, params.name, subject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "welcome_email_sent", "email", `Gửi email chào mừng tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send welcome email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "welcome_email_failed",
      "email",
      `Lỗi gửi email chào mừng: ${String(err.message || err)}`
    );
    throw err;
  }
}

/**
 * Send generic notification email with prefix subjects
 */
export async function sendLmsNotification(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    type: string;
  }
): Promise<void> {
  const prefixMap: Record<string, string> = {
    grade: "[Điểm]",
    course: "[Khóa học]",
    deadline: "[Hạn chót]",
    tuition: "[Học phí]",
    finance: "[Tài chính]",
    warning: "[Cảnh báo]",
    danger: "[Khẩn cấp]",
    info: "[Thông báo]",
    success: "[Thành công]",
  };

  const prefix = prefixMap[params.type] || "[LMS E16]";
  const finalSubject = `${prefix} ${params.subject}`;

  const htmlContent = wrapHtmlBody(
    params.subject,
    `
      <p class="greeting">Chào học viên,</p>
      <p>Hệ thống LMS thông báo cập nhật mới liên quan đến tài khoản của bạn:</p>
      <div class="message-box">
        ${params.body}
      </div>
      <p>Vui lòng đăng nhập cổng thông tin LMS để biết thêm chi tiết.</p>
    `
  );

  const action = async () => {
    if (hasSmtpOauth2Config()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: SMTP_FROM,
        to: params.to,
        subject: finalSubject,
        html: htmlContent,
        text: params.body,
      });
      console.log(`[EmailWorker] Notification email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, "Học viên", finalSubject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "notification_email_sent", "email", `Gửi thông báo loại [${params.type}] tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send notification email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "notification_email_failed",
      "email",
      `Lỗi gửi thông báo [${params.type}]: ${String(err.message || err)}`
    );
    throw err;
  }
}

/**
 * Send password reset email containing new temporary password
 */
export async function sendPasswordResetEmail(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    name: string;
    temporaryPassword: string;
  }
): Promise<void> {
  const subject = `[LMS E16] Cấp lại mật khẩu tài khoản`;
  const htmlContent = wrapHtmlBody(
    "Cấp lại mật khẩu thành công",
    `
      <p class="greeting">Chào bạn ${params.name},</p>
      <p>Yêu cầu đặt lại mật khẩu cho tài khoản LMS của bạn đã được thực hiện bởi Quản lý giáo vụ. Mật khẩu đăng nhập mới tạm thời của bạn là:</p>
      <div class="message-box" style="font-size: 16px; text-align: center; letter-spacing: 1px;">
        <strong>Mật khẩu tạm thời:</strong> <code style="font-size: 18px; color: #4f46e5; background: #e0e7ff; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${params.temporaryPassword}</code>
      </div>
      <p style="color: #ef4444; font-weight: 600;">Lưu ý bảo mật: Vui lòng đăng nhập cổng thông tin LMS bằng mật khẩu tạm thời trên và đổi ngay mật khẩu mới trong phần cấu hình cá nhân để bảo mật thông tin.</p>
    `
  );

  const action = async () => {
    if (hasSmtpOauth2Config()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: SMTP_FROM,
        to: params.to,
        subject,
        html: htmlContent,
        text: `Chào bạn ${params.name},\n\nMật khẩu tạm thời mới của bạn là: ${params.temporaryPassword}\n\nVui lòng đăng nhập LMS và đổi mật khẩu ngay lập tức.`,
      });
      console.log(`[EmailWorker] Password reset email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, params.name, subject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "password_reset_email_sent", "email", `Gửi email cấp lại mật khẩu tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send password reset email to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "password_reset_email_failed",
      "email",
      `Lỗi gửi email cấp lại mật khẩu: ${String(err.message || err)}`
    );
    throw err;
  }
}

