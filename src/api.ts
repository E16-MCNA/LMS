import { LMSDataStore } from "./types";

export function setCsrfToken(token: string | null) {
  if (token) {
    sessionStorage.setItem("mcna_lms_csrf", token);
    sessionStorage.setItem("e16_lms_csrf", token);
  } else {
    sessionStorage.removeItem("mcna_lms_csrf");
    sessionStorage.removeItem("e16_lms_csrf");
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  getStore: () => apiFetch<LMSDataStore>("/api/store"),
  getAdminDashboard: () => apiFetch("/api/dashboard/admin"),
  getTeacherDashboard: () => apiFetch("/api/dashboard/teacher"),
  getStudentDashboard: () => apiFetch("/api/dashboard/student"),
  getFinanceDashboard: () => apiFetch("/api/dashboard/finance"),
  getAcademicDashboard: () => apiFetch("/api/dashboard/academic"),
  getAdvisorDashboard: () => apiFetch("/api/dashboard/advisor"),
  getParentDashboard: () => apiFetch("/api/dashboard/parent"),
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      headers: {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      },
      body: formData
    });
    if (!response.ok) throw new Error("File upload failed");
    return response.json() as Promise<{ url: string }>;
  },
  getCourses: () => apiFetch("/api/courses"),
  createCourse: (payload: unknown) => apiFetch("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  submitCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}/submit`, { method: "POST" }),
  publishCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}/publish`, { method: "POST" }),
  rejectCourse: (courseId: string, rejectionReason: string) => apiFetch(`/api/courses/${courseId}/reject`, { method: "POST", body: JSON.stringify({ rejectionReason }) }),
  deleteCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}`, { method: "DELETE" }),
  addLesson: (payload: unknown) => apiFetch("/api/lessons", { method: "POST", body: JSON.stringify(payload) }),
  getEnrollments: () => apiFetch("/api/enrollments"),
  registerEnrollment: (courseId: string) => apiFetch("/api/enrollments/register", { method: "POST", body: JSON.stringify({ courseId }) }),
  toggleProgress: (payload: { enrollmentId: string; lessonId: string }) => apiFetch("/api/progress/toggle", { method: "POST", body: JSON.stringify(payload) }),
  createQuiz: (payload: unknown) => apiFetch("/api/quizzes", { method: "POST", body: JSON.stringify(payload) }),
  addQuestion: (quizId: string, payload: unknown) => apiFetch(`/api/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(payload) }),
  updateQuestion: (questionId: string, payload: unknown) => apiFetch(`/api/questions/${questionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQuestion: (questionId: string) => apiFetch(`/api/questions/${questionId}`, { method: "DELETE" }),
  submitQuiz: (payload: { quizId: string; answers: Record<string, string>; startedAt?: string }) => apiFetch("/api/quizzes/submit", { method: "POST", body: JSON.stringify(payload) }),
  createAssignment: (payload: unknown) => apiFetch("/api/assignments", { method: "POST", body: JSON.stringify(payload) }),
  submitAssignment: (payload: { assignmentId: string; content: string; attachmentUrl?: string }) => apiFetch<LMSDataStore["submissions"][number]>("/api/assignments/submit", { method: "POST", body: JSON.stringify(payload) }),
  gradeAssignment: (payload: { submissionId: string; score: number; feedback: string }) => apiFetch("/api/assignments/grade", { method: "POST", body: JSON.stringify(payload) }),
  createUser: (payload: unknown) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  setUserStatus: (userId: string, isActive: boolean) => apiFetch(`/api/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  getWarnings: () => apiFetch("/api/academics/warnings"),
  createWarning: (payload: unknown) => apiFetch("/api/academics/warnings", { method: "POST", body: JSON.stringify(payload) }),
  resolveWarning: (warningId: string) => apiFetch(`/api/academics/warnings/${warningId}/resolve`, { method: "POST" }),
  addAdvisorNote: (payload: unknown) => apiFetch("/api/advisor/notes", { method: "POST", body: JSON.stringify(payload) }),
  payTuition: (payload: { feeId: string; paidAmount: number }) => apiFetch("/api/tuition/pay", { method: "POST", body: JSON.stringify(payload) }),
  confirmTransfer: (payload: { feeId: string; amount: number }) => apiFetch<{ ok: boolean; transactionId: string }>("/api/tuition/confirm-transfer", { method: "POST", body: JSON.stringify(payload) }),
  reviewTransaction: (transactionId: string, payload: { status: "approved" | "rejected"; notes?: string }) => apiFetch(`/api/finance/transactions/${transactionId}/review`, { method: "PATCH", body: JSON.stringify(payload) }),
  bulkIssueTuition: (payload: { semesterId: string; amount?: number; dueDate?: string }) => apiFetch<{ createdCount: number; fees: any[] }>("/api/finance/tuition/bulk-issue", { method: "POST", body: JSON.stringify(payload) }),
  scanOverdueTuition: () => apiFetch<{ overdueCount: number; fees: any[] }>("/api/finance/tuition/scan-overdue", { method: "POST" }),
  createCourseSection: (payload: unknown) => apiFetch("/api/course-sections", { method: "POST", body: JSON.stringify(payload) }),
  updateCourseSection: (sectionId: string, payload: unknown) => apiFetch(`/api/course-sections/${sectionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCourseSection: (sectionId: string) => apiFetch(`/api/course-sections/${sectionId}`, { method: "DELETE" }),
  saveAttendance: (payload: unknown) => apiFetch("/api/attendance/sessions", { method: "POST", body: JSON.stringify(payload) }),
  updateAttendanceRecord: (payload: unknown) => apiFetch("/api/attendance/records", { method: "PATCH", body: JSON.stringify(payload) }),
  generateAttendanceLink: (payload: { courseId: string; semesterId?: string; topic: string }) => apiFetch<{ session: any; code: string; expiresAt: string }>("/api/attendance/sessions/generate-link", { method: "POST", body: JSON.stringify(payload) }),
  selfCheckin: (payload: { sessionId: string; code: string }) => apiFetch<{ ok: boolean; record: any }>("/api/attendance/self-checkin", { method: "POST", body: JSON.stringify(payload) }),
  updateStudentProfile: (payload: unknown) => apiFetch("/api/student/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  updateStudentNotes: (studentId: string, notes: string) => apiFetch(`/api/advisor/student-profile/${studentId}`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  markNotificationRead: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
  resetPassword: (userId: string) => apiFetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" }),
  teacherCheckin: (payload: { courseId: string; sectionId: string; slotTime: string; classDate: string }) => apiFetch<{ ok: boolean; record: any }>("/api/attendance/teacher-checkin", { method: "POST", body: JSON.stringify(payload) }),
  warnTeacher: (payload: { courseId: string; teacherId: string }) => apiFetch<{ ok: boolean }>("/api/attendance/warn-teacher", { method: "POST", body: JSON.stringify(payload) }),
  createForumPost: (courseId: string, payload: { title: string; content: string }) => apiFetch(`/api/courses/${courseId}/forum`, { method: "POST", body: JSON.stringify({ courseId, ...payload }) }),
  createForumReply: (postId: string, payload: { content: string }) => apiFetch(`/api/forum/posts/${postId}/replies`, { method: "POST", body: JSON.stringify(payload) })
};
