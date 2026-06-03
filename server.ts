import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, ''));
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getInitialStore } from "./src/store";
import { hashPassword, verifyPassword } from "./src/authHash";
import { LMSDataStore, User } from "./src/types";
import { runMigrations } from "./src/dbMigrations";
import { pool, Queryable } from "./src/server/db";
import { redis, safeRedis } from "./src/server/redis";
import { generateId } from "./src/server/ids";
import { DbUserRow, toPublicUser, tuitionFeeFromRow } from "./src/server/mappers";
import { validateBody, schemas } from "./src/server/validation";
import { seedAuthUsers, seedCoreLearningData } from "./src/server/seedCore";
import { usersRepository } from "./src/server/repositories/users";
import { coursesRepository } from "./src/server/repositories/courses";
import { enrollmentsRepository } from "./src/server/repositories/enrollments";
import { quizzesRepository } from "./src/server/repositories/quizzes";
import { assignmentsRepository } from "./src/server/repositories/assignments";
import { financeRepository } from "./src/server/repositories/finance";
import { academicsRepository } from "./src/server/repositories/academics";
import { auditRepository } from "./src/server/repositories/audit";
import { limitStoreForRole, storeSnapshotFromDb, invalidateStoreCache } from "./src/server/repositories/storeSnapshot";
import { advisorsRepository } from "./src/server/repositories/advisors";
import { parentRepository } from "./src/server/repositories/parent";
import { courseRegistrationsRepository } from "./src/server/repositories/courseRegistrations";
import { gradeAppealsRepository } from "./src/server/repositories/gradeAppeals";
import { leaveRequestsRepository } from "./src/server/repositories/leaveRequests";
import { graduationRepository } from "./src/server/repositories/graduation";
import { scholarshipsRepository } from "./src/server/repositories/scholarships";
import { notificationsRepository } from "./src/server/repositories/notifications";
import { attendanceRepository } from "./src/server/repositories/attendance";
import { eventBus } from "./src/server/eventBus";
import { registerEventHandlers } from "./src/server/eventHandlers";
import { toGradePoint, toLetterGrade } from "./src/server/gpaCalculator";
import { startScheduler } from "./src/server/scheduler";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
  }
  console.warn("JWT_SECRET not set - using insecure dev default. Never deploy this.");
}
const JWT_SECRET_VALUE = JWT_SECRET || "dev-only-e16-lms-secret-do-not-use-in-prod";
const csrfSafeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

app.use(express.json({ limit: "10mb" }));

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.post("/api/upload", requireCsrf, requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});


// Middleware tự động xóa cache khi có bất kỳ yêu cầu thay đổi dữ liệu nào
app.use((req, _res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    invalidateStoreCache();
  }
  next();
});

type AuthRequest = express.Request & { user?: User; linkedStudentId?: string };
type AsyncRoute = (req: AuthRequest, res: express.Response, next: express.NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncRoute) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signToken(user: User): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET_VALUE).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

async function verifyToken(token: string): Promise<{ sub: string } | null> {
  if (await safeRedis(() => redis.exists(`revoked:${token}`), 0) === 1) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET_VALUE).update(`${header}.${payload}`).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

function setAuthCookie(res: express.Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `e16_lms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}`);
}

function setCsrfCookie(res: express.Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `e16_lms_csrf=${token}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}`);
}

function clearAuthCookie(res: express.Response) {
  res.setHeader("Set-Cookie", [
    "e16_lms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    "e16_lms_csrf=; SameSite=Lax; Path=/; Max-Age=0"
  ]);
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const match = (req.header("Cookie") || "").match(/(?:^|;\s*)e16_lms_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractCookie(req: express.Request, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (req.header("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function rateLimitLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:login:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 10;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);

    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireCsrf(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (csrfSafeMethods.has(req.method)) return next();
  if (req.path === "/auth/login" || req.path === "/api/auth/login") return next();
  const cookieToken = extractCookie(req, "e16_lms_csrf");
  const headerToken = req.header("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token." });
  }
  next();
}

async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing session." });
    const payload = await verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired session." });
    const user = await usersRepository.findById(pool, payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: "User is not available." });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(roles: Array<User["role"]>) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permission denied." });
    next();
  };
}

async function resolveLinkedStudent(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const linkedStudentId = await parentRepository.getLinkedStudent(pool, req.user!.id);
    if (!linkedStudentId) return res.status(403).json({ error: "No linked student found for this parent account." });
    req.linkedStudentId = linkedStudentId;
    next();
  } catch (error) {
    next(error);
  }
}

async function audit(req: AuthRequest, action: string, target: string, detail: string) {
  if (!req.user) return;
  await auditRepository.log(pool, req.user.id, action, target, detail);
}

async function maybePostFinalCourseGrade(db: Queryable, studentId: string, courseId: string) {
  const assignments = (await db.query(
    `SELECT a.id, a.max_score, s.score
     FROM assignments a
     LEFT JOIN LATERAL (
       SELECT score
       FROM submissions
       WHERE assignment_id = a.id
         AND student_id = $2
         AND score IS NOT NULL
       ORDER BY graded_at DESC NULLS LAST, submitted_at DESC
       LIMIT 1
     ) s ON true
     WHERE a.course_id = $1`,
    [courseId, studentId]
  )).rows;

  const quizzes = (await db.query(
    `SELECT q.id, qa.score
     FROM quizzes q
     LEFT JOIN LATERAL (
       SELECT score
       FROM quiz_attempts
       WHERE quiz_id = q.id
         AND student_id = $2
       ORDER BY score DESC, submitted_at DESC
       LIMIT 1
     ) qa ON true
     WHERE q.course_id = $1`,
    [courseId, studentId]
  )).rows;

  if (assignments.length === 0 && quizzes.length === 0) return null;

  let assignmentPercent: number | null = null;
  if (assignments.length > 0) {
    if (assignments.some((row: any) => row.score === null || row.score === undefined)) return null;
    assignmentPercent = assignments.reduce((sum: number, row: any) => {
      const maxScore = Math.max(1, Number(row.max_score || 1));
      return sum + (Number(row.score) / maxScore) * 100;
    }, 0) / assignments.length;
  }

  let quizPercent: number | null = null;
  if (quizzes.length > 0) {
    if (quizzes.some((row: any) => row.score === null || row.score === undefined)) return null;
    quizPercent = quizzes.reduce((sum: number, row: any) => sum + Number(row.score || 0), 0) / quizzes.length;
  }

  const rawFinalScore = assignmentPercent !== null && quizPercent !== null
    ? assignmentPercent * 0.3 + quizPercent * 0.7
    : assignmentPercent ?? quizPercent;
  if (rawFinalScore === null || rawFinalScore === undefined) return null;

  const finalScore = Math.round(rawFinalScore * 100) / 100;
  const letterGrade = toLetterGrade(finalScore);
  const gradePoint = toGradePoint(letterGrade);
  const postedAt = new Date().toISOString();
  const updated = (await db.query(
    `WITH target_registration AS (
       SELECT cr.id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = $1
         AND cs.course_id = $2
         AND cr.status NOT IN ('dropped', 'waitlisted', 'withdrawn')
       ORDER BY cr.registered_at DESC
       LIMIT 1
     )
     UPDATE course_registrations cr
     SET grade = $3,
         letter_grade = $4,
         grade_point = $5,
         grade_posted_at = $6
     FROM target_registration target
     WHERE cr.id = target.id
       AND (
         cr.grade IS DISTINCT FROM $3
         OR cr.letter_grade IS DISTINCT FROM $4
         OR cr.grade_point IS DISTINCT FROM $5
         OR cr.grade_posted_at IS NULL
       )
     RETURNING cr.id`,
    [studentId, courseId, finalScore, letterGrade, gradePoint, postedAt]
  )).rows;

  for (const row of updated) {
    await eventBus.emit("grade.saved", { studentId, courseRegistrationId: row.id, grade: letterGrade }, pool);
  }

  return { studentId, courseId, finalScore, letterGrade, gradePoint, registrationIds: updated.map((row: any) => row.id) };
}

