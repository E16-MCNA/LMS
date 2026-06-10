import crypto from "crypto";
import { pool } from "../src/server/db";

type Session = {
  cookie: string;
  csrfToken: string;
  user: { id: string; role: string; email: string };
};

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3100";

const cleanup = {
  webhookEventIds: [] as string[],
  transactionIds: [] as string[],
  tuitionFeeIds: [] as string[],
  semesterIds: [] as string[],
  academicYearIds: [] as string[],
  enrollmentIds: [] as string[],
  quizIds: [] as string[],
  courseIds: [] as string[],
  userIds: [] as string[]
};

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

async function deleteByIds(table: string, column: string, ids: string[]) {
  if (ids.length === 0) return;
  await pool.query(`DELETE FROM ${table} WHERE ${column} = ANY($1::text[])`, [ids]);
}

async function cleanupCreatedData() {
  await deleteByIds("payment_webhook_events", "event_id", cleanup.webhookEventIds);
  await deleteByIds("transactions", "id", cleanup.transactionIds);
  await deleteByIds("notifications", "related_entity_id", cleanup.tuitionFeeIds);
  await deleteByIds("tuition_fees", "id", cleanup.tuitionFeeIds);
  await deleteByIds("semesters", "id", cleanup.semesterIds);
  await deleteByIds("academic_years", "id", cleanup.academicYearIds);
  await deleteByIds("quiz_attempts", "quiz_id", cleanup.quizIds);
  await deleteByIds("questions", "quiz_id", cleanup.quizIds);
  await deleteByIds("quizzes", "id", cleanup.quizIds);
  await deleteByIds("lesson_progress", "enrollment_id", cleanup.enrollmentIds);
  await deleteByIds("enrollments", "id", cleanup.enrollmentIds);
  await deleteByIds("grades", "course_id", cleanup.courseIds);
  await deleteByIds("lessons", "course_id", cleanup.courseIds);
  await deleteByIds("course_sections", "course_id", cleanup.courseIds);
  await deleteByIds("courses", "id", cleanup.courseIds);
  await deleteByIds("notifications", "user_id", cleanup.userIds);
  await deleteByIds("student_profiles", "user_id", cleanup.userIds);
  await deleteByIds("password_reset_tokens", "user_id", cleanup.userIds);
  await deleteByIds("audit_logs", "user_id", cleanup.userIds);
  await deleteByIds("users", "id", cleanup.userIds);
}

async function main() {
  console.log("=== Starting E2E Regression and Hardening Tests ===");
  const timestamp = Date.now();
  const regressionFeeId = `tf_regression_${timestamp}`;
  const regressionSemesterId = `sem_regression_${timestamp}`;
  const regressionAcademicYearId = `ay_regression_${timestamp}`;

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
  cleanup.userIds.push(...(bulkRes.created || []).map((user: any) => user.id).filter(Boolean));
  console.log("✓ Bulk user creation verified");

  // 5. Test Tuition Confirm Transfer
  console.log("Testing Tuition Confirm Transfer...");

  // Create one isolated tuition fee for Ada Lovelace.
  console.log("Creating isolated regression tuition fee...");
  let academicYearId = (await pool.query(
    "SELECT id FROM academic_years ORDER BY is_current DESC, start_date DESC LIMIT 1"
  )).rows[0]?.id;
  if (!academicYearId) {
    await pool.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
       VALUES ($1, 'Regression Academic Year', '2026-01-01', '2026-12-31', false)`,
      [regressionAcademicYearId]
    );
    academicYearId = regressionAcademicYearId;
    cleanup.academicYearIds.push(regressionAcademicYearId);
  }
  await pool.query(
    `INSERT INTO semesters (id, academic_year_id, name, type, start_date, end_date, registration_open, registration_close, is_current)
     VALUES ($1, $2, $3, 'spring', '2026-01-01', '2026-12-31', '2026-01-01', '2026-12-31', false)
     ON CONFLICT (id) DO NOTHING`,
    [regressionSemesterId, academicYearId, "Regression Semester"]
  );
  cleanup.semesterIds.push(regressionSemesterId);
  const insertedFee = await pool.query(
    `INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount)
     VALUES ($1, $2, $3, $4, $5, 'unpaid', 0)
     RETURNING id`,
    [regressionFeeId, "user_student", regressionSemesterId, 25000000, "2026-12-31"]
  );
  const unpaidFeeId = insertedFee.rows[0].id;
  cleanup.tuitionFeeIds.push(unpaidFeeId);

  // Find the dedicated regression tuition fee for Ada Lovelace after setup
  const studentStoreAfterIssue = await request<any>("/api/store", { session: student });
  const studentFees = studentStoreAfterIssue.tuitionFees || [];
  const unpaidFee = studentFees.find((f: any) => f.id === unpaidFeeId && f.status === "unpaid" && f.studentId === "user_student");
  assert(unpaidFee, "No unpaid tuition fee found for Ada Lovelace to test confirm transfer");

  const transferAmount = 50000;
  const transferRes = await request<any>("/api/tuition/confirm-transfer", {
    method: "POST",
    session: student,
    body: JSON.stringify({ feeId: unpaidFee.id, amount: transferAmount })
  });
  assert(transferRes.ok === true && transferRes.transactionId, "Tuition confirm transfer failed");
  const txId = transferRes.transactionId;
  cleanup.transactionIds.push(txId);
  console.log(`✓ Tuition confirm transfer created transaction: ${txId}`);

  // 6. Test Transaction Webhook Callback with Signature Verification
  console.log("Testing Payments Webhook Callback...");
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "dev-only-payment-webhook-secret-do-not-use-in-prod";
  const webhookEventId = `evt_regression_${timestamp}`;
  cleanup.webhookEventIds.push(webhookEventId);
  const webhookPayload = {
    eventId: webhookEventId,
    timestamp: new Date().toISOString(),
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

  const duplicateWebhookFetch = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Signature": signature
    },
    body: serializedPayload
  });
  assert(duplicateWebhookFetch.ok, `Duplicate payment webhook call failed: ${duplicateWebhookFetch.status}`);
  const duplicateWebhookResult = await duplicateWebhookFetch.json();
  assert(duplicateWebhookResult.duplicate === true, "Duplicate webhook did not return idempotent duplicate response");

  const staleWebhookPayload = {
    eventId: `${webhookEventId}_stale`,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    transactionId: txId,
    status: "approved",
    notes: "Stale replay attempt"
  };
  const serializedStalePayload = JSON.stringify(staleWebhookPayload);
  const staleSignature = crypto.createHmac("sha256", webhookSecret).update(serializedStalePayload).digest("hex");
  const staleWebhookFetch = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Signature": staleSignature
    },
    body: serializedStalePayload
  });
  assert(staleWebhookFetch.status === 400, `Stale payment webhook should be rejected, got ${staleWebhookFetch.status}`);
  console.log("✓ Payment webhook idempotency and replay tolerance verified");

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
  cleanup.courseIds.push(course.id);

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
  cleanup.quizIds.push(quiz.id);

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
  cleanup.enrollmentIds.push(enroll.id);

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

  await cleanupCreatedData();

  console.log("=== All E2E Regression and Hardening Tests Passed Successfully! ===");
  await pool.end();
}

main().catch(async error => {
  console.error("❌ E2E Regression Test Failed:", error);
  try {
    await cleanupCreatedData();
    await pool.end();
  } catch {}
  process.exit(1);
});
