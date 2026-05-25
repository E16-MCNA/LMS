import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getInitialStore } from "./src/store";
import { hashPassword, verifyPassword } from "./src/authHash";
import { LMSDataStore, StudentProfile, User } from "./src/types";
import { runMigrations } from "./src/dbMigrations";
import { pool } from "./src/server/db";
import { generateId } from "./src/server/ids";
import { DbUserRow, toPublicUser } from "./src/server/mappers";
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
import { limitStoreForRole, storeSnapshotFromDb } from "./src/server/repositories/storeSnapshot";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-e16-lms-secret");
const revokedTokens = new Set<string>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const csrfSafeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

app.use(express.json({ limit: "10mb" }));

if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production.");
}

type AuthRequest = express.Request & { user?: User };
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
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyToken(token: string): { sub: string } | null {
  if (revokedTokens.has(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
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

function rateLimitLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ error: "Too many login attempts. Please try again later." });
  }
  entry.count += 1;
  next();
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
    const payload = verifyToken(token);
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

async function audit(req: AuthRequest, action: string, target: string, detail: string) {
  if (!req.user) return;
  await auditRepository.log(pool, req.user.id, action, target, detail);
}

async function syncClientStoreToDb(store: Partial<LMSDataStore>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const user of store.users || []) {
      if (user.role === "parent") continue;
      await client.query(
        `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
         VALUES ($1,$2,COALESCE(NULLIF($3, ''), 'client-sync-placeholder'),$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           phone = EXCLUDED.phone,
           linked_student_id = EXCLUDED.linked_student_id,
           password_hash = COALESCE(NULLIF($11, ''), users.password_hash),
           password_salt = COALESCE(EXCLUDED.password_salt, users.password_salt)`,
        [
          user.id,
          user.email.toLowerCase(),
          user.passwordHash || "",
          user.passwordSalt || null,
          user.name,
          user.role,
          user.isActive,
          user.phone || null,
          user.linkedStudentId || null,
          user.createdAt || new Date().toISOString(),
          user.passwordHash || ""
        ]
      );
    }

    for (const profile of store.studentProfiles || []) {
      await client.query(
        `INSERT INTO student_profiles (
          id, user_id, student_code, program_id, department_id, academic_year, enrollment_date,
          expected_graduation, status, gpa, total_credits_earned, address, phone, date_of_birth,
          gender, guardian_name, guardian_phone, guardian_email, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          student_code = EXCLUDED.student_code,
          program_id = EXCLUDED.program_id,
          department_id = EXCLUDED.department_id,
          academic_year = EXCLUDED.academic_year,
          enrollment_date = EXCLUDED.enrollment_date,
          expected_graduation = EXCLUDED.expected_graduation,
          status = EXCLUDED.status,
          gpa = EXCLUDED.gpa,
          total_credits_earned = EXCLUDED.total_credits_earned,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          date_of_birth = EXCLUDED.date_of_birth,
          gender = EXCLUDED.gender,
          guardian_name = EXCLUDED.guardian_name,
          guardian_phone = EXCLUDED.guardian_phone,
          guardian_email = EXCLUDED.guardian_email,
          notes = EXCLUDED.notes`,
        [
          profile.id, profile.userId, profile.studentCode, profile.programId, profile.departmentId,
          profile.academicYear, profile.enrollmentDate, profile.expectedGraduation, profile.status,
          profile.gpa, profile.totalCreditsEarned, profile.address || null, profile.phone || null,
          profile.dateOfBirth || null, profile.gender || null, profile.guardianName || null,
          profile.guardianPhone || null, profile.guardianEmail || null, profile.notes || null
        ]
      );
    }

    for (const user of (store.users || []).filter(item => item.role === "student")) {
      const hasProfile = (store.studentProfiles || []).some(profile => profile.userId === user.id);
      if (!hasProfile) {
        const profile: StudentProfile = {
          id: generateId("profile"),
          userId: user.id,
          studentCode: `SV${new Date().getFullYear()}${user.id.slice(-4).toUpperCase()}`,
          programId: "prog_se",
          departmentId: "dept_cs",
          academicYear: 1,
          enrollmentDate: new Date().toISOString().slice(0, 10),
          expectedGraduation: new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toISOString().slice(0, 10),
          status: "active",
          gpa: 0,
          totalCreditsEarned: 0
        };
        await client.query(
          `INSERT INTO student_profiles (id, user_id, student_code, program_id, department_id, academic_year, enrollment_date, expected_graduation, status, gpa, total_credits_earned)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [profile.id, profile.userId, profile.studentCode, profile.programId, profile.departmentId, profile.academicYear, profile.enrollmentDate, profile.expectedGraduation, profile.status, profile.gpa, profile.totalCreditsEarned]
        );
      }
    }

    for (const course of store.courses || []) {
      await client.query(
        `UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3`,
        [course.status, course.rejectionReason || null, course.id]
      );
    }

    await client.query(`
      DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE role = 'parent');
      DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role = 'parent');
      DELETE FROM users WHERE role = 'parent';
      UPDATE student_profiles SET guardian_name = NULL, guardian_phone = NULL, guardian_email = NULL;
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function dashboardFromStore(store: any, user: User) {
  const scoped = limitStoreForRole(store, user);
  if (user.role === "admin" || user.role === "super_admin") {
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
}

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } }) : null;

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
  const user = toPublicUser(row);
  setAuthCookie(res, signToken(user));
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  setCsrfCookie(res, csrfToken);
  await auditRepository.log(pool, user.id, "authentication_login", "security", `Authenticated role ${user.role}.`);
  res.json({ user, csrfToken });
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) revokedTokens.add(token);
  await audit(req, "authentication_logout", "security", "Session closed.");
  clearAuthCookie(res);
  res.status(204).send();
}));