async function maybePostFinalCourseGradeForQuiz(db: Queryable, studentId: string, quizId: string) {
  const quiz = (await db.query("SELECT course_id FROM quizzes WHERE id = $1", [quizId])).rows[0];
  if (!quiz) return null;
  return maybePostFinalCourseGrade(db, studentId, quiz.course_id);
}

async function maybePostFinalCourseGradeForSubmission(db: Queryable, submissionId: string) {
  const submission = (await db.query(
    `SELECT s.student_id, a.course_id
     FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.id = $1`,
    [submissionId]
  )).rows[0];
  if (!submission) return null;
  return maybePostFinalCourseGrade(db, submission.student_id, submission.course_id);
}

type SectionScheduleSlot = { dayOfWeek: string; startTime: string; endTime: string; room?: string };
type SectionPayload = {
  id?: string;
  courseId: string;
  semesterId: string;
  teacherId: string;
  sectionCode: string;
  maxStudents: number;
  schedule: SectionScheduleSlot[];
  status: "pending" | "open" | "closed" | "cancelled";
};

async function getCourseSectionColumnSet(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
  const rows = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'course_sections'"
  )).rows;
  return new Set<string>(rows.map((row: any) => row.column_name));
}

async function upsertCourseSection(db: any, section: SectionPayload) {
  const id = section.id || generateId("section");
  const scheduleJson = JSON.stringify(section.schedule || []);
  const columns = await getCourseSectionColumnSet(db);
  const insertColumns = ["id", "course_id", "semester_id", "teacher_id", "section_code", "max_students", "status"];
  const values: any[] = [id, section.courseId, section.semesterId, section.teacherId, section.sectionCode, Number(section.maxStudents), section.status];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = [
    "course_id = EXCLUDED.course_id",
    "semester_id = EXCLUDED.semester_id",
    "teacher_id = EXCLUDED.teacher_id",
    "section_code = EXCLUDED.section_code",
    "max_students = EXCLUDED.max_students",
    "status = EXCLUDED.status"
  ];

  if (columns.has("schedule_json")) {
    insertColumns.push("schedule_json");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}`);
    updates.push("schedule_json = EXCLUDED.schedule_json");
  }
  if (columns.has("schedule")) {
    insertColumns.push("schedule");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}::jsonb`);
    updates.push("schedule = EXCLUDED.schedule");
  }

  const row = (await db.query(
    `INSERT INTO course_sections (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}
     RETURNING *`,
    values
  )).rows[0];

  return {
    id: row.id,
    courseId: row.course_id,
    semesterId: row.semester_id,
    teacherId: row.teacher_id,
    sectionCode: row.section_code,
    maxStudents: Number(row.max_students),
    schedule: row.schedule_json ? JSON.parse(row.schedule_json || "[]") : (typeof row.schedule === "string" ? JSON.parse(row.schedule || "[]") : row.schedule || []),
    status: row.status
  };
}

let isSyncing = false;
const syncQueue: (() => void)[] = [];

