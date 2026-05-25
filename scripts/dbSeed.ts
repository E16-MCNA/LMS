import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { getInitialStore } from "../src/store";
import { backfillMegaDemoData } from "../src/mockSeeds";

const require = createRequire(path.join(process.cwd(), "scripts", "dbSeed.ts"));
const sqlite = require("node:sqlite") as any;
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite.DatabaseSync(path.join(dataDir, "lms.sqlite"));
db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", "001_initial_schema.sql"), "utf8"));

const store = getInitialStore();
backfillMegaDemoData(store);
const lessonIds = new Set(store.lessons.map(item => item.id));
const enrollmentIds = new Set(store.enrollments.map(item => item.id));
const quizIds = new Set(store.quizzes.map(item => item.id));
const assignmentIds = new Set(store.assignments.map(item => item.id));

try {
  db.exec("BEGIN");
  const user = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const u of store.users) {
    user.run(u.id, u.email.toLowerCase(), u.passwordHash, u.passwordSalt || null, u.name, u.role, u.isActive ? 1 : 0, u.phone || null, u.linkedStudentId || null, u.createdAt);
  }

  const course = db.prepare(`
    INSERT OR IGNORE INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of store.courses) course.run(c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt);

  const lesson = db.prepare("INSERT OR IGNORE INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const l of store.lessons) lesson.run(l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration);

  const enrollment = db.prepare("INSERT OR IGNORE INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)");
  for (const e of store.enrollments) enrollment.run(e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null);

  const progress = db.prepare("INSERT OR IGNORE INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, ?, ?)");
  for (const p of store.lessonProgress) {
    if (enrollmentIds.has(p.enrollmentId) && lessonIds.has(p.lessonId)) {
      progress.run(p.id, p.enrollmentId, p.lessonId, p.completed ? 1 : 0, p.completedAt || null);
    }
  }

  const quiz = db.prepare("INSERT OR IGNORE INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const q of store.quizzes) quiz.run(q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts);

  const question = db.prepare("INSERT OR IGNORE INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES (?, ?, ?, ?, ?, ?)");
  for (const q of store.questions) question.run(q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer);

  const attempt = db.prepare("INSERT OR IGNORE INTO quiz_attempts (id, quiz_id, student_id, answers_json, score, passed, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const a of store.quizAttempts) {
    if (quizIds.has(a.quizId)) {
      attempt.run(a.id, a.quizId, a.studentId, JSON.stringify(a.answers || {}), a.score, a.passed ? 1 : 0, a.startedAt, a.submittedAt);
    }
  }

  const assignment = db.prepare("INSERT OR IGNORE INTO assignments (id, course_id, title, description, deadline, max_score) VALUES (?, ?, ?, ?, ?, ?)");
  for (const a of store.assignments) assignment.run(a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore);

  const submission = db.prepare("INSERT OR IGNORE INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const s of store.submissions) {
    if (assignmentIds.has(s.assignmentId)) {
      submission.run(s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null);
    }
  }

  const fee = db.prepare("INSERT OR IGNORE INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount, paid_at, receipt_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const f of store.tuitionFees) fee.run(f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null);

  const warning = db.prepare("INSERT OR IGNORE INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  for (const w of store.academicWarnings) warning.run(w.id, w.studentId, w.type, w.message, w.isResolved ? 1 : 0, w.createdAt);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log(`Seeded SQLite database with ${store.users.filter(u => u.role === "student").length} students and ${store.courses.length} courses.`);
