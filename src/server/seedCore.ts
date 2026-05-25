import { getInitialStore } from "../store";
import { Queryable } from "./db";
import { usersRepository } from "./repositories/users";

export async function seedCoreLearningData(db: Queryable) {
  const store = getInitialStore();
  if (Number((await db.query("SELECT COUNT(*) AS count FROM courses")).rows[0].count) === 0) {
    for (const c of store.courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM lessons")).rows[0].count) === 0) {
    for (const l of store.lessons) await db.query("INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM enrollments")).rows[0].count) === 0) {
    for (const e of store.enrollments) await db.query("INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING", [e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null]);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM lesson_progress")).rows[0].count) === 0) {
    for (const p of store.lessonProgress) await db.query("INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [p.id, p.enrollmentId, p.lessonId, p.completed, p.completedAt || null]).catch(() => undefined);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM quizzes")).rows[0].count) === 0) {
    for (const q of store.quizzes) await db.query("INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts]);
    for (const q of store.questions) await db.query("INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING", [q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer]);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM assignments")).rows[0].count) === 0) {
    for (const a of store.assignments) await db.query("INSERT INTO assignments (id, course_id, title, description, deadline, max_score) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING", [a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore]);
    for (const s of store.submissions) await db.query("INSERT INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING", [s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null]);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM tuition_fees")).rows[0].count) === 0) {
    for (const f of store.tuitionFees) await db.query("INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount, paid_at, receipt_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING", [f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null]);
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM academic_warnings")).rows[0].count) === 0) {
    for (const w of store.academicWarnings) await db.query("INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING", [w.id, w.studentId, w.type, w.message, w.isResolved, w.createdAt]);
  }
}

export async function seedAuthUsers(db: Queryable) {
  if (await usersRepository.count(db) > 0) return;
  await usersRepository.seed(db, getInitialStore().users);
}