async function syncClientStoreToDb(store: Partial<LMSDataStore>) {
  // Serialize syncs to prevent PostgreSQL deadlocks on concurrent saves
  await new Promise<void>((resolve) => {
    if (!isSyncing) {
      isSyncing = true;
      resolve();
    } else {
      syncQueue.push(resolve);
    }
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Legacy snapshots are not trusted for identities or student records.
      // users and student_profiles are written only through scoped API routes.

    // Fetch existing courses to skip identical updates
    const dbCoursesRes = await client.query("SELECT id, status, rejection_reason FROM courses");
    const dbCoursesMap = new Map<string, any>(dbCoursesRes.rows.map(r => [r.id, r]));

    for (const course of store.courses || []) {
      const dbCourse = dbCoursesMap.get(course.id);
      const isDirty = !dbCourse ||
        dbCourse.status !== course.status ||
        dbCourse.rejection_reason !== (course.rejectionReason || null);

      if (isDirty) {
        await client.query(
          `UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3`,
          [course.status, course.rejectionReason || null, course.id]
        );
      }
    }

    // Sync structural tables (academic_years, semesters, departments, programs, program_courses)
    // Upsert-only: never DELETE rows missing from client snapshot (prevents mass data loss).
    if (store.academicYears !== undefined) {
      const clientYears = store.academicYears || [];
      for (const year of clientYears) {
        await client.query(
          `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             is_current = EXCLUDED.is_current`,
          [year.id, year.name, year.startDate, year.endDate, Boolean(year.isCurrent)]
        );
      }
    }

    if (store.semesters !== undefined) {
      const clientSemesters = store.semesters || [];
      for (const sem of clientSemesters) {
        await client.query(
          `INSERT INTO semesters (id, academic_year_id, name, type, start_date, end_date, registration_open, registration_close)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             academic_year_id = EXCLUDED.academic_year_id,
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             registration_open = EXCLUDED.registration_open,
             registration_close = EXCLUDED.registration_close`,
          [
            sem.id,
            sem.academicYearId || null,
            sem.name,
            sem.type || null,
            sem.startDate || null,
            sem.endDate || null,
            sem.registrationOpen || null,
            sem.registrationClose || null
          ]
        );
      }
    }

    if (store.departments !== undefined) {
      const clientDepts = store.departments || [];
      for (const dept of clientDepts) {
        await client.query(
          `INSERT INTO departments (id, name, code, head_teacher_id, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             code = EXCLUDED.code,
             head_teacher_id = EXCLUDED.head_teacher_id,
             description = EXCLUDED.description`,
          [
            dept.id,
            dept.name,
            dept.code,
            dept.headTeacherId || null,
            dept.description || null
          ]
        );
      }
    }

    if (store.programs !== undefined) {
      const clientProgs = store.programs || [];
      for (const prog of clientProgs) {
        await client.query(
          `INSERT INTO programs (id, department_id, name, code, type, total_credits, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             department_id = EXCLUDED.department_id,
             name = EXCLUDED.name,
             code = EXCLUDED.code,
             type = EXCLUDED.type,
             total_credits = EXCLUDED.total_credits,
             description = EXCLUDED.description`,
          [
            prog.id,
            prog.departmentId,
            prog.name,
            prog.code,
            prog.type || "degree",
            Number(prog.totalCredits) || 0,
            prog.description || null
          ]
        );
      }
    }

    if (store.programCourses !== undefined) {
      const clientProgCourses = store.programCourses || [];
      for (const pc of clientProgCourses) {
        await client.query(
          `INSERT INTO program_courses (id, program_id, course_id, credits, is_required, semester)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             program_id = EXCLUDED.program_id,
             course_id = EXCLUDED.course_id,
             credits = EXCLUDED.credits,
             is_required = EXCLUDED.is_required,
             semester = EXCLUDED.semester`,
          [
            pc.id,
            pc.programId,
            pc.courseId,
            Number(pc.credits) || 0,
            Boolean(pc.isRequired),
            Number(pc.semester) || 1
          ]
        );
      }
    }

    // Sync notifications (upsert-only)
    if (store.notifications !== undefined) {
      const clientNotes = store.notifications || [];
      for (const note of clientNotes) {
        await client.query(
          `INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             type = EXCLUDED.type,
             message = EXCLUDED.message,
             is_read = EXCLUDED.is_read,
             created_at = EXCLUDED.created_at`,
          [note.id, note.userId, note.type, note.message, Boolean(note.isRead), note.createdAt]
        );
      }
    }

    // Sync academic_warnings bypassed (server-managed only)
    // Sync audit_logs bypassed (server-managed only — never accept client audit trail)

    // Sync enrollments bypassed (server-managed only)

    // Sync transactions bypassed (server-managed only)

    // Sync tuitionFees bypassed (server-managed only)

    // Sync advisorNotes (upsert-only)
    if (store.advisorNotes !== undefined) {
      const clientNotesAdvisor = store.advisorNotes || [];
      for (const n of clientNotesAdvisor) {
        await client.query(
          `INSERT INTO advisor_notes (id, advisor_id, student_id, content, type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             advisor_id = EXCLUDED.advisor_id,
             student_id = EXCLUDED.student_id,
             content = EXCLUDED.content,
             type = EXCLUDED.type,
             created_at = EXCLUDED.created_at`,
          [
            n.id,
            n.advisorId || null,
            n.studentId,
            n.content,
            n.type,
            n.createdAt
          ]
        );
      }
    }

    // Sync quizzes (upsert-only)
    if (store.quizzes !== undefined) {
      const clientQuizzes = store.quizzes || [];
      for (const q of clientQuizzes) {
        await client.query(
          `INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, attachment_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             course_id = EXCLUDED.course_id,
             lesson_id = EXCLUDED.lesson_id,
             title = EXCLUDED.title,
             passing_score = EXCLUDED.passing_score,
             time_limit = EXCLUDED.time_limit,
             max_attempts = EXCLUDED.max_attempts,
             attachment_url = EXCLUDED.attachment_url`,
          [
            q.id,
            q.courseId,
            q.lessonId || null,
            q.title,
            Number(q.passingScore) || 70,
            Number(q.timeLimit) || 15,
            Number(q.maxAttempts) || 3,
            q.attachmentUrl || null
          ]
        );
      }
    }

    // Sync questions (upsert-only)
    if (store.questions !== undefined) {
      const clientQuestions = store.questions || [];
      for (const qst of clientQuestions) {
        await client.query(
          `INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             quiz_id = EXCLUDED.quiz_id,
             text = EXCLUDED.text,
             type = EXCLUDED.type,
             options_json = EXCLUDED.options_json,
             correct_answer = EXCLUDED.correct_answer,
             created_at = COALESCE(questions.created_at, EXCLUDED.created_at)`,
          [
            qst.id,
            qst.quizId,
            qst.text,
            qst.type,
            JSON.stringify(qst.options || []),
            qst.correctAnswer,
            qst.createdAt || new Date().toISOString()
          ]
        );
      }
    }

    // Sync submissions bypassed (server-managed only)

    // Sync courseSections (upsert-only)
    if (store.courseSections !== undefined) {
      const clientSections = store.courseSections || [];
      for (const sec of clientSections) {
        await upsertCourseSection(client, {
          id: sec.id,
          courseId: sec.courseId,
          semesterId: sec.semesterId,
          teacherId: sec.teacherId,
          sectionCode: sec.sectionCode,
          maxStudents: Number(sec.maxStudents) || 30,
          schedule: sec.schedule || [],
          status: sec.status || "open"
        });
      }
    }

    // Sync courseRegistrations bypassed (server-managed only)

    await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (syncQueue.length > 0) {
      const next = syncQueue.shift();
      next!();
    } else {
      isSyncing = false;
    }
  }
}

function dashboardFromStore(store: any, user: User) {
  const scoped = limitStoreForRole(store, user);
  if (user.role === "manager" || user.role === "admin" || user.role === "super_admin") {
    return {
      ...scoped,
      dashboard: {
        users: scoped.users.length,
        courses: scoped.courses.length,
        pendingCourses: scoped.courses.filter((course: any) => course.status === "pending").length,
        activeEnrollments: scoped.enrollments.filter((item: any) => item.status === "active").length
      }
    };
  }
  if (user.role === "teacher") {
    return {
      ...scoped,
      dashboard: {
        courses: scoped.courses.length,
        enrollments: scoped.enrollments.length,
        submissionsToGrade: scoped.submissions.filter((item: any) => item.score === undefined).length
      }
    };
  }
  if (user.role === "student") {
    return {
      ...scoped,
      dashboard: {
        enrolledCourses: scoped.enrollments.length,
        completedLessons: scoped.lessonProgress.filter((item: any) => item.completed).length,
        unpaidFees: scoped.tuitionFees.filter((fee: any) => fee.status !== "paid").length
      }
    };
  }
  return scoped;
}

async function initializeDatabase() {
  await runMigrations(pool);
  await usersRepository.normalizeLegacyRoles(pool);
  await seedAuthUsers(pool);
  await seedCoreLearningData(pool);
  await usersRepository.normalizeSystemUsers(pool);
  registerEventHandlers();
  startScheduler();
}

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } }) : null;

// Force-logout: clears session cookie without requiring auth or CSRF.
// Must be registered BEFORE requireCsrf middleware so unauthenticated tabs
// (new tab, incognito, different user) can clear a stale session cookie.
app.post("/api/auth/force-logout", asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
    const payload = await verifyToken(token);
    if (payload) await auditRepository.log(pool, payload.sub, "authentication_force_logout", "security", "Session forcibly cleared from login screen.");
  }
  clearAuthCookie(res);
  res.status(204).send();
}));

app.use("/api", requireCsrf);