app.get("/api/auth/me", requireAuth, (req: AuthRequest, res) => res.json({ user: req.user }));
app.get("/api/store", requireAuth, asyncHandler(async (req, res) => res.json(limitStoreForRole(await storeSnapshotFromDb(pool), req.user!))));

app.get("/api/dashboard/admin", requireAuth, requireRole(["admin", "super_admin"]), asyncHandler(async (req, res) => {
  const store = await storeSnapshotFromDb(pool);
  res.json({ ...dashboardFromStore(store, req.user!), auditLogs: await auditRepository.listRecent(pool, 100) });
}));
app.get("/api/dashboard/teacher", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/student", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/finance", requireAuth, requireRole(["finance", "admin", "super_admin"]), asyncHandler(async (_req, res) => res.json(await financeRepository.getDashboard(pool))));
app.get("/api/dashboard/academic", requireAuth, requireRole(["academic", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json({ ...dashboardFromStore(await storeSnapshotFromDb(pool), req.user!), warnings: await academicsRepository.listWarnings(pool) })));
app.get("/api/dashboard/advisor", requireAuth, requireRole(["advisor", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json({ ...limitStoreForRole(await storeSnapshotFromDb(pool), req.user!), advisorNotes: await academicsRepository.getAdvisorNotes(pool, req.user!.id) })));
app.get("/api/dashboard/parent", requireAuth, requireRole(["parent"]), asyncHandler(async (req, res) => res.json(limitStoreForRole(await storeSnapshotFromDb(pool), req.user!))));

app.get("/api/courses", requireAuth, asyncHandler(async (_req, res) => res.json(await coursesRepository.list(pool))));
app.post("/api/courses", requireAuth, requireRole(["teacher", "admin", "super_admin", "academic"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
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
app.post("/api/courses/:id/submit", requireAuth, requireRole(["teacher", "admin", "super_admin", "academic"]), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.params.id)) return res.status(403).json({ error: "Permission denied." });
  const course = await coursesRepository.setStatus(pool, req.params.id, "pending");
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "submit_course_approval", course.id, course.title);
  res.json(course);
}));
app.post("/api/courses/:id/publish", requireAuth, requireRole(["admin", "super_admin", "academic"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "published");
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "approve_course", course.id, course.title);
  res.json(course);
}));
app.post("/api/courses/:id/reject", requireAuth, requireRole(["admin", "super_admin", "academic"]), validateBody(schemas.rejectCourse), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "rejected", req.body.rejectionReason);
  if (!course) return res.status(404).json({ error: "Course not found." });
  await audit(req, "reject_course", course.id, req.body.rejectionReason);
  res.json(course);
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
  const enrollment = await enrollmentsRepository.register(pool, req.user!.id, course.id, Number(course.price || 0) > 0);
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
  const progress = await enrollmentsRepository.toggleProgress(pool, req.body.enrollmentId, req.body.lessonId);
  await audit(req, "toggle_lesson_progress", req.body.lessonId, `completed=${progress.completed}`);
  res.json(progress);
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
app.post("/api/quizzes/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitQuiz), asyncHandler(async (req, res) => {
  const attempt = await quizzesRepository.submitAttempt(pool, req.body.quizId, req.user!.id, req.body.answers, req.body.startedAt);
  if (!attempt) return res.status(404).json({ error: "Quiz not found." });
  await audit(req, "submit_quiz_attempt", attempt.quizId, `Score ${attempt.score}.`);
  res.status(201).json(attempt);
}));

