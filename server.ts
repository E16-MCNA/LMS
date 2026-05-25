import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createRequire } from "module";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { calculateStudentGpa, getInitialStore } from "./src/store";
import { verifyPassword } from "./src/authHash";
import { Assignment, Course, Enrollment, LessonProgress, Question, Quiz, TuitionFee, User } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;
const require = createRequire(path.join(process.cwd(), "server.ts"));
const revokedTokens = new Set<string>();

app.use(express.json());

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt?: string;
  name: string;
  role: User["role"];
  is_active: number;
  phone?: string;
  linked_student_id?: string;
  created_at: string;
};

type AuthRequest = express.Request & { user?: User };

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-e16-lms-secret";

function normalizeRole(role: string): User["role"] {
  if (role === "ke_toan") return "finance";
  if (role === "quan_ly_hoc_vu" || role === "academic_admin") return "academic";
  return role as User["role"];
}

function getDatabase() {
  const sqlite = require("node:sqlite") as any;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new sqlite.DatabaseSync(path.join(dataDir, "lms.sqlite"));
  db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", "001_initial_schema.sql"), "utf8"));
  seedAuthUsers(db);
  return db;
}

function normalizeDbRole(db: any) {
  db.exec(`
    UPDATE users SET role = 'finance' WHERE role = 'ke_toan';
    UPDATE users SET role = 'academic' WHERE role IN ('quan_ly_hoc_vu', 'academic_admin');
  `);
}

function seedAuthUsers(db: any) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count as number;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const store = getInitialStore();
  for (const user of store.users) {
    insert.run(
      user.id,
      user.email.toLowerCase(),
      user.passwordHash,
      user.passwordSalt || null,
      user.name,
      normalizeRole(user.role),
      user.isActive ? 1 : 0,
      user.phone || null,
      user.linkedStudentId || null,
      user.createdAt
    );
  }
}