app.post("/api/analyze", asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code content is required." });
  if (!ai) return res.status(503).json({ error: "Gemini API Key is not configured in the workspace secrets. Please configure GEMINI_API_KEY in Settings." });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Analyze this web/backend application entrypoint file, specifically looking at its structure, routing, models (if applicable), and configuration, and generate a structured JSON feedback. Here is the code:\n\n${code}`,
    config: {
      systemInstruction: "You are an expert full-stack engineer specialized in web frameworks, microservices, and porting applications across Python (Flask) and Node.js/Express.js.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          configs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, defaultValue: { type: Type.STRING }, envVar: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["name", "defaultValue", "envVar", "description"] } },
          nodePort: { type: Type.STRING },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["explanation", "configs", "nodePort", "tips"]
      }
    }
  });
  res.json(JSON.parse(response.text?.trim() ?? "{}"));
}));

app.get("/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, database: "ok", uptime: process.uptime() });
}));

app.post("/api/auth/login", rateLimitLogin, validateBody(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const row = await usersRepository.findAuthByEmail(pool, email) as DbUserRow | null;
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt || undefined)) return res.status(401).json({ error: "Incorrect email or password." });
  if (!row.is_active) return res.status(403).json({ error: "Account inactive." });

  // Single Browser Session Check: reject login if another session is already active in cookies
  const existingToken = extractBearerToken(req);
  if (existingToken) {
    try {
      const payload = await verifyToken(existingToken);
      if (payload && payload.sub !== row.id) {
        return res.status(400).json({
          error: "Bạn đang đăng nhập bằng một tài khoản khác. Vui lòng đăng xuất trước khi đăng nhập tài khoản mới.",
          code: "SESSION_CONFLICT"
        });
      }
    } catch (e) {
      // Ignore token verification errors
    }
  }

  const user = toPublicUser(row);
  setAuthCookie(res, signToken(user));
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  setCsrfCookie(res, csrfToken);
  await auditRepository.log(pool, user.id, "authentication_login", "security", `Authenticated role ${user.role}.`);
  res.json({ user, csrfToken });
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
  await audit(req, "authentication_logout", "security", "Session closed.");
  clearAuthCookie(res);
  res.status(204).send();
}));
app.get("/api/auth/me", requireAuth, (req: AuthRequest, res) => res.json({ user: req.user }));

app.post("/api/users/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Vui lòng nhập đầy đủ mật khẩu cũ và mới." });

  const row = await usersRepository.findAuthByEmail(pool, req.user!.email) as DbUserRow | null;
  if (!row || !verifyPassword(currentPassword, row.password_hash, row.password_salt || undefined)) {
    return res.status(401).json({ error: "Mật khẩu hiện tại không chính xác." });
  }

  const credential = hashPassword(newPassword);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [credential.hash, credential.salt, req.user!.id]
  );

  await audit(req, "change_password", req.user!.id, "User updated their account password.");
  res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
}));

app.patch("/api/student/profile", requireAuth, requireRole(["student"]), validateBody(schemas.updateProfile), asyncHandler(async (req, res) => {
  const { phone, dateOfBirth, gender, address, guardianName, guardianPhone } = req.body;
  const exists = (await pool.query("SELECT id FROM student_profiles WHERE user_id = $1", [req.user!.id])).rowCount;

  if (!exists) {
    const profileId = generateId("profile");
    const studentCode = `SV${new Date().getFullYear()}${req.user!.id.slice(-4).toUpperCase()}`;
    await pool.query(
      `INSERT INTO student_profiles (
         id, user_id, student_code, program_id, department_id, academic_year, enrollment_date,
         expected_graduation, status, gpa, total_credits_earned, phone, date_of_birth, gender,
         address, guardian_name, guardian_phone
       ) VALUES ($1, $2, $3, 'prog_se', 'dept_cs', 1, $4, $5, 'active', 0.0, 0, $6, $7, $8, $9, $10, $11)`,
      [
        profileId, req.user!.id, studentCode,
        new Date().toISOString().slice(0, 10),
        new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toISOString().slice(0, 10),
        phone || null, dateOfBirth || null, gender || null, address || null, guardianName || null, guardianPhone || null
      ]
    );
  } else {
    await pool.query(
      `UPDATE student_profiles
       SET phone = $1,
           date_of_birth = $2,
           gender = $3,
           address = $4,
           guardian_name = $5,
           guardian_phone = $6
       WHERE user_id = $7`,
      [phone || null, dateOfBirth || null, gender || null, address || null, guardianName || null, guardianPhone || null, req.user!.id]
    );
  }

  if (phone) {
    await pool.query("UPDATE users SET phone = $1 WHERE id = $2", [phone, req.user!.id]);
  }

  await audit(req, "update_profile", req.user!.id, "Student updated their personal profile.");
  res.json({ ok: true, message: "Cập nhật hồ sơ lý lịch thành công!" });
}));

app.get("/api/store", requireAuth, asyncHandler(async (req, res) => res.json(limitStoreForRole(await storeSnapshotFromDb(pool), req.user!))));

app.get("/api/dashboard/admin", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const store = await storeSnapshotFromDb(pool);
  res.json({ ...dashboardFromStore(store, req.user!), auditLogs: await auditRepository.listRecent(pool, 100) });
}));
app.get("/api/dashboard/teacher", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/student", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/finance", requireAuth, requireRole(["finance", "admin", "super_admin"]), asyncHandler(async (_req, res) => res.json(await financeRepository.getDashboard(pool))));
app.get("/api/dashboard/academic", requireAuth, requireRole(["admin", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json({ ...dashboardFromStore(await storeSnapshotFromDb(pool), req.user!), warnings: await academicsRepository.listWarnings(pool) })));
app.get("/api/dashboard/advisor", requireAuth, requireRole(["advisor"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getDashboard(pool, req.user!.id))));
app.get("/api/dashboard/parent", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getDashboard(pool, req.linkedStudentId!))));

app.get("/api/courses", requireAuth, asyncHandler(async (_req, res) => res.json(await coursesRepository.list(pool))));
app.post("/api/courses", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
  const body = req.body;
  const course = await coursesRepository.create(pool, {
    title: body.title,
    description: body.description,
    teacherId: req.user!.role === "teacher" ? req.user!.id : body.teacherId || req.user!.id,
    status: "draft",
    category: body.category,
    thumbnail: body.thumbnail,
    price: body.price,
    level: body.level,
    tags: body.tags
  });
  await audit(req, "create_course", course.id, course.title);
  res.status(201).json(course);
}));
app.post("/api/courses/:id/submit", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.params.id)) return res.status(403).json({ error: "Permission denied." });
  const course = await coursesRepository.setStatus(pool, req.params.id, "pending");
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "submit_course_approval", course.id, course.title);
  res.json(course);
}));
app.post("/api/courses/:id/publish", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "published");
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "approve_course", course.id, course.title);
  res.json(course);
}));
app.post("/api/courses/:id/reject", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.rejectCourse), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "rejected", req.body.rejectionReason);
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "reject_course", course.id, req.body.rejectionReason);
  res.json(course);
}));

app.delete("/api/courses/:id", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  // Kiểm tra sĩ số sinh viên hoạt động
  const enrollmentsCountRes = await pool.query("SELECT COUNT(*) AS count FROM enrollments WHERE course_id = $1 AND status = 'active'", [courseId]);
  const enrollmentsCount = Number(enrollmentsCountRes.rows[0].count);
  if (enrollmentsCount > 0) {
    return res.status(400).json({ error: "Không thể xóa khóa học đang có sinh viên tham gia học tập thực tế." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Xóa phản hồi diễn đàn liên quan
    await client.query(
      `DELETE FROM forum_replies 
       WHERE post_id IN (SELECT id FROM forum_posts WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa bài viết diễn đàn liên quan
    await client.query("DELETE FROM forum_posts WHERE course_id = $1", [courseId]);

    // Xóa tiến độ bài học liên quan
    await client.query(
      `DELETE FROM lesson_progress 
       WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài học liên quan
    await client.query("DELETE FROM lessons WHERE course_id = $1", [courseId]);

    // Xóa các lượt thử làm bài quiz liên quan
    await client.query(
      `DELETE FROM quiz_attempts 
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các câu hỏi trắc nghiệm liên quan
    await client.query(
      `DELETE FROM questions 
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài thi trắc nghiệm liên quan
    await client.query("DELETE FROM quizzes WHERE course_id = $1", [courseId]);

    // Xóa bài nộp tự luận liên quan
    await client.query(
      `DELETE FROM submissions 
       WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài tập tự luận liên quan
    await client.query("DELETE FROM assignments WHERE course_id = $1", [courseId]);

    // Xóa giao dịch liên quan
    await client.query("DELETE FROM transactions WHERE course_id = $1", [courseId]);

    // Xóa chứng chỉ học phần liên quan
    await client.query("DELETE FROM certificates WHERE course_id = $1", [courseId]);

    // Xóa các lớp học phần/buổi học cụ thể liên quan
    await client.query("DELETE FROM course_sections WHERE course_id = $1", [courseId]);

    // Xóa đăng ký học phần/enrollments
    await client.query("DELETE FROM enrollments WHERE course_id = $1", [courseId]);

    // Xóa liên kết chương trình học/khung ngành
    await client.query("DELETE FROM program_courses WHERE course_id = $1", [courseId]);

    // Cuối cùng xóa khóa học
    await client.query("DELETE FROM courses WHERE id = $1", [courseId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await audit(req, "delete_course", courseId, "Successfully performed cascading delete on course and related assets.");
  res.json({ ok: true });
}));

app.post("/api/lessons", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addLesson), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  const lesson = await coursesRepository.addLesson(pool, req.body);
  await audit(req, "add_lesson", lesson.id, lesson.title);
  res.status(201).json(lesson);
}));

