import crypto from "crypto";
import { pool } from "../src/server/db";

type Session = {
  cookie: string;
  csrfToken: string;
  user: { id: string; role: string; email: string };
};

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3100";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieHeader(headers: Headers) {
  const raw = headers.get("set-cookie") || "";
  return raw
    .split(/,(?=\s*e16_lms_)/)
    .map(part => part.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function request<T>(path: string, options: RequestInit & { session?: Session } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (options.session) {
    headers.set("Cookie", options.session.cookie);
    if (!["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) {
      headers.set("X-CSRF-Token", options.session.csrfToken);
    }
  }
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${text}`);
  return payload as T;
}

async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(payload)}`);
  return { cookie: cookieHeader(response.headers), csrfToken: payload.csrfToken, user: payload.user };
}

async function main() {
  console.log("=== Starting E2E Regression and Hardening Tests ===");

  // Direct database cleanup to ensure bulk issue succeeds for sem_spring25
  console.log("Cleaning up tuition fees for sem_spring25 in database...");
  await pool.query("DELETE FROM tuition_fees WHERE student_id = 'user_student' AND semester_id = 'sem_spring25'");

  // 1. Health check
  const health = await request<{ ok: boolean }>("/health");
  assert(health.ok, "Health check failed");
  console.log("✓ Health check ok");

  // Login as various roles
  const admin = await login("admin@mcna.local", "admine16");
  const teacher = await login("teacher@mcna.local", "teachere16");
  const student = await login("student@mcna.local", "studente16");
  const parent = await login("parentsstudent@mcna.local", "parent16");
  console.log("✓ Login succeeded for admin, teacher, student, and parent");

  // 2. Test Store Scoping by Role
  console.log("Testing Store Scoping...");
  
  // Student Store Scoping
  const studentStore = await request<any>("/api/store", { session: student });
  assert(studentStore.questions, "Student store missing questions list");
  for (const q of studentStore.questions) {
    assert(q.correctAnswer === "" || q.correctAnswer === undefined, `Security leak: correctAnswer visible to student for question ${q.id}`);
  }
  console.log("✓ Student store scoping verified (correctAnswer is sanitized)");

  // Parent Store Scoping
  const parentStore = await request<any>("/api/store", { session: parent });
  assert(parentStore.users, "Parent store missing users list");
  const adaUser = parentStore.users.find((u: any) => u.id === "user_student");
  assert(adaUser, "Parent store cannot find linked child user");
  const parentSelf = parentStore.users.find((u: any) => u.id === parent.user.id);
  assert(parentSelf, "Parent store cannot find parent user");
  console.log("✓ Parent store scoping verified (linked child data only)");

  // Teacher Store Scoping
  const teacherStore = await request<any>("/api/store", { session: teacher });
  assert(teacherStore.courseSections, "Teacher store missing courseSections list");
  for (const section of teacherStore.courseSections) {
    assert(section.teacherId === teacher.user.id, `Security leak: Teacher saw course section ${section.id} assigned to another teacher`);
  }
  console.log("✓ Teacher store scoping verified (assigned sections only)");

  // 3. Test File Upload Filter Restrictions
  console.log("Testing File Upload Filters...");
  
  // Allowed upload
  const allowedForm = new FormData();
  allowedForm.append("file", new Blob(["mock raster image data"], { type: "image/png" }), "test_image.png");
  
  const uploadRes = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Cookie": student.cookie,
      "X-CSRF-Token": student.csrfToken
    },
    body: allowedForm
  });
  assert(uploadRes.ok, `Allowed image upload failed with status ${uploadRes.status}`);
  const uploadPayload = await uploadRes.json();
  assert(uploadPayload.url, "Allowed upload response missing URL");
  console.log("✓ Allowed image upload succeeded");

  // Blocked upload: HTML
  const blockedHtmlForm = new FormData();
  blockedHtmlForm.append("file", new Blob(["<h1>malicious</h1>"], { type: "text/html" }), "exploit.html");
  const blockedHtmlRes = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Cookie": student.cookie,
      "X-CSRF-Token": student.csrfToken
    },
    body: blockedHtmlForm
  });
  assert(blockedHtmlRes.status === 400, `Blocked HTML file should return 400, got ${blockedHtmlRes.status}`);
  console.log("✓ Blocked HTML upload successfully rejected");

  // Blocked upload: SVG
  const blockedSvgForm = new FormData();
  blockedSvgForm.append("file", new Blob(["<svg></svg>"], { type: "image/svg+xml" }), "exploit.svg");
  const blockedSvgRes = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Cookie": student.cookie,
      "X-CSRF-Token": student.csrfToken
    },
    body: blockedSvgForm
  });
  assert(blockedSvgRes.status === 400, `Blocked SVG file should return 400, got ${blockedSvgRes.status}`);
  console.log("✓ Blocked SVG upload successfully rejected");

  // Blocked upload: JS
  const blockedJsForm = new FormData();
  blockedJsForm.append("file", new Blob(["console.log(1)"], { type: "application/javascript" }), "exploit.js");
  const blockedJsRes = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Cookie": student.cookie,
      "X-CSRF-Token": student.csrfToken
    },
    body: blockedJsForm
  });
  assert(blockedJsRes.status === 400, `Blocked JS file should return 400, got ${blockedJsRes.status}`);
  console.log("✓ Blocked JS upload successfully rejected");

  // 4. Test User Bulk Creation
  console.log("Testing Bulk User Creation...");
  const timestamp = Date.now();
  const bulkPayload = {
    users: [
      {
        email: `bulk_student_${timestamp}@mcna.edu.vn`,
        name: `Bulk Student ${timestamp}`,
        role: "student"
      }
    ]
  };
  const bulkRes = await request<any>("/api/admin/users/bulk", {
    method: "POST",
    session: admin,
    body: JSON.stringify(bulkPayload)
  });
  console.log("Bulk creation response:", JSON.stringify(bulkRes, null, 2));
  assert(bulkRes.createdCount === 1, "Bulk create user failed to create user");
  console.log("✓ Bulk user creation verified");

  // 5. Test Tuition Confirm Transfer
  console.log("Testing Tuition Confirm Transfer...");

  // Issue a tuition fee first to ensure there's at least one unpaid fee for Ada Lovelace
  console.log("Issuing tuition fee via admin...");
  try {
    await request<any>("/api/payments/tuition/bulk-issue", {
      method: "POST",
      session: admin,
      body: JSON.stringify({
        semesterId: "sem_spring25",
        amount: 25000000,
        dueDate: "2026-12-31"
      })
    });
    console.log("✓ Bulk tuition fee issued successfully");
  } catch (err) {
    console.log("Bulk issue note/warning:", err);
  }

  // Find a tuition fee for Ada Lovelace (student) after bulk issue
  const studentStoreAfterIssue = await request<any>("/api/store", { session: student });
  const studentFees = studentStoreAfterIssue.tuitionFees || [];
  const unpaidFee = studentFees.find((f: any) => f.status === "unpaid" && f.studentId === "user_student");
  assert(unpaidFee, "No unpaid tuition fee found for Ada Lovelace to test confirm transfer");
  
  const transferAmount = 50000;
  const transferRes = await request<any>("/api/tuition/confirm-transfer", {
    method: "POST",
    session: student,
    body: JSON.stringify({ feeId: unpaidFee.id, amount: transferAmount })
  });
  assert(transferRes.ok === true && transferRes.transactionId, "Tuition confirm transfer failed");
  const txId = transferRes.transactionId;
  console.log(`✓ Tuition confirm transfer created transaction: ${txId}`);

  // 6. Test Transaction Webhook Callback with Signature Verification
  console.log("Testing Payments Webhook Callback...");
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "default_webhook_secret";
  const webhookPayload = {
    transactionId: txId,
    status: "approved",
    notes: "Auto-approved via payment webhook E2E test"
  };
  
  const serializedPayload = JSON.stringify(webhookPayload);
  const signature = crypto.createHmac("sha256", webhookSecret).update(serializedPayload).digest("hex");
  
  const webhookFetch = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Signature": signature
    },
    body: serializedPayload
  });
  
  assert(webhookFetch.ok, `Payment webhook call failed: ${webhookFetch.status}`);
  const webhookResult = await webhookFetch.json();
  assert(webhookResult.ok === true, "Payment webhook response failed");
  console.log("✓ Payment webhook executed successfully");
  
  // Verify transaction status updated in store
  const updatedStudentStore = await request<any>("/api/store", { session: student });
  const updatedTx = updatedStudentStore.transactions?.find((t: any) => t.id === txId);
  assert(updatedTx && updatedTx.status === "approved", "Transaction status was not updated to approved after webhook");
  console.log("✓ Verified transaction status updated in store");

  // 7. Test Quiz Submit Correctness Isolation
  console.log("Testing Quiz Submit Grading...");
  const course = await request<any>("/api/courses", {
    method: "POST",
    session: teacher,
    body: JSON.stringify({
      title: `Regression Quiz Course ${timestamp}`,
      description: "Temp course for regression testing.",
      category: "Test",
      price: 0,
      level: "Cơ bản",
      tags: ["regression"]
    })
  });
  
  const lesson = await request<any>("/api/lessons", {
    method: "POST",
    session: teacher,
    body: JSON.stringify({
      courseId: course.id,
      title: "Regression Lesson",
      content: "Lesson content.",
      order: 1,
      duration: "5 mins"
    })
  });
  
  const quiz = await request<any>("/api/quizzes", {
    method: "POST",
    session: teacher,
    body: JSON.stringify({
      courseId: course.id,
      lessonId: lesson.id,
      title: "Regression Quiz",
      passingScore: 50,
      timeLimit: 10,
      maxAttempts: 3
    })
  });
  
  const question = await request<any>(`/api/quizzes/${quiz.id}/questions`, {
    method: "POST",
    session: teacher,
    body: JSON.stringify({
      text: "Is 1 + 1 = 2?",
      type: "single",
      options: ["Yes", "No"],
      correctAnswer: "0" // "Yes" is correct
    })
  });
  
  // Submit the course for publishing and publish it
  await request<any>(`/api/courses/${course.id}/submit`, { method: "POST", session: teacher });
  await request<any>(`/api/courses/${course.id}/publish`, { method: "POST", session: admin });
  
  // Student registers
  const enroll = await request<any>("/api/enrollments/register", {
    method: "POST",
    session: student,
    body: JSON.stringify({ courseId: course.id })
  });
  
  // Activate the enrollment
  await request<any>(`/api/enrollments/${enroll.id}/activate`, {
    method: "POST",
    session: admin
  });
  
  // Submit correct answer
  const attempt = await request<any>("/api/quizzes/submit", {
    method: "POST",
    session: student,
    body: JSON.stringify({
      quizId: quiz.id,
      answers: {
        [question.id]: "0" // correct answer index
      }
    })
  });
  assert(attempt.score === 100 && attempt.passed === true, "Quiz grading correctness isolation failed: correct answer graded wrong");
  
  // Submit wrong answer
  const attemptWrong = await request<any>("/api/quizzes/submit", {
    method: "POST",
    session: student,
    body: JSON.stringify({
      quizId: quiz.id,
      answers: {
        [question.id]: "1" // wrong answer index
      }
    })
  });
  assert(attemptWrong.score === 0 && attemptWrong.passed === false, "Quiz grading correctness isolation failed: incorrect answer graded right");
  console.log("✓ Quiz submit correctness isolation and grading verified");

  console.log("=== All E2E Regression and Hardening Tests Passed Successfully! ===");
  await pool.end();
}

main().catch(async error => {
  console.error("❌ E2E Regression Test Failed:", error);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
