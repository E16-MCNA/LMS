import { getInitialStore } from "../../store";
import { Course, Enrollment, LessonProgress, User } from "../../types";
import { Queryable } from "../db";
import { assignmentFromRow, courseFromRow, DbUserRow, enrollmentFromRow, questionFromRow, quizAttemptFromRow, quizFromRow, submissionFromRow, toPublicUser, tuitionFeeFromRow, academicWarningFromRow } from "../mappers";

export async function storeSnapshotFromDb(db: Queryable) {
  const users = (await db.query<DbUserRow>("SELECT * FROM users")).rows.map(toPublicUser);
  const courses = (await db.query("SELECT * FROM courses")).rows.map(courseFromRow);
  const lessons = (await db.query("SELECT * FROM lessons")).rows.map(row => ({ id: row.id, courseId: row.course_id, title: row.title, content: row.content, videoUrl: row.video_url || undefined, order: row.lesson_order, duration: row.duration }));
  const enrollments = (await db.query("SELECT * FROM enrollments")).rows.map(enrollmentFromRow);
  const lessonProgress = (await db.query("SELECT * FROM lesson_progress")).rows.map(row => ({ id: row.id, enrollmentId: row.enrollment_id, lessonId: row.lesson_id, completed: Boolean(row.completed), completedAt: row.completed_at || undefined }));
  const quizzes = (await db.query("SELECT * FROM quizzes")).rows.map(quizFromRow);
  const questions = (await db.query("SELECT * FROM questions")).rows.map(questionFromRow);
  const quizAttempts = (await db.query("SELECT * FROM quiz_attempts")).rows.map(quizAttemptFromRow);
  const assignments = (await db.query("SELECT * FROM assignments")).rows.map(assignmentFromRow);
  const submissions = (await db.query("SELECT * FROM submissions")).rows.map(submissionFromRow);
  const tuitionFees = (await db.query("SELECT * FROM tuition_fees")).rows.map(tuitionFeeFromRow);
  const academicWarnings = (await db.query("SELECT * FROM academic_warnings")).rows.map(academicWarningFromRow);
  const auditLogs = (await db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200")).rows.map(row => ({ id: row.id, userId: row.user_id, action: row.action, target: row.target, detail: row.detail || "", createdAt: row.created_at }));
  return { ...getInitialStore(), users, courses, lessons, enrollments, lessonProgress, quizzes, questions, quizAttempts, assignments, submissions, tuitionFees, academicWarnings, auditLogs };
}

export function limitStoreForRole(store: any, user: User) {
  if (user.role === "admin" || user.role === "super_admin" || user.role === "academic") {
    return {
      ...store,
      users: store.users.map((item: User) => ({ ...item, passwordHash: "" }))
    };
  }

  if (user.role === "teacher") {
    const teacherCourseIds = new Set(store.courses.filter((course: Course) => course.teacherId === user.id).map((course: Course) => course.id));
    const visibleEnrollments = store.enrollments.filter((item: Enrollment) => teacherCourseIds.has(item.courseId));
    const visibleStudentIds = new Set(visibleEnrollments.map((item: Enrollment) => item.studentId));
    visibleStudentIds.add(user.id);
    return {
      ...store,
      users: store.users.filter((item: User) => visibleStudentIds.has(item.id) || item.id === user.id).map((item: User) => ({ ...item, passwordHash: "" })),
      courses: store.courses.filter((course: Course) => teacherCourseIds.has(course.id)),
      enrollments: visibleEnrollments,
      lessonProgress: store.lessonProgress.filter((item: LessonProgress) => visibleEnrollments.some((enroll: Enrollment) => enroll.id === item.enrollmentId)),
      quizzes: store.quizzes.filter((quiz: any) => teacherCourseIds.has(quiz.courseId)),
      assignments: store.assignments.filter((assignment: any) => teacherCourseIds.has(assignment.courseId)),
      submissions: store.submissions.filter((submission: any) => visibleStudentIds.has(submission.studentId))
    };
  }

  if (user.role === "student") {
    const myEnrollments = store.enrollments.filter((item: Enrollment) => item.studentId === user.id);
    const myCourseIds = new Set(myEnrollments.map((item: Enrollment) => item.courseId));
    return {
      ...store,
      users: store.users.filter((item: User) => item.id === user.id).map((item: User) => ({ ...item, passwordHash: "" })),
      enrollments: myEnrollments,
      lessonProgress: store.lessonProgress.filter((item: LessonProgress) => myEnrollments.some((enroll: Enrollment) => enroll.id === item.enrollmentId)),
      quizAttempts: store.quizAttempts.filter((item: any) => item.studentId === user.id),
      submissions: store.submissions.filter((item: any) => item.studentId === user.id),
      tuitionFees: store.tuitionFees.filter((item: any) => item.studentId === user.id),
      academicWarnings: store.academicWarnings.filter((item: any) => item.studentId === user.id),
      assignments: store.assignments.filter((item: any) => myCourseIds.has(item.courseId))
    };
  }

  return {
    ...store,
    users: store.users.filter((item: User) => item.id === user.id).map((item: User) => ({ ...item, passwordHash: "" }))
  };
}