app.get("/api/enrollments", requireAuth, asyncHandler(async (req, res) => res.json(await enrollmentsRepository.listForUser(pool, req.user!))));
app.post("/api/enrollments/register", requireAuth, requireRole(["student"]), validateBody(schemas.registerEnrollment), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course || course.status !== "published") return res.status(404).json({ error: "Published course not found." });
  if (await enrollmentsRepository.existsForCourse(pool, req.user!.id, course.id)) return res.status(409).json({ error: "Enrollment already exists." });
  const isPaid = Number(course.price || 0) > 0;
  const enrollment = await enrollmentsRepository.register(pool, req.user!.id, course.id, isPaid);
  if (isPaid) {
    const txId = generateId("tx");
    await pool.query(
      `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at)
       VALUES ($1, $2, $3, $4, 'pending', 'Chuyển khoản Ngân hàng (QR)', $5)`,
      [txId, req.user!.id, course.id, Number(course.price), new Date().toISOString()]
    );
  }
  await audit(req, "enroll_course", course.id, course.title);
  res.status(201).json(enrollment);
}));
app.post("/api/enrollments/:id/activate", requireAuth, requireRole(["admin", "super_admin", "finance"]), asyncHandler(async (req, res) => {
  const enrollment = await enrollmentsRepository.activateEnrollment(pool, req.params.id);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  await audit(req, "activate_enrollment", enrollment.id, `Activated enrollment for student ID: ${enrollment.studentId}`);
  res.json(enrollment);
}));
app.post("/api/progress/toggle", requireAuth, requireRole(["student"]), validateBody(schemas.toggleProgress), asyncHandler(async (req, res) => {
  const enrollment = await enrollmentsRepository.findStudentEnrollment(pool, req.user!.id, req.body.enrollmentId);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  const result = await enrollmentsRepository.toggleProgress(pool, req.body.enrollmentId, req.body.lessonId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "toggle_lesson_progress", req.body.lessonId, `completed=${result.row.completed}`);
  res.json(result.row);
}));

app.post("/api/quizzes", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createQuiz), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  const quiz = await quizzesRepository.create(pool, req.body);
  await audit(req, "create_quiz", quiz.id, quiz.title);
  res.status(201).json(quiz);
}));
app.post("/api/quizzes/:id/questions", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const question = await quizzesRepository.addQuestion(pool, { ...req.body, quizId: req.params.id });
  await audit(req, "add_quiz_question", question.id, quiz.id);
  res.status(201).json(question);
}));

app.put("/api/questions/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const updated = await quizzesRepository.updateQuestion(pool, req.params.id, req.body);
  await audit(req, "update_quiz_question", req.params.id, quiz.id);
  res.json(updated);
}));

app.delete("/api/questions/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  await quizzesRepository.deleteQuestion(pool, req.params.id);
  await audit(req, "delete_quiz_question", req.params.id, quiz.id);
  res.status(204).end();
}));

app.post("/api/quizzes/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitQuiz), asyncHandler(async (req, res) => {
  const result = await quizzesRepository.submitAttempt(pool, req.body.quizId, req.user!.id, req.body.answers, req.body.startedAt);
  if (!result) return res.status(404).json({ error: "Quiz not found." });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await maybePostFinalCourseGradeForQuiz(pool, req.user!.id, req.body.quizId);
  await audit(req, "submit_quiz_attempt", result.row.quizId, `Score ${result.row.score}.`);
  res.status(201).json(result.row);
}));

app.post("/api/assignments", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createAssignment), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  const assignment = await assignmentsRepository.create(pool, req.body);
  await audit(req, "create_assignment", assignment.id, assignment.title);
  res.status(201).json(assignment);
}));
app.post("/api/assignments/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitAssignment), asyncHandler(async (req, res) => {
  const result = await assignmentsRepository.submit(pool, req.user!.id, req.body.assignmentId, req.body.content, req.body.attachmentUrl);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "submit_assignment", result.row.id, result.row.assignmentId);
  res.status(201).json(result.row);
}));

app.post("/api/assignments/grade", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.gradeAssignment), asyncHandler(async (req, res) => {
  const submission = await assignmentsRepository.findSubmissionForGrading(pool, req.body.submissionId);
  if (!submission) return res.status(404).json({ error: "Submission not found." });
  if (req.user!.role === "teacher" && submission.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  if (req.body.score > Number(submission.max_score)) return res.status(400).json({ error: "Invalid score." });
  const result = await assignmentsRepository.grade(pool, req.body.submissionId, req.body.score, req.body.feedback);
  await maybePostFinalCourseGradeForSubmission(pool, req.body.submissionId);
  await audit(req, "grade_assignment", req.body.submissionId, `Score ${req.body.score}.`);
  res.json(result);
}));

app.post("/api/admin/users", requireAuth, requireRole(["manager", "super_admin", "sale", "admin"]), validateBody(schemas.createUser), asyncHandler(async (req, res) => {
  if ((req.user!.role === "sale" || req.user!.role === "admin") && req.body.role !== "student") {
    return res.status(403).json({ error: "Chỉ có quyền đăng ký học viên (student)." });
  }
  const credential = hashPassword(req.body.password);
  const user: User = {
    id: generateId("user"),
    email: req.body.email,
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    name: req.body.name,
    role: req.body.role,
    isActive: true,
    phone: req.body.phone,
    linkedStudentId: req.body.linkedStudentId,
    createdAt: new Date().toISOString()
  };
  const created = await usersRepository.create(pool, user);
  if (created.role === "student") {
    // Auto-create default student profile
    await pool.query(
      "INSERT INTO student_profiles (id, user_id, student_code, program_id, department_id, academic_year, enrollment_date, expected_graduation, status, gpa, total_credits_earned) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        "profile_" + created.id,
        created.id,
        "SV2025" + created.id.slice(-4).toUpperCase(),
        req.body.programId || "prog_se",
        req.body.departmentId || "dept_cs",
        1,
        new Date().toISOString().slice(0, 10),
        "2029-06-30",
        "active",
        0.0,
        0
      ]
    );
  }
  await audit(req, "create_user", created.id, created.email);
  res.status(201).json(created);
}));

app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole(["manager", "super_admin", "sale", "admin"]), asyncHandler(async (req, res) => {
  const user = await usersRepository.findById(pool, req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if ((req.user!.role === "sale" || req.user!.role === "admin") && user.role !== "student") {
    return res.status(403).json({ error: "Chỉ có quyền reset mật khẩu học viên." });
  }
  const defaultNewPass = "studente16";
  const credential = hashPassword(defaultNewPass);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [credential.hash, credential.salt, req.params.id]
  );
  await audit(req, "reception_reset_password", req.params.id, `Reset password for student: ${user.email}`);
  res.json({ ok: true, message: `Mật khẩu đã được đặt lại thành công về mặc định: ${defaultNewPass}` });
}));
app.patch("/api/admin/users/:id/status", requireAuth, requireRole(["manager", "super_admin"]), validateBody(schemas.setUserActive), asyncHandler(async (req, res) => {
  const user = await usersRepository.setActive(pool, req.params.id, req.body.isActive);
  if (!user) return res.status(404).json({ error: "User not found." });
  await audit(req, "toggle_user_status", user.id, `isActive=${user.isActive}`);
  res.json(user);
}));