function seedCoreLearningData(db: any) {
  const store = getInitialStore();
  const courseCount = db.prepare("SELECT COUNT(*) AS count FROM courses").get().count as number;
  if (courseCount === 0) {
    const insertCourse = db.prepare(`
      INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of store.courses) insertCourse.run(c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM lessons").get().count === 0) {
    const insert = db.prepare("INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const l of store.lessons) insert.run(l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM enrollments").get().count === 0) {
    const insert = db.prepare("INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const e of store.enrollments) insert.run(e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM lesson_progress").get().count === 0) {
    const insert = db.prepare("INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, ?, ?)");
    for (const p of store.lessonProgress) insert.run(p.id, p.enrollmentId, p.lessonId, p.completed ? 1 : 0, p.completedAt || null);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM quizzes").get().count === 0) {
    const insertQuiz = db.prepare("INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const q of store.quizzes) insertQuiz.run(q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts);
    const insertQuestion = db.prepare("INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES (?, ?, ?, ?, ?, ?)");
    for (const q of store.questions) insertQuestion.run(q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM quiz_attempts").get().count === 0) {
    const insert = db.prepare("INSERT INTO quiz_attempts (id, quiz_id, student_id, answers_json, score, passed, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const a of store.quizAttempts) insert.run(a.id, a.quizId, a.studentId, JSON.stringify(a.answers || {}), a.score, a.passed ? 1 : 0, a.startedAt, a.submittedAt);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM assignments").get().count === 0) {
    const insertAssignment = db.prepare("INSERT INTO assignments (id, course_id, title, description, deadline, max_score) VALUES (?, ?, ?, ?, ?, ?)");
    for (const a of store.assignments) insertAssignment.run(a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore);
    const insertSubmission = db.prepare("INSERT INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const s of store.submissions) insertSubmission.run(s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM tuition_fees").get().count === 0) {
    const insert = db.prepare("INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount, paid_at, receipt_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const f of store.tuitionFees) insert.run(f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM attendance_sessions").get().count === 0) {
    const insertSession = db.prepare("INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, date, topic) VALUES (?, ?, ?, ?, ?, ?)");
    for (const s of store.attendanceSessions) insertSession.run(s.id, s.courseId, s.semesterId, s.teacherId, s.date, s.topic);
    const insertRecord = db.prepare("INSERT INTO attendance_records (id, session_id, student_id, status, note) VALUES (?, ?, ?, ?, ?)");
    for (const r of store.attendanceRecords) insertRecord.run(r.id, r.sessionId, r.studentId, r.status, r.note || null);
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM academic_warnings").get().count === 0) {
    const insert = db.prepare("INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const w of store.academicWarnings) insert.run(w.id, w.studentId, w.type, w.message, w.isResolved ? 1 : 0, w.createdAt);
  }
}

function initializeDatabase(db: any) {
  normalizeDbRole(db);
  seedAuthUsers(db);
  seedCoreLearningData(db);
}

function toPublicUser(row: DbUserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: "",
    name: row.name,
    role: normalizeRole(row.role),
    isActive: Boolean(row.is_active),
    phone: row.phone || undefined,
    linkedStudentId: row.linked_student_id || undefined,
    createdAt: row.created_at
  };
}

function setAuthCookie(res: express.Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `e16_lms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}`);
}

function clearAuthCookie(res: express.Response) {
  res.setHeader("Set-Cookie", "e16_lms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
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

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing session." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as DbUserRow | undefined;
  if (!row || !row.is_active) return res.status(401).json({ error: "User is not available." });
  req.user = toPublicUser(row);
  next();
}

function requireRole(roles: Array<User["role"]>) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permission denied." });
    next();
  };
}

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function courseFromRow(row: any): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teacherId: row.teacher_id,
    status: row.status,
    category: row.category,
    thumbnail: row.thumbnail || undefined,
    price: row.price ?? undefined,
    level: row.level || undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    rejectionReason: row.rejection_reason || undefined,
    createdAt: row.created_at
  };
}

function enrollmentFromRow(row: any): Enrollment {
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at || undefined
  };
}

function questionFromRow(row: any): Question {
  return {
    id: row.id,
    quizId: row.quiz_id,
    text: row.text,
    type: row.type,
    options: row.options_json ? JSON.parse(row.options_json) : [],
    correctAnswer: row.correct_answer
  };
}

function storeSnapshotFromDb() {
  const users = (db.prepare("SELECT * FROM users").all() as DbUserRow[]).map(toPublicUser);
  const courses = (db.prepare("SELECT * FROM courses").all() as any[]).map(courseFromRow);
  const lessons = (db.prepare("SELECT * FROM lessons").all() as any[]).map(row => ({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    content: row.content,
    videoUrl: row.video_url || undefined,
    order: row.lesson_order,
    duration: row.duration
  }));
  const enrollments = (db.prepare("SELECT * FROM enrollments").all() as any[]).map(enrollmentFromRow);
  const lessonProgress = (db.prepare("SELECT * FROM lesson_progress").all() as any[]).map(row => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    lessonId: row.lesson_id,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || undefined
  }));
  const quizzes = (db.prepare("SELECT * FROM quizzes").all() as any[]).map(row => ({
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id || undefined,
    title: row.title,
    passingScore: row.passing_score,
    timeLimit: row.time_limit,
    maxAttempts: row.max_attempts
  }));
  const questions = (db.prepare("SELECT * FROM questions").all() as any[]).map(questionFromRow);
  const quizAttempts = (db.prepare("SELECT * FROM quiz_attempts").all() as any[]).map(row => ({
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    answers: row.answers_json ? JSON.parse(row.answers_json) : {},
    score: row.score,
    passed: Boolean(row.passed),
    startedAt: row.started_at,
    submittedAt: row.submitted_at
  }));
  const assignments = (db.prepare("SELECT * FROM assignments").all() as any[]).map(row => ({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    maxScore: row.max_score
  }));
  const submissions = (db.prepare("SELECT * FROM submissions").all() as any[]).map(row => ({
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    content: row.content,
    score: row.score ?? undefined,
    feedback: row.feedback || undefined,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at || undefined
  }));
  const tuitionFees = (db.prepare("SELECT * FROM tuition_fees").all() as any[]).map(row => ({
    id: row.id,
    studentId: row.student_id,
    semesterId: row.semester_id || "",
    amount: row.amount,
    dueDate: row.due_date,
    status: row.status,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at || undefined,
    receiptCode: row.receipt_code || undefined
  }));
  const academicWarnings = (db.prepare("SELECT * FROM academic_warnings").all() as any[]).map(row => ({
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    message: row.message,
    isResolved: Boolean(row.is_resolved),
    createdAt: row.created_at
  }));

  return {
    ...getInitialStore(),
    users,
    courses,
    lessons,
    enrollments,
    lessonProgress,
    quizzes,
    questions,
    quizAttempts,
    assignments,
    submissions,
    tuitionFees,
    academicWarnings
  };
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const cookie = req.header("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)e16_lms_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const db = getDatabase();
initializeDatabase(db);

// Initialize Gemini client server-side
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// API Route to analyze python flask / web entrypoint code
app.post("/api/analyze", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code content is required." });
  }

  if (!ai) {
    return res.status(503).json({
      error: "Gemini API Key is not configured in the workspace secrets. Please configure GEMINI_API_KEY in Settings."
    });
  }

  try {
    const prompt = `Analyze this web/backend application entrypoint file, specifically looking at its structure, routing, models (if applicable), and configuration, and generate a structured JSON feedback. Here is the code:\n\n${code}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert full-stack engineer specialized in web frameworks, microservices, and porting applications across Python (Flask) and Node.js (Express/TypeScript). Provide extremely high-quality explanations, trace environment variables, and write production-grade equivalent Express code.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { 
              type: Type.STRING,
              description: "A comprehensive description of what this entrypoint file does, written in markdown. Explain the imports, app instantiation, and execution path."
            },
            configs: {
              type: Type.ARRAY,
              description: "Configuration variables and environment setups identified in this code.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Variable name (e.g. Host, Port, Debug, etc.)" },
                  defaultValue: { type: Type.STRING, description: "Default fallback value code defines" },
                  envVar: { type: Type.STRING, description: "Source environment variable checked in code (if any)" },
                  description: { type: Type.STRING, description: "What this configuration is used for" }
                },
                required: ["name", "defaultValue", "envVar", "description"]
              }
            },
            nodePort: { 
              type: Type.STRING, 
              description: "An elegant, completely valid TypeScript Node.js/Express.js equivalent code for this entrypoint, with best-practices error handling and logging."
            },
            tips: {
              type: Type.ARRAY,
              description: "Specific design/production/architecture recommendation bullet points on how to run or improve this service's environment bindings.",
              items: { type: Type.STRING }
            }
          },
          required: ["explanation", "configs", "nodePort", "tips"]
        }
      }
    });

    const jsonText = response.text?.trim() ?? "{}";
    res.json(JSON.parse(jsonText));
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error.message || "An error occurred during code analysis." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const row = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email) as DbUserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  if (!row.is_active) {
    return res.status(403).json({ error: "Account inactive." });
  }

  const user = toPublicUser(row);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user });
});

