import { Assignment, LMSDataStore, Quiz, QuizAttempt, Submission } from "./types";

export type CanonicalWarningType =
  | "low_gpa"
  | "low_attendance"
  | "unpaid_fee"
  | "exam_ban"
  | "overdue_assignment";

const WARNING_TYPE_ALIASES: Record<string, CanonicalWarningType> = {
  low_gpa: "low_gpa",
  "low-gpa": "low_gpa",
  low_attendance: "low_attendance",
  attendance: "low_attendance",
  unpaid_fee: "unpaid_fee",
  "unpaid-fee": "unpaid_fee",
  exam_ban: "exam_ban",
  overdue_assignment: "overdue_assignment",
  "overdue-assignment": "overdue_assignment"
};

export function normalizeWarningType(type: string): CanonicalWarningType {
  return WARNING_TYPE_ALIASES[type] ?? "low_gpa";
}

export function warningTypesMatch(a: string, b: string): boolean {
  return normalizeWarningType(a) === normalizeWarningType(b);
}

export function warningTypeLabel(type: string): string {
  switch (normalizeWarningType(type)) {
    case "low_attendance":
      return "Chuyên cần";
    case "low_gpa":
      return "Kết quả học tập";
    case "unpaid_fee":
      return "Học phí";
    case "exam_ban":
      return "Cấm thi";
    case "overdue_assignment":
      return "Bài tập quá hạn";
    default:
      return "Học thuật";
  }
}

export function percentToLetterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function percentToGradePoint(letterGrade: string): number {
  const map: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0, W: 0.0 };
  return map[letterGrade] ?? 0.0;
}

export type CourseGradeInputs = {
  quizScores: number[];
  assignmentScoresPercent: number[];
  hasCourseQuizzes: boolean;
  hasCourseAssignments: boolean;
  isPending: boolean;
};

export type CourseGradeResult = {
  finalPercent: number | null;
  hasGrades: boolean;
  assignmentAvg: number | null;
  quizAvg: number | null;
  letterGrade: string | null;
  gradePoint: number | null;
  countsForGpa: boolean;
};

export function calculateCourseGradePercent(input: CourseGradeInputs): CourseGradeResult {
  // Calculate averages correctly: if the course has items, but the array is empty, it means the student got 0 on all.
  const assignmentAvg = input.hasCourseAssignments
    ? (input.assignmentScoresPercent.length > 0
        ? Math.round(input.assignmentScoresPercent.reduce((sum, score) => sum + score, 0) / input.assignmentScoresPercent.length)
        : 0)
    : null;

  const quizAvg = input.hasCourseQuizzes
    ? (input.quizScores.length > 0
        ? Math.round(input.quizScores.reduce((sum, score) => sum + score, 0) / input.quizScores.length)
        : 0)
    : null;

  let finalPercent: number | null = null;
  if (assignmentAvg !== null && quizAvg !== null) {
    finalPercent = Math.round(assignmentAvg * 0.3 + quizAvg * 0.7);
  } else if (assignmentAvg !== null) {
    finalPercent = assignmentAvg;
  } else if (quizAvg !== null) {
    finalPercent = quizAvg;
  }

  if (finalPercent === null) {
    return {
      finalPercent: null,
      hasGrades: false,
      assignmentAvg,
      quizAvg,
      letterGrade: input.isPending ? "IP" : null,
      gradePoint: null,
      countsForGpa: false
    };
  }

  const letterGrade = input.isPending ? "IP" : percentToLetterGrade(finalPercent);
  return {
    finalPercent,
    hasGrades: true,
    assignmentAvg,
    quizAvg,
    letterGrade,
    gradePoint: input.isPending ? null : percentToGradePoint(letterGrade),
    countsForGpa: input.isPending ? false : finalPercent >= 60
  };
}

export function collectCourseGradeInputs(
  store: Pick<LMSDataStore, "quizzes" | "quizAttempts" | "assignments" | "submissions">,
  studentId: string,
  courseId: string
): CourseGradeInputs {
  let isPending = false;

  const courseQuizzes = store.quizzes.filter((quiz: Quiz) => quiz.courseId === courseId);
  const quizScores = courseQuizzes
    .map((quiz) => {
      const attempts = store.quizAttempts.filter(
        (attempt: QuizAttempt) => attempt.studentId === studentId && attempt.quizId === quiz.id
      );
      if (attempts.length > 0) return Math.max(...attempts.map((attempt) => attempt.score));
      if (quiz.deadline && new Date(quiz.deadline) > new Date()) {
        isPending = true;
        return null;
      }
      return 0;
    })
    .filter((score): score is number => score !== null);

  const courseAssignments = store.assignments.filter((assignment: Assignment) => assignment.courseId === courseId);
  const assignmentScoresPercent = courseAssignments
    .map((assignment) => {
      const submission = store.submissions.find(s => s.assignmentId === assignment.id && s.studentId === studentId);
      if (submission && submission.score !== undefined) {
        const maxScore = assignment.maxScore || 100;
        return Math.round((submission.score / maxScore) * 100);
      }
      if (assignment.deadline && new Date(assignment.deadline) > new Date()) {
        isPending = true;
        return null;
      }
      return 0; // Ungraded or unsubmitted gets 0
    })
    .filter((score): score is number => score !== null);

  return { 
    quizScores, 
    assignmentScoresPercent,
    hasCourseQuizzes: courseQuizzes.length > 0,
    hasCourseAssignments: courseAssignments.length > 0,
    isPending
  };
}