app.get("/api/academics/warnings", requireAuth, asyncHandler(async (req, res) => {
  const requestedStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const result = await academicsRepository.listWarningsForUser(pool, req.user!, requestedStudentId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.json(result.warnings);
}));
app.post("/api/academics/warnings", requireAuth, requireRole(["manager", "admin", "advisor", "super_admin"]), validateBody(schemas.createWarning), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.createWarning(pool, req.body);
  await audit(req, "create_academic_warning", warning.studentId, warning.message);
  res.status(201).json(warning);
}));
app.post("/api/academics/warnings/:id/resolve", requireAuth, requireRole(["manager", "admin", "advisor", "super_admin"]), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.resolveWarning(pool, req.params.id);
  if (!warning) return res.status(404).json({ error: "Warning not found." });
  await audit(req, "resolve_academic_warning", warning.id, warning.studentId);
  res.json(warning);
}));
app.get("/api/advisor/students", requireAuth, requireRole(["advisor"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getAssignments(pool, req.user!.id))));
app.get("/api/advisor/at-risk", requireAuth, requireRole(["advisor"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getAtRiskStudents(pool, req.user!.id))));
app.get("/api/advisor/notes/:studentId", requireAuth, requireRole(["advisor", "admin", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getNotes(pool, req.params.studentId))));
app.post("/api/advisor/notes", requireAuth, requireRole(["advisor"]), validateBody(schemas.advisorNote), asyncHandler(async (req, res) => {
  const note = await advisorsRepository.createNote(pool, { advisorId: req.user!.id, ...req.body });
  await audit(req, "add_advisor_note", note.student_id, note.type);
  res.status(201).json(note);
}));

app.patch("/api/advisor/student-profile/:studentId", requireAuth, requireRole(["advisor", "admin", "admin", "super_admin"]), validateBody(schemas.updateStudentNotes), asyncHandler(async (req, res) => {
  const { notes } = req.body;
  await pool.query(
    "UPDATE student_profiles SET notes = $1 WHERE user_id = $2",
    [notes, req.params.studentId]
  );
  await audit(req, "update_student_notes", req.params.studentId, "Advisor updated student academic plan/notes.");
  res.json({ ok: true, message: "Cập nhật đề xuất lộ trình thành công!" });
}));
app.post("/api/advisor/assignments", requireAuth, requireRole(["admin", "admin", "super_admin"]), validateBody(schemas.advisorAssignment), asyncHandler(async (req, res) => {
  const assignment = await advisorsRepository.assignStudent(pool, req.body.advisorId, req.body.studentId, req.body.semesterId);
  res.status(assignment ? 201 : 409).json(assignment || { error: "Advisor assignment already exists." });
}));
app.delete("/api/advisor/assignments/:id", requireAuth, requireRole(["admin", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const assignment = await advisorsRepository.unassignStudent(pool, req.params.id);
  if (!assignment) return res.status(404).json({ error: "Advisor assignment not found." });
  res.json(assignment);
}));

app.get("/api/parent/grades", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getGrades(pool, req.linkedStudentId!))));
app.get("/api/parent/attendance", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getAttendance(pool, req.linkedStudentId!))));
app.get("/api/parent/tuition", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getTuition(pool, req.linkedStudentId!))));
app.get("/api/parent/warnings", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getWarnings(pool, req.linkedStudentId!))));
app.get("/api/parent/notifications", requireAuth, requireRole(["parent"]), asyncHandler(async (req, res) => res.json(await parentRepository.getNotifications(pool, req.user!.id))));

app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => res.json(await notificationsRepository.listForUser(pool, req.user!.id, req.query.unreadOnly === "true"))));
// IMPORTANT: /read-all must be registered BEFORE /:id/read to avoid Express matching "read-all" as an id param
app.patch("/api/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markAllRead(pool, req.user!.id);
  res.status(204).send();
}));
app.patch("/api/notifications/:id/read", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markRead(pool, req.params.id, req.user!.id);
  res.status(204).send();
}));

app.post("/api/course-sections", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const payload: SectionPayload = {
    ...req.body,
    teacherId: req.user!.role === "teacher" ? req.user!.id : req.body.teacherId
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  if (req.user!.role === "teacher" && course.teacherId !== req.user!.id) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const row = await upsertCourseSection(pool, payload);
  await audit(req, "create_course_section", row.id, row.sectionCode);
  res.status(201).json(row);
}));

app.put("/api/course-sections/:id", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const payload: SectionPayload = {
    ...req.body,
    id: req.params.id,
    teacherId: req.user!.role === "teacher" ? req.user!.id : req.body.teacherId
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  if (req.user!.role === "teacher" && (existing.teacher_id !== req.user!.id || course.teacherId !== req.user!.id)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const row = await upsertCourseSection(pool, payload);
  await audit(req, "update_course_section", row.id, row.sectionCode);
  res.json(row);
}));

app.delete("/api/course-sections/:id", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  if (req.user!.role === "teacher" && existing.teacher_id !== req.user!.id) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM course_registrations WHERE section_id = $1", [req.params.id]);
    await client.query("DELETE FROM section_schedules WHERE section_id = $1", [req.params.id]);
    await client.query("DELETE FROM course_sections WHERE id = $1", [req.params.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, "delete_course_section", req.params.id, existing.section_code);
  res.status(204).send();
}));

app.post("/api/course-registrations", requireAuth, requireRole(["student"]), validateBody(schemas.courseRegistration), asyncHandler(async (req, res) => {
  const result = await courseRegistrationsRepository.register(pool, req.user!.id, req.body.sectionId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.patch("/api/course-registrations/:id/drop", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const registration = await courseRegistrationsRepository.drop(pool, req.params.id, req.user!.id);
  if (!registration) return res.status(404).json({ error: "Course registration not found." });
  res.json(registration);
}));

app.post("/api/grade-appeals", requireAuth, requireRole(["student"]), validateBody(schemas.gradeAppeal), asyncHandler(async (req, res) => {
  const result = await gradeAppealsRepository.create(pool, req.user!.id, req.body);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.get("/api/grade-appeals", requireAuth, requireRole(["student", "teacher", "admin", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await gradeAppealsRepository.list(pool, req.user!))));
app.patch("/api/grade-appeals/:id/review", requireAuth, requireRole(["teacher"]), validateBody(schemas.gradeAppealReview), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.review(pool, req.params.id, req.user!.id, req.body.revisedGrade);
  if (!appeal) return res.status(404).json({ error: "Grade appeal not found." });
  res.json(appeal);
}));
app.patch("/api/grade-appeals/:id/resolve", requireAuth, requireRole(["admin"]), validateBody(schemas.gradeAppealResolve), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.resolve(pool, req.params.id, req.user!.id, req.body.status, req.body.resolutionNote);
  if (!appeal) return res.status(404).json({ error: "Grade appeal not found." });
  res.json(appeal);
}));
app.patch("/api/grade-appeals/:id/escalate", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.escalate(pool, req.params.id, req.user!.id);
  if (!appeal) return res.status(404).json({ error: "Rejected appeal not found or already escalated." });
  res.json(appeal);
}));

app.post("/api/leave-requests", requireAuth, requireRole(["student"]), validateBody(schemas.leaveRequest), asyncHandler(async (req, res) => res.status(201).json(await leaveRequestsRepository.create(pool, req.user!.id, req.body))));
app.get("/api/leave-requests", requireAuth, requireRole(["student", "admin", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await leaveRequestsRepository.list(pool, req.user!))));
app.patch("/api/leave-requests/:id/approve", requireAuth, requireRole(["admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const request = await leaveRequestsRepository.approve(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!request) return res.status(404).json({ error: "Leave request not found." });
  res.json(request);
}));
app.patch("/api/leave-requests/:id/reject", requireAuth, requireRole(["admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const request = await leaveRequestsRepository.reject(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!request) return res.status(404).json({ error: "Leave request not found." });
  res.json(request);
}));