app.post("/api/auth/logout", (req, res) => {
  const token = extractBearerToken(req);
  if (token) revokedTokens.add(token);
  clearAuthCookie(res);
  res.status(204).send();
});

app.get("/api/auth/me", (req, res) => {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing token." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token." });

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as DbUserRow | undefined;
  if (!row || !row.is_active) return res.status(401).json({ error: "User is not available." });
  res.json({ user: toPublicUser(row) });
});

app.get("/api/store", requireAuth, (_req, res) => {
  res.json(storeSnapshotFromDb());
});

app.post("/api/store/sync", requireAuth, (req: AuthRequest, res) => {
  const store = req.body;
  if (!store || typeof store !== "object") return res.status(400).json({ error: "Invalid store payload." });
  const role = req.user!.role;
  if (!["admin", "super_admin", "teacher", "student", "finance", "academic", "advisor", "le_tan"].includes(role)) {
    return res.status(403).json({ error: "Permission denied." });
  }

  try {
    db.exec("BEGIN");
    const course = db.prepare(`
      INSERT OR REPLACE INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of store.courses || []) course.run(c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt);

    const lesson = db.prepare("INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const l of store.lessons || []) lesson.run(l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration);

    const enrollment = db.prepare("INSERT OR REPLACE INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const e of store.enrollments || []) enrollment.run(e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null);

    const progress = db.prepare("INSERT OR REPLACE INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, ?, ?)");
    for (const p of store.lessonProgress || []) progress.run(p.id, p.enrollmentId, p.lessonId, p.completed ? 1 : 0, p.completedAt || null);

    const quiz = db.prepare("INSERT OR REPLACE INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const q of store.quizzes || []) quiz.run(q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts);

    const question = db.prepare("INSERT OR REPLACE INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES (?, ?, ?, ?, ?, ?)");
    for (const q of store.questions || []) question.run(q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer);

    const attempt = db.prepare("INSERT OR REPLACE INTO quiz_attempts (id, quiz_id, student_id, answers_json, score, passed, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const a of store.quizAttempts || []) attempt.run(a.id, a.quizId, a.studentId, JSON.stringify(a.answers || {}), a.score, a.passed ? 1 : 0, a.startedAt, a.submittedAt);

    const assignment = db.prepare("INSERT OR REPLACE INTO assignments (id, course_id, title, description, deadline, max_score) VALUES (?, ?, ?, ?, ?, ?)");
    for (const a of store.assignments || []) assignment.run(a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore);

    const submission = db.prepare("INSERT OR REPLACE INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const s of store.submissions || []) submission.run(s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null);

    const fee = db.prepare("INSERT OR REPLACE INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount, paid_at, receipt_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const f of store.tuitionFees || []) fee.run(f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null);

    const warning = db.prepare("INSERT OR REPLACE INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const w of store.academicWarnings || []) warning.run(w.id, w.studentId, w.type, w.message, w.isResolved ? 1 : 0, w.createdAt);

    db.exec("COMMIT");
    res.json({ ok: true });
  } catch (error: any) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to sync store." });
  }
});

app.get("/api/courses", requireAuth, (_req, res) => {
  const rows = db.prepare("SELECT * FROM courses ORDER BY created_at DESC").all() as any[];
  res.json(rows.map(courseFromRow));
});

app.post("/api/courses", requireAuth, requireRole(["teacher", "admin", "super_admin", "academic"]), (req: AuthRequest, res) => {
  const id = generateId("course");
  const now = new Date().toISOString();
  const teacherId = req.user!.role === "teacher" ? req.user!.id : String(req.body.teacherId || req.user!.id);
  const course: Course = {
    id,
    title: String(req.body.title || "").trim(),
    description: String(req.body.description || "").trim(),
    teacherId,
    status: "draft",
    category: String(req.body.category || "General"),
    thumbnail: req.body.thumbnail || undefined,
    price: Number(req.body.price || 0),
    level: req.body.level || undefined,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    createdAt: now
  };
  if (!course.title || !course.description) return res.status(400).json({ error: "Title and description are required." });
  db.prepare(`
    INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(course.id, course.title, course.description, course.teacherId, course.status, course.category, course.thumbnail || null, course.price || 0, course.level || null, JSON.stringify(course.tags || []), null, course.createdAt);
  res.status(201).json(course);
});

app.post("/api/courses/:id/publish", requireAuth, requireRole(["admin", "super_admin", "academic"]), (req, res) => {
  const result = db.prepare("UPDATE courses SET status = 'published' WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Course not found." });
  res.json(courseFromRow(db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id)));
});