app.post("/api/assignments", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createAssignment), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  const assignment = await assignmentsRepository.create(pool, req.body);
  await audit(req, "create_assignment", assignment.id, assignment.title);
  res.status(201).json(assignment);
}));
app.post("/api/assignments/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitAssignment), asyncHandler(async (req, res) => {
  const submission = await assignmentsRepository.submit(pool, req.user!.id, req.body.assignmentId, req.body.content);
  await audit(req, "submit_assignment", submission.id, submission.assignmentId);
  res.status(201).json(submission);
}));
app.post("/api/assignments/grade", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.gradeAssignment), asyncHandler(async (req, res) => {
  const submission = await assignmentsRepository.findSubmissionForGrading(pool, req.body.submissionId);
  if (!submission) return res.status(404).json({ error: "Submission not found." });
  if (req.user!.role === "teacher" && submission.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  if (req.body.score > Number(submission.max_score)) return res.status(400).json({ error: "Invalid score." });
  const result = await assignmentsRepository.grade(pool, req.body.submissionId, req.body.score, req.body.feedback);
  await audit(req, "grade_assignment", req.body.submissionId, `Score ${req.body.score}.`);
  res.json(result);
}));

app.post("/api/admin/users", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.createUser), asyncHandler(async (req, res) => {
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
  await audit(req, "create_user", created.id, created.email);
  res.status(201).json(created);
}));
app.patch("/api/admin/users/:id/status", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.setUserActive), asyncHandler(async (req, res) => {
  const user = await usersRepository.setActive(pool, req.params.id, req.body.isActive);
  if (!user) return res.status(404).json({ error: "User not found." });
  await audit(req, "toggle_user_status", user.id, `isActive=${user.isActive}`);
  res.json(user);
}));

app.get("/api/academics/warnings", requireAuth, asyncHandler(async (req, res) => {
  const canViewAll = ["admin", "super_admin", "academic", "advisor"].includes(req.user!.role);
  res.json(await academicsRepository.listWarnings(pool, canViewAll ? undefined : req.user!.id));
}));
app.post("/api/academics/warnings", requireAuth, requireRole(["academic", "advisor", "admin", "super_admin"]), validateBody(schemas.createWarning), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.createWarning(pool, req.body);
  await audit(req, "create_academic_warning", warning.studentId, warning.message);
  res.status(201).json(warning);
}));
app.post("/api/academics/warnings/:id/resolve", requireAuth, requireRole(["academic", "advisor", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.resolveWarning(pool, req.params.id);
  if (!warning) return res.status(404).json({ error: "Warning not found." });
  await audit(req, "resolve_academic_warning", warning.id, warning.studentId);
  res.json(warning);
}));
app.post("/api/advisor/notes", requireAuth, requireRole(["advisor", "admin", "super_admin"]), validateBody(schemas.addAdvisorNote), asyncHandler(async (req, res) => {
  const note = await academicsRepository.addAdvisorNote(pool, req.user!.id, req.body.studentId, req.body.content, req.body.type);
  await audit(req, "add_advisor_note", note.studentId, note.type);
  res.status(201).json(note);
}));

app.post("/api/tuition/pay", requireAuth, requireRole(["finance", "admin", "super_admin"]), validateBody(schemas.payTuition), asyncHandler(async (req, res) => {
  const result = await financeRepository.payTuition(pool, req.body.feeId, req.body.paidAmount);
  if (!result) return res.status(404).json({ error: "Tuition fee not found." });
  await audit(req, "record_tuition_payment", req.body.feeId, `Paid amount ${req.body.paidAmount}.`);
  res.json(result);
}));

app.post("/api/store/sync", requireAuth, asyncHandler(async (req, res) => {
  if (!["admin", "super_admin", "academic", "finance"].includes(req.user!.role)) {
    return res.status(403).json({ error: "Permission denied." });
  }
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