app.post("/api/graduation-applications", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const result = await graduationRepository.create(pool, req.user!.id);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.get("/api/graduation-applications", requireAuth, requireRole(["student", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await graduationRepository.list(pool, req.user!))));
app.patch("/api/graduation-applications/:id/approve", requireAuth, requireRole(["admin"]), validateBody(schemas.graduationApplicationReview), asyncHandler(async (req, res) => {
  const application = await graduationRepository.approve(pool, req.params.id, req.user!.id, req.body.note);
  if (!application) return res.status(404).json({ error: "Graduation application not found." });
  if ("error" in application) return res.status(application.status).json({ error: application.error });
  res.json(application);
}));
app.patch("/api/graduation-applications/:id/reject", requireAuth, requireRole(["admin"]), validateBody(schemas.graduationApplicationReview), asyncHandler(async (req, res) => {
  const application = await graduationRepository.reject(pool, req.params.id, req.user!.id, req.body.note);
  if (!application) return res.status(404).json({ error: "Graduation application not found." });
  res.json(application);
}));

app.get("/api/scholarships", requireAuth, asyncHandler(async (_req, res) => res.json(await scholarshipsRepository.list(pool))));
app.post("/api/scholarships", requireAuth, requireRole(["finance", "admin", "super_admin"]), validateBody(schemas.scholarship), asyncHandler(async (req, res) => res.status(201).json(await scholarshipsRepository.create(pool, req.body))));
app.get("/api/scholarship-applications", requireAuth, requireRole(["student", "advisor", "finance", "admin", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await scholarshipsRepository.listApplications(pool, req.user!))));
app.post("/api/scholarship-applications", requireAuth, requireRole(["student"]), validateBody(schemas.scholarshipApplication), asyncHandler(async (req, res) => {
  const result = await scholarshipsRepository.apply(pool, req.user!.id, req.body);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.patch("/api/scholarship-applications/:id/approve", requireAuth, requireRole(["finance"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const application = await scholarshipsRepository.approve(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!application) return res.status(404).json({ error: "Scholarship application not found." });
  res.json(application);
}));
app.patch("/api/scholarship-applications/:id/reject", requireAuth, requireRole(["finance"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const application = await scholarshipsRepository.reject(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!application) return res.status(404).json({ error: "Scholarship application not found." });
  res.json(application);
}));

app.get("/api/academic-warnings", requireAuth, asyncHandler(async (req, res) => {
  const requestedStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const result = await academicsRepository.listWarningsForUser(pool, req.user!, requestedStudentId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.json(result.warnings);
}));
app.patch("/api/academic-warnings/:id/resolve", requireAuth, requireRole(["advisor", "admin"]), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.resolveWarning(pool, req.params.id, req.user!.id);
  if (!warning) return res.status(404).json({ error: "Warning not found." });
  res.json(warning);
}));

app.post("/api/tuition/pay", requireAuth, requireRole(["finance", "manager", "admin", "super_admin"]), validateBody(schemas.payTuition), asyncHandler(async (req, res) => {
  const ownerStudentId = req.user!.role === "student" ? req.user!.id : undefined;
  const result = await financeRepository.payTuition(pool, req.body.feeId, req.body.paidAmount, ownerStudentId);
  if (!result) return res.status(404).json({ error: "Tuition fee not found." });
  await audit(req, "record_tuition_payment", req.body.feeId, `Paid amount ${req.body.paidAmount}.`);
  res.json(result);
}));

app.post("/api/tuition/confirm-transfer", requireAuth, requireRole(["student"]), validateBody(schemas.confirmTransfer), asyncHandler(async (req, res) => {
  const { feeId, amount } = req.body;
  const client = await pool.connect();
  let txId = "";
  try {
  await client.query("BEGIN");
  const fee = (await client.query(
    "SELECT id, student_id, amount, paid_amount FROM tuition_fees WHERE id = $1 FOR UPDATE",
    [feeId]
  )).rows[0];
  if (!fee || fee.student_id !== req.user!.id) {
    await client.query("ROLLBACK");
    return res.status(404).json({ error: "Tuition fee not found." });
  }
  const remaining = Math.max(0, Number(fee.amount) - Number(fee.paid_amount || 0));
  const tuitionNote = `tuition_fee_pay:${feeId}`;
  const pendingAmount = Number((await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE student_id = $1
       AND status = 'pending'
       AND (notes = $2 OR notes LIKE $2 || ' |%')`,
    [req.user!.id, tuitionNote]
  )).rows[0]?.total || 0);
  if (remaining <= 0 || Number(amount) + pendingAmount > remaining) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: "Invalid transfer amount." });
  }
  txId = generateId("tx");
  await client.query(
    `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, notes)
     VALUES ($1, $2, NULL, $3, 'pending', 'Chuyển khoản Ngân hàng (QR)', $4, $5)`,
    [txId, req.user!.id, Number(amount), new Date().toISOString(), tuitionNote]
  );
  await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, "request_tuition_confirm", feeId, `Pending bank transfer of ${amount} for tuition.`);
  res.json({ ok: true, transactionId: txId });
}));

app.patch("/api/finance/transactions/:id/review", requireAuth, requireRole(["finance", "admin", "super_admin"]), validateBody(schemas.reviewTransaction), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let result: any;
  try {
    await client.query("BEGIN");
    result = await financeRepository.reviewTransaction(client, req.params.id, req.body.status, req.user!.id, req.body.notes);
    if (!result) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found." });
    }
    if ("error" in result) {
      await client.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, `finance_transaction_${req.body.status}`, req.params.id, req.body.notes || "");
  res.json(result);
}));

app.post("/api/finance/tuition/bulk-issue", requireAuth, requireRole(["finance", "manager", "admin", "super_admin"]), validateBody(schemas.bulkIssueTuition), asyncHandler(async (req, res) => {
  const { semesterId, amount, dueDate } = req.body;
  const dueDateValue = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profiles = (await client.query(
      "SELECT user_id FROM student_profiles WHERE status = 'active'"
    )).rows;
    const created: any[] = [];
    for (const profile of profiles) {
      const exists = (await client.query(
        "SELECT id FROM tuition_fees WHERE student_id = $1 AND semester_id = $2",
        [profile.user_id, semesterId]
      )).rows[0];
      if (exists) continue;
      const id = generateId("tf");
      const row = (await client.query(
        `INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount)
         VALUES ($1,$2,$3,$4,$5,'unpaid',0)
         RETURNING *`,
        [id, profile.user_id, semesterId, Number(amount), dueDateValue]
      )).rows[0];
      await notificationsRepository.create(client, {
        userId: profile.user_id,
        type: "info",
        message: `Thông báo nộp học phí: học kỳ ${semesterId}, số tiền ${Number(amount).toLocaleString()} VND.`,
        relatedEntityType: "tuition_fee",
        relatedEntityId: id
      });
      created.push(row);
    }
    await client.query("COMMIT");
    await audit(req, "bulk_issue_tuition", semesterId, `Issued ${created.length} tuition fees.`);
    res.status(201).json({ createdCount: created.length, fees: created.map(tuitionFeeFromRow) });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/finance/tuition/scan-overdue", requireAuth, requireRole(["finance", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const overdue = await financeRepository.checkOverdueFees(pool);
  await audit(req, "scan_overdue_tuition", "tuition_fees", `Found ${overdue.length} overdue fees.`);
  res.json({ overdueCount: overdue.length, fees: overdue });
}));

app.post("/api/attendance/sessions", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.attendanceSession), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher" && course.teacherId !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  const session = {
    id: generateId("ats"),
    courseId: req.body.courseId,
    semesterId: req.body.semesterId || "sem_spring25",
    teacherId: req.user!.role === "teacher" ? req.user!.id : course.teacherId,
    date: req.body.date,
    topic: req.body.topic
  };
  const records = (req.body.records || []).map((record: any) => ({
    id: generateId("atr"),
    sessionId: session.id,
    studentId: record.studentId,
    status: record.status,
    note: record.note
  }));
  await attendanceRepository.saveAttendanceSession(pool, session, records);
  await audit(req, "create_attendance_session", session.id, session.courseId);
  res.status(201).json({ session, records });
}));

app.patch("/api/attendance/records", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.attendanceRecord), asyncHandler(async (req, res) => {
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [req.body.sessionId])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });
  if (req.user!.role === "teacher" && session.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  const existing = (await pool.query(
    "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
    [req.body.sessionId, req.body.studentId]
  )).rows[0];
  const record = {
    id: existing?.id || generateId("atr"),
    sessionId: req.body.sessionId,
    studentId: req.body.studentId,
    status: req.body.status,
    note: req.body.note
  };
  await attendanceRepository.bulkMarkRecords(pool, [record]);
  await audit(req, "update_attendance_record", record.id, `${record.studentId}:${record.status}`);
  res.json(record);
}));

app.post("/api/attendance/sessions/generate-link", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), validateBody(schemas.generateAttendanceLink), asyncHandler(async (req, res) => {
  const { courseId, semesterId, topic } = req.body;
  const course = await coursesRepository.findById(pool, courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher" && course.teacherId !== req.user!.id) {
    return res.status(403).json({ error: "Permission denied." });
  }

  // Generate unique 6-character random uppercase code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  // 5 minutes expiry
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const session = {
    id: generateId("ats"),
    courseId,
    semesterId: semesterId || "sem_spring25",
    teacherId: req.user!.role === "teacher" ? req.user!.id : course.teacherId,
    date: new Date().toISOString().slice(0, 10),
    topic,
    code,
    expiresAt
  };

  // Insert session into database
  const columns = (await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date')"
  )).rows.map(row => row.column_name);
  const sessionDateOnly = session.date.slice(0, 10);
  
  if (columns.includes("session_date") && columns.includes("date")) {
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, session_date, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [session.id, session.courseId, session.semesterId, session.teacherId, sessionDateOnly, session.date, session.topic, session.code, session.expiresAt]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [session.id, session.courseId, session.semesterId, session.teacherId, session.date, session.topic, session.code, session.expiresAt]
    );
  }

  // Fetch all active enrollments for this course
  const enrollmentsRes = await pool.query(
    "SELECT student_id FROM enrollments WHERE course_id = $1 AND status = 'active'",
    [courseId]
  );
  const studentIds = enrollmentsRes.rows.map(row => row.student_id);

  // Send check-in notifications to all active students in class
  const message = `[Điểm danh trực tuyến] Môn học "${course.title}" đang tiến hành điểm danh trực tuyến. Hãy click vào đây để xác nhận có mặt (Thời hạn 5 phút).`;
  
  for (const studentId of studentIds) {
    await notificationsRepository.create(pool, {
      userId: studentId,
      type: "attendance_link",
      message,
      relatedEntityType: "attendance_session",
      relatedEntityId: session.id
    });
  }

  await audit(req, "create_attendance_link", session.id, `Course: ${course.title}, Code: ${code}`);

  res.status(201).json({ session, code, expiresAt });
}));

app.post("/api/attendance/self-checkin", requireAuth, requireRole(["student"]), validateBody(schemas.selfCheckin), asyncHandler(async (req, res) => {
  const { sessionId, code } = req.body;
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [sessionId])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });

  if (!session.code || session.code !== code) {
    return res.status(400).json({ error: "Mã điểm danh không chính xác hoặc không khả dụng." });
  }

  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    return res.status(400).json({ error: "Mã điểm danh đã hết hạn (Chỉ có giá trị trong 5 phút)." });
  }

  // Record presence for this student
  const existing = (await pool.query(
    "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
    [sessionId, req.user!.id]
  )).rows[0];

  const record = {
    id: existing?.id || generateId("atr"),
    sessionId,
    studentId: req.user!.id,
    status: "present" as const,
    note: "Tự điểm danh qua link"
  };

  await attendanceRepository.bulkMarkRecords(pool, [record]);
  await audit(req, "student_self_checkin", record.id, `Student: ${req.user!.id}, Status: present`);
  res.json({ ok: true, record });
}));

app.post("/api/attendance/teacher-checkin", requireAuth, requireRole(["teacher"]), validateBody(schemas.teacherCheckin), asyncHandler(async (req, res) => {
  const { courseId, sectionId, slotTime, classDate } = req.body;
  const teacherId = req.user!.id;

  // Check if teacher already checked in for this section and class date
  const existing = (await pool.query(
    "SELECT id FROM teacher_attendance WHERE teacher_id = $1 AND section_id = $2 AND class_date = $3",
    [teacherId, sectionId, classDate]
  )).rows[0];

  if (existing) {
    return res.status(400).json({ error: "Giảng viên đã điểm danh cho ca học này rồi!" });
  }

  const record = {
    id: generateId("tat"),
    teacherId,
    courseId,
    sectionId,
    classDate,
    slotTime,
    status: "present" as const,
    checkedInAt: new Date().toISOString()
  };

  await pool.query(
    `INSERT INTO teacher_attendance (id, teacher_id, course_id, section_id, class_date, slot_time, status, checked_in_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [record.id, record.teacherId, record.courseId, record.sectionId, record.classDate, record.slotTime, record.status, record.checkedInAt]
  );

  const { invalidateStoreCache } = await import("./src/server/repositories/storeSnapshot");
  invalidateStoreCache();

  await audit(req, "teacher_self_checkin", record.id, `Teacher: ${teacherId}, Section: ${sectionId}, Status: present`);

  res.status(201).json({ ok: true, record });
}));

app.post("/api/attendance/warn-teacher", requireAuth, requireRole(["admin", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.body;
  if (!courseId || !teacherId) {
    return res.status(400).json({ error: "Missing courseId or teacherId." });
  }
  const course = await coursesRepository.findById(pool, courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const teacher = (await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'teacher'", [teacherId])).rows[0];
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });

  await notificationsRepository.createNotification(
    pool,
    teacherId,
    "danger",
    `CẢNH CÁO HỌC VỤ: Lớp học phần "${course.title}" chưa có bất kỳ buổi điểm danh nào. Yêu cầu giảng viên cập nhật điểm danh ngay lập tức!`
  );

  await audit(
    req,
    "warning_attendance_compliance",
    courseId,
    `Gửi cảnh cáo chưa điểm danh cho giảng viên ${teacher.name} (${teacherId})`
  );

  res.json({ ok: true });
}));

app.post("/api/store/sync", requireAuth, requireRole(["admin", "super_admin", "manager"]), asyncHandler(async (req, res) => {
  await syncClientStoreToDb(req.body || {});
  await audit(req, "store_sync", "store", "Client store changes synchronized into Postgres.");
  res.json({ ok: true, mode: "postgres-synchronized" });
}));

async function setupServer() {
  await initializeDatabase();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message || "Internal server error." });
  });
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