app.get("/api/enrollments", requireAuth, (req: AuthRequest, res) => {
  const rows = ["admin", "super_admin", "academic"].includes(req.user!.role)
    ? db.prepare("SELECT * FROM enrollments").all()
    : db.prepare("SELECT * FROM enrollments WHERE student_id = ?").all(req.user!.id);
  res.json((rows as any[]).map(enrollmentFromRow));
});

app.post("/api/enrollments/register", requireAuth, requireRole(["student"]), (req: AuthRequest, res) => {
  const courseId = String(req.body.courseId || "");
  const course = db.prepare("SELECT * FROM courses WHERE id = ? AND status = 'published'").get(courseId) as any;
  if (!course) return res.status(404).json({ error: "Published course not found." });
  const existing = db.prepare("SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?").get(courseId, req.user!.id);
  if (existing) return res.status(409).json({ error: "Enrollment already exists." });
  const enrollment: Enrollment = {
    id: generateId("enroll"),
    courseId,
    studentId: req.user!.id,
    status: Number(course.price || 0) > 0 ? "pending_payment" : "active",
    enrolledAt: new Date().toISOString()
  };
  db.prepare("INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)").run(enrollment.id, enrollment.courseId, enrollment.studentId, enrollment.status, enrollment.enrolledAt, null);
  res.status(201).json(enrollment);
});

app.post("/api/progress/toggle", requireAuth, requireRole(["student"]), (req: AuthRequest, res) => {
  const enrollmentId = String(req.body.enrollmentId || "");
  const lessonId = String(req.body.lessonId || "");
  const enrollment = db.prepare("SELECT * FROM enrollments WHERE id = ? AND student_id = ?").get(enrollmentId, req.user!.id);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  const existing = db.prepare("SELECT * FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?").get(enrollmentId, lessonId) as any;
  let progress: LessonProgress;
  if (existing) {
    const completed = existing.completed ? 0 : 1;
    const completedAt = completed ? new Date().toISOString() : null;
    db.prepare("UPDATE lesson_progress SET completed = ?, completed_at = ? WHERE id = ?").run(completed, completedAt, existing.id);
    progress = { id: existing.id, enrollmentId, lessonId, completed: Boolean(completed), completedAt: completedAt || undefined };
  } else {
    progress = { id: generateId("prog"), enrollmentId, lessonId, completed: true, completedAt: new Date().toISOString() };
    db.prepare("INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, ?, ?)").run(progress.id, enrollmentId, lessonId, 1, progress.completedAt);
  }
  res.json(progress);
});

