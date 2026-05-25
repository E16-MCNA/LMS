import express from "express";
import { ZodSchema, z } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", issues: z.treeifyError(parsed.error) });
    }
    req.body = parsed.data;
    next();
  };
}

export const schemas = {
  login: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1)
  }),
  createUser: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8),
    name: z.string().trim().min(1),
    role: z.enum(["admin", "super_admin", "teacher", "student", "le_tan", "academic", "finance", "advisor", "parent"]),
    phone: z.string().trim().optional(),
    linkedStudentId: z.string().trim().optional()
  }),
  setUserActive: z.object({
    isActive: z.boolean()
  }),
  createCourse: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    teacherId: z.string().trim().optional(),
    category: z.string().trim().min(1).default("General"),
    thumbnail: z.string().trim().optional(),
    price: z.coerce.number().min(0).default(0),
    level: z.string().trim().optional(),
    tags: z.array(z.string().trim()).default([])
  }),
  rejectCourse: z.object({
    rejectionReason: z.string().trim().min(1)
  }),
  addLesson: z.object({
    courseId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    videoUrl: z.string().trim().optional(),
    order: z.coerce.number().int().min(0),
    duration: z.string().trim().min(1)
  }),
  createQuiz: z.object({
    courseId: z.string().trim().min(1),
    lessonId: z.string().trim().optional(),
    title: z.string().trim().min(1),
    passingScore: z.coerce.number().min(0).max(100),
    timeLimit: z.coerce.number().int().min(1),
    maxAttempts: z.coerce.number().int().min(1)
  }),
  addQuestion: z.object({
    text: z.string().trim().min(1),
    type: z.enum(["single", "multiple", "text"]),
    options: z.array(z.string()).default([]),
    correctAnswer: z.string().trim().min(1)
  }),
  registerEnrollment: z.object({
    courseId: z.string().trim().min(1)
  }),
  toggleProgress: z.object({
    enrollmentId: z.string().trim().min(1),
    lessonId: z.string().trim().min(1)
  }),
  submitQuiz: z.object({
    quizId: z.string().trim().min(1),
    answers: z.record(z.string(), z.string()).default({}),
    startedAt: z.string().trim().optional()
  }),
  createAssignment: z.object({
    courseId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    deadline: z.string().trim().min(1),
    maxScore: z.coerce.number().min(1)
  }),
  submitAssignment: z.object({
    assignmentId: z.string().trim().min(1),
    content: z.string().trim().min(1)
  }),
  gradeAssignment: z.object({
    submissionId: z.string().trim().min(1),
    score: z.coerce.number().min(0),
    feedback: z.string().trim().default("")
  }),
  payTuition: z.object({
    feeId: z.string().trim().min(1),
    paidAmount: z.coerce.number().positive()
  }),
  createWarning: z.object({
    studentId: z.string().trim().min(1),
    type: z.enum(["low-gpa", "attendance", "unpaid-fee", "overdue-assignment"]),
    message: z.string().trim().min(1)
  }),
  addAdvisorNote: z.object({
    studentId: z.string().trim().min(1),
    content: z.string().trim().min(1),
    type: z.enum(["academic", "behavioral", "financial"])
  })
};
