import nodemailer from "nodemailer";

// Stub nodemailer methods to fail immediately for testing, bypassing network calls
nodemailer.createTransport = () => {
  return {
    sendMail: async () => {
      throw new Error("SMTP Mock Connection Failure");
    }
  } as any;
};
nodemailer.createTestAccount = async () => {
  throw new Error("Ethereal Mock Connection Failure");
};

import { pool } from "../src/server/db";
import { notificationsRepository } from "../src/server/repositories/notifications";
import { usersRepository } from "../src/server/repositories/users";
import { generateId } from "../src/server/ids";
import fs from "fs";
import path from "path";


async function runNotificationTest() {
  console.log("=== STARTING NOTIFICATION ROUTING TEST ===");

  // 1. Clean the emails.log file for this run
  const logFile = path.join(process.cwd(), "scratch", "emails.log");
  if (fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, "", "utf8");
  }

  // 2. Fetch or create a test student with a school email
  const studentId = "student_routing_test";
  const studentEmail = "student_personal_test@gmail.com";
  const schoolEmail = "routing.test@mcna.edu.vn";

  // Upsert the test student
  await pool.query(
    `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, school_email, email_provisioned, email_provisioned_at, created_at)
     VALUES ($1, $2, 'dummy', 'dummy', 'Học Viên Thử Nghiệm', 'student', true, $3, true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET school_email = EXCLUDED.school_email, email_provisioned = EXCLUDED.email_provisioned`,
    [studentId, studentEmail, schoolEmail]
  );
  console.log(`Configured student with school email: ${schoolEmail}`);

  // 3. Fetch or create a test parent account linked to the student
  const parentId = "parent_routing_test";
  const parentEmail = "parent_test@gmail.com";
  await pool.query(
    `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, linked_student_id, created_at)
     VALUES ($1, $2, 'dummy', 'dummy', 'Phụ Huynh Thử Nghiệm', 'parent', true, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET linked_student_id = EXCLUDED.linked_student_id`,
    [parentId, parentEmail, studentId]
  );
  console.log(`Configured parent with personal email: ${parentEmail}`);

  // 4. Send a notification to the student
  console.log("\n--- Sending notification to Student... ---");
  await notificationsRepository.create(pool, {
    userId: studentId,
    type: "grade",
    message: "Bạn có điểm số mới trong lớp học phần CS101: 95/100 (Loại A)."
  });

  // 5. Send a notification to the parent
  console.log("\n--- Sending notification to Parent... ---");
  await notificationsRepository.create(pool, {
    userId: parentId,
    type: "warning",
    message: "Cảnh báo chuyên cần: Con em của quý vị vắng mặt học phần CS101."
  });

  // 6. Read emails.log to verify routing (Wait a moment for async email dispatch to complete writing)
  console.log("\n--- Waiting for async email dispatch to write to log... ---");
  await new Promise(resolve => setTimeout(resolve, 1500));

  console.log("\n--- Reading emails.log output... ---");
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, "utf8");
    console.log(content);

    const hasSchoolEmailSent = content.toLowerCase().includes(`to: "học viên" <${schoolEmail.toLowerCase()}>`) || content.toLowerCase().includes(schoolEmail.toLowerCase());
    const hasParentEmailSent = content.toLowerCase().includes(`parent_test@gmail.com`) || content.toLowerCase().includes(`your_real_email_to_receive@gmail.com`);

    if (hasSchoolEmailSent && hasParentEmailSent) {
      console.log("SUCCESS: Both student (school email) and parent (personal email) notifications routed correctly!");
    } else {
      console.error(`FAILURE: Verification failed. Student sent: ${hasSchoolEmailSent}, Parent sent: ${hasParentEmailSent}`);
    }
  } else {
    console.error("FAILURE: emails.log file not found.");
  }

  console.log("=== TEST SUITE COMPLETED ===");
  process.exit(0);
}

runNotificationTest().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