app.post("/api/quizzes/submit", requireAuth, requireRole(["student"]), (req: AuthRequest, res) => {
  const quizId = String(req.body.quizId || "");
  const answers = (req.body.answers || {}) as Record<string, string>;
  const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(quizId) as any;
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  const questions = (db.prepare("SELECT * FROM questions WHERE quiz_id = ?").all(quizId) as any[]).map(questionFromRow);
  let correctCount = 0;
  for (const q of questions) {
    const studentAnswer = answers[q.id] || "";
    if (q.type === "text") {
      const keys = q.correctAnswer.toLowerCase().split(",").map(key => key.trim());
      if (keys.some(key => studentAnswer.toLowerCase().includes(key))) correctCount++;
    } else if (studentAnswer === q.correctAnswer) {
      correctCount++;
    }
  }
  const score = Math.round((correctCount / (questions.length || 1)) * 100);
  const passed = score >= quiz.passing_score;
  const attempt = {
    id: generateId("attempt"),
    quizId,
    studentId: req.user!.id,
    answers,
    score,
    passed,
    startedAt: req.body.startedAt || new Date().toISOString(),
    submittedAt: new Date().toISOString()
  };
  db.prepare("INSERT INTO quiz_attempts (id, quiz_id, student_id, answers_json, score, passed, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(attempt.id, quizId, req.user!.id, JSON.stringify(answers), score, passed ? 1 : 0, attempt.startedAt, attempt.submittedAt);
  res.status(201).json({ ...attempt, correctAnswers: correctCount, total: questions.length });
});

app.post("/api/assignments/grade", requireAuth, requireRole(["teacher", "admin", "super_admin"]), (req: AuthRequest, res) => {
  const submissionId = String(req.body.submissionId || "");
  const score = Number(req.body.score);
  const feedback = String(req.body.feedback || "");
  const submission = db.prepare(`
    SELECT s.*, a.max_score, c.teacher_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = ?
  `).get(submissionId) as any;
  if (!submission) return res.status(404).json({ error: "Submission not found." });
  if (req.user!.role === "teacher" && submission.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  if (Number.isNaN(score) || score < 0 || score > submission.max_score) return res.status(400).json({ error: "Invalid score." });
  db.prepare("UPDATE submissions SET score = ?, feedback = ?, graded_at = ? WHERE id = ?").run(score, feedback, new Date().toISOString(), submissionId);
  res.json({ id: submissionId, score, feedback });
});

app.get("/api/academics/warnings", requireAuth, (req: AuthRequest, res) => {
  const rows = ["admin", "super_admin", "academic", "advisor"].includes(req.user!.role)
    ? db.prepare("SELECT * FROM academic_warnings ORDER BY created_at DESC").all()
    : db.prepare("SELECT * FROM academic_warnings WHERE student_id = ? ORDER BY created_at DESC").all(req.user!.id);
  res.json((rows as any[]).map(row => ({
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    message: row.message,
    isResolved: Boolean(row.is_resolved),
    createdAt: row.created_at
  })));
});

app.post("/api/tuition/pay", requireAuth, requireRole(["finance", "admin", "super_admin"]), (req, res) => {
  const feeId = String(req.body.feeId || "");
  const paidAmount = Number(req.body.paidAmount || 0);
  const fee = db.prepare("SELECT * FROM tuition_fees WHERE id = ?").get(feeId) as any;
  if (!fee) return res.status(404).json({ error: "Tuition fee not found." });
  const totalPaid = Math.min(Number(fee.amount), Number(fee.paid_amount || 0) + paidAmount);
  const status: TuitionFee["status"] = totalPaid >= Number(fee.amount) ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
  const paidAt = status === "paid" ? new Date().toISOString() : fee.paid_at;
  const receiptCode = fee.receipt_code || `RC${Date.now()}`;
  db.prepare("UPDATE tuition_fees SET paid_amount = ?, status = ?, paid_at = ?, receipt_code = ? WHERE id = ?").run(totalPaid, status, paidAt, receiptCode, feeId);
  res.json({ id: feeId, paidAmount: totalPaid, status, paidAt, receiptCode });
});

// Setup Vite Dev Server / Static files serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
});
