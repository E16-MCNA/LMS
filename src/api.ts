import { LMSDataStore } from "./types";

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  getCourses: () => apiFetch("/api/courses"),
  createCourse: (payload: unknown) => apiFetch("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  publishCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}/publish`, { method: "POST" }),
  getEnrollments: () => apiFetch("/api/enrollments"),
  registerEnrollment: (courseId: string) => apiFetch("/api/enrollments/register", { method: "POST", body: JSON.stringify({ courseId }) }),
  toggleProgress: (payload: { enrollmentId: string; lessonId: string }) => apiFetch("/api/progress/toggle", { method: "POST", body: JSON.stringify(payload) }),
  submitQuiz: (payload: { quizId: string; answers: Record<string, string>; startedAt?: string }) => apiFetch("/api/quizzes/submit", { method: "POST", body: JSON.stringify(payload) }),
  gradeAssignment: (payload: { submissionId: string; score: number; feedback: string }) => apiFetch("/api/assignments/grade", { method: "POST", body: JSON.stringify(payload) }),
  getWarnings: () => apiFetch("/api/academics/warnings"),
  payTuition: (payload: { feeId: string; paidAmount: number }) => apiFetch("/api/tuition/pay", { method: "POST", body: JSON.stringify(payload) })
};
