import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
}

export default function AssignmentGrader(props: ComponentProps) {
  const [submissionSearch, setSubmissionSearch] = React.useState("");
  const [courseDetailId, setCourseDetailId] = React.useState<string | null>(null);

  // Sorting state for student submissions grading table
  const [subSortField, setSubSortField] = React.useState<string>("studentName");
  const [subSortOrder, setSubSortOrder] = React.useState<"asc" | "desc">("asc");

  const handleSubSort = (field: string) => {
    if (subSortField === field) {
      setSubSortOrder(subSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSubSortField(field);
      setSubSortOrder("asc");
    }
  };
  const {
    activeSubTab,
    setActiveSubTab,
    selectedCourseId,
    setSelectedCourseId,
    selectedQuizId,
    setSelectedQuizId,
    showCourseModal,
    setShowCourseModal,
    courseModalMode,
    courseTitle,
    setCourseTitle,
    courseDesc,
    setCourseDesc,
    courseCategory,
    setCourseCategory,
    courseThumb,
    setCourseThumb,
    coursePrice,
    setCoursePrice,
    courseLevel,
    setCourseLevel,
    courseTags,
    setCourseTags,
    showLessonModal,
    setShowLessonModal,
    lessonTitle,
    setLessonTitle,
    lessonContent,
    setLessonContent,
    lessonVideo,
    setLessonVideo,
    lessonDuration,
    setLessonDuration,
    showQuizModal,
    setShowQuizModal,
    quizTitle,
    setQuizTitle,
    quizPassing,
    setQuizPassing,
    quizLimit,
    setQuizLimit,
    quizAttempts,
    setQuizAttempts,
    showQuestionModal,
    setShowQuestionModal,
    qText,
    setQText,
    qType,
    setQType,
    qOptions,
    setQOptions,
    qCorrect,
    setQCorrect,
    showAssignModal,
    setShowAssignModal,
    assignTitle,
    setAssignTitle,
    assignDesc,
    setAssignDesc,
    assignDeadline,
    setAssignDeadline,
    assignMaxScore,
    setAssignMaxScore,
    activeSubmissionId,
    setActiveSubmissionId,
    gradingScore,
    setGradingScore,
    gradingFeedback,
    setGradingFeedback,
    store,
    currentUser,
    myCourses,
    myCourseIds,
    handleOpenCreateCourse,
    handleOpenEditCourse,
    handleSaveCourse,
    handleSubmitCourseForApproval,
    handleAddLessonSubmit,
    handleAddQuizSubmit,
    handleAddQuestionSubmit,
    handleAddAssignmentSubmit,
    handleGradeSubmission,
    handleExportCSVGradebook,
    activeCourse,
    lessons,
    courseQuizzes,
    courseAssignments,
    myAssignments,
    studentSubmissionsRaw
  } = props;

  const filteredSubmissions = studentSubmissionsRaw.filter((sub: any) => {
    const student = store.users.find((u: any) => u.id === sub.studentId);
    const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
    return !submissionSearch ||
      (student?.name || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (challenge?.title || "").toLowerCase().includes(submissionSearch.toLowerCase());
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a: any, b: any) => {
    if (!subSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    const studentA = store.users.find((u: any) => u.id === a.studentId);
    const studentB = store.users.find((u: any) => u.id === b.studentId);
    const challengeA = store.assignments.find((ea: any) => ea.id === a.assignmentId);
    const challengeB = store.assignments.find((ea: any) => ea.id === b.assignmentId);

    if (subSortField === "studentName") {
      valA = studentA?.name || "";
      valB = studentB?.name || "";
    } else if (subSortField === "challengeTitle") {
      valA = challengeA?.title || "";
      valB = challengeB?.title || "";
    } else if (subSortField === "submittedAt") {
      valA = new Date(a.submittedAt).getTime();
      valB = new Date(b.submittedAt).getTime();
    } else if (subSortField === "score") {
      valA = a.score !== undefined ? a.score : -1;
      valB = b.score !== undefined ? b.score : -1;
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return subSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return subSortOrder === "asc" ? valA - valB : valB - valA;
  });

  return (
    <>
        {/* Tab 3: Assignments list & Student submissions grading cockpit */}
        {activeSubTab === "assignments" && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white">Bảng Chấm điểm Bài tự luận của Học viên</h4>

            {/* Submissions Search Input bar */}
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs max-w-sm">
              <input
                type="text"
                placeholder="Tìm tên học viên hoặc tên bài tập..."
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="space-y-6">
              {myCourses.map(course => {
                const courseAssignments = store.assignments.filter((a: any) => a.courseId === course.id);
                const courseAssignmentIds = courseAssignments.map((a: any) => a.id);
                const courseSubmissions = sortedSubmissions.filter((sub: any) => courseAssignmentIds.includes(sub.assignmentId));
                
                if (courseSubmissions.length === 0) return null;
                
                return (
                  <div key={course.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <div>
                        <h5 className="text-sm font-bold text-indigo-300 font-display">📖 {course.title}</h5>
                        <p className="text-[10px] text-white/40">Phân loại: {course.category} · Tổng số {courseSubmissions.length} bài nộp</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-white/80 font-sans border-collapse">
                        <thead className="bg-white/2 border-b border-white/5 text-white uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-white transition" onClick={() => handleSubSort("studentName")}>
                              Tên Học viên {subSortField === "studentName" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-white transition" onClick={() => handleSubSort("challengeTitle")}>
                              Bài tập Thử thách {subSortField === "challengeTitle" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-white transition" onClick={() => handleSubSort("submittedAt")}>
                              Ngày nộp {subSortField === "submittedAt" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-white transition" onClick={() => handleSubSort("score")}>
                              Điểm số đạt được {subSortField === "score" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold text-right">Hành động Chấm điểm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {courseSubmissions.map((sub: any) => {
                            const student = store.users.find((u: any) => u.id === sub.studentId);
                            const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
                            
                            return (
                              <tr key={sub.id} className="hover:bg-white/2 transition-colors">
                                <td className="p-3.5 font-medium text-white">{student?.name || "Học viên ẩn danh"}</td>
                                <td className="p-3.5 font-bold text-indigo-200">
                                  <div className="flex items-center gap-1.5">
                                    <span>{challenge?.title || "Không xác định"}</span>
                                    {challenge && (
                                      <button
                                        onClick={() => setCourseDetailId(challenge.courseId)}
                                        className="px-1.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer font-sans"
                                      >
                                        Xem 👁️
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5 text-white/50">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="p-3.5">
                                  {sub.score !== undefined ? (
                                    <span className="text-emerald-400 font-bold font-mono">
                                      {sub.score}/{challenge?.maxScore || 100}
                                    </span>
                                  ) : (
                                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      Chưa chấm điểm
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 text-right">
                                  <button
                                    onClick={() => {
                                      setActiveSubmissionId(sub.id);
                                      setGradingScore(sub.score ?? challenge?.maxScore ?? 100);
                                      setGradingFeedback(sub.feedback ?? "");
                                    }}
                                    className="p-1 px-3 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white border border-white/15 rounded-lg cursor-pointer transition"
                                  >
                                    {sub.score !== undefined ? "Cập nhật Điểm" : "Chấm điểm & Nhận xét"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {studentSubmissionsRaw.filter((sub: any) => {
                const student = store.users.find((u: any) => u.id === sub.studentId);
                const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
                return !submissionSearch ||
                  (student?.name || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
                  (challenge?.title || "").toLowerCase().includes(submissionSearch.toLowerCase());
              }).length === 0 && (
                <div className="text-center py-12 text-white/40 bg-white/5 border border-white/10 rounded-2xl">
                  {studentSubmissionsRaw.length === 0 ? "Hiện chưa có học viên nào nộp bài tự luận cho các bài tập được giao." : "Không tìm thấy bài nộp nào phù hợp với bộ lọc."}
                </div>
              )}
            </div>
          </div>
        )}

      {/* MODAL 5: CREATE ASSIGNMENT FORM */}
      {showAssignModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <FileText className="h-5 w-5 text-indigo-400" /> Tạo Thử thách Bài tự luận Khóa học
            </h3>

            <form onSubmit={handleAddAssignmentSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Chọn Khóa học</label>
                <select
                  required
                  value={selectedCourseId || ""}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-sans"
                >
                  <option value="">-- Chọn khóa học --</option>
                  {myCourses.map((c: any) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tiêu đề Thử thách bài tập</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết lập Express Routing Controller"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Hạn chót Hoàn thành</label>
                  <input
                    type="datetime-local"
                    required
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Điểm tối đa</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={assignMaxScore}
                    onChange={(e) => setAssignMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Mô tả / Yêu cầu chi tiết</label>
                <textarea
                  required
                  placeholder="Dán các định dạng file hoặc yêu cầu nộp sản phẩm..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-24 max-h-32 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Kích hoạt Thử thách
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL 6: EVALUATE & GRADE FORM */}
      {activeSubmissionId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setActiveSubmissionId(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Award className="h-5 w-5 text-indigo-400" /> Chấm điểm & Nhận xét Sản phẩm
            </h3>

            {(() => {
              const sub = store.submissions.find(s => s.id === activeSubmissionId);
              const chal = store.assignments.find(a => a.id === sub?.assignmentId);
              const stud = store.users.find(u => u.id === sub?.studentId);
              return (
                <form onSubmit={handleGradeSubmission} className="space-y-4 text-xs">
                  <div className="bg-slate-100 rounded-xl p-3 border border-slate-300 space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Nội dung bài làm ({stud?.name})</span>
                    <p className="text-slate-800 leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-y-auto pr-1">
                      {sub?.content ? sub.content.replace(/\s*\[Attachment:[^\]]+\]/g, "").replace(/\s*\[Tệp đính kèm:[^\]]+\]/g, "") : ""}
                    </p>

                    {(() => {
                      let extractedUrl = sub?.attachmentUrl;
                      if (!extractedUrl && sub?.content) {
                        const match = sub.content.match(/\[Attachment:\s*([^\]]+)\]/) || sub.content.match(/\[Tệp đính kèm:\s*([^\]]+)\]/);
                        if (match) {
                          const val = match[1].trim();
                          if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/")) {
                            extractedUrl = val;
                          }
                        }
                      }
                      if (!extractedUrl) return null;

                      return (
                        <div className="mt-3 pt-3 border-t border-slate-300 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Tệp đính kèm:</span>
                          <a 
                            href={extractedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition text-[10px] font-bold cursor-pointer font-sans decoration-none"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Tải / Xem file bài làm
                          </a>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nhập Điểm số (Tối đa: {chal?.maxScore || 100})</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={chal?.maxScore || 100}
                      value={gradingScore}
                      onChange={(e) => setGradingScore(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Góp ý & Nhận xét của Giảng viên</label>
                    <textarea
                      required
                      placeholder="Ví dụ: Ý tưởng tốt, cách trình bày rõ ràng, cần tối ưu thêm mã nguồn."
                      value={gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      className="w-full px-3 py-2 bg-white text-slate-900 h-20 max-h-32 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSubmissionId(null)}
                      className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 transition cursor-pointer font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
                    >
                      Hoàn tất Chấm điểm
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Premium glassmorphic Course Details consultation modal */}
      {courseDetailId && (() => {
        const course = store.courses.find((c: any) => c.id === courseDetailId);
        if (!course) return null;
        const teacher = store.users.find((u: any) => u.id === course.teacherId) || { name: "Chưa phân công" };
        const lessons = store.lessons.filter((l: any) => l.courseId === course.id).sort((a: any, b: any) => a.order - b.order);
        const quizzes = store.quizzes.filter((q: any) => q.courseId === course.id);
        const assignments = store.assignments.filter((a: any) => a.courseId === course.id);
        const formatVND = (num: number) => {
          return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
        };
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto text-white">
            <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 text-white font-sans max-h-[85vh] overflow-y-auto flex flex-col justify-between">
              <div className="space-y-5 text-left">
                <div className="flex justify-between items-start border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                      {course.category}
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">{course.title}</h3>
                    <p className="text-xs text-white/40 mt-1">Giảng viên: <strong className="text-indigo-200">{teacher.name}</strong></p>
                  </div>
                  <button 
                    onClick={() => setCourseDetailId(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/50 cursor-pointer font-sans text-white bg-transparent border-none"
                  >
                    <span className="text-lg font-bold">✕</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-white/2 p-4 rounded-xl border border-white/5 font-sans">
                  <div>
                    <span className="text-white/45 block">Học phí:</span>
                    <strong className="text-sm font-mono text-emerald-400 font-black">{course.price ? formatVND(course.price) : "Miễn phí"}</strong>
                  </div>
                  <div>
                    <span className="text-white/45 block">Cấp trình độ:</span>
                    <strong className="text-indigo-300 capitalize">{course.level || "Cơ bản"}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-white/45 font-bold uppercase block">Mô tả khóa đào tạo:</span>
                  <p className="text-xs text-white/70 leading-relaxed bg-black/15 p-3 rounded-lg border border-white/5 font-sans">{course.description}</p>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] text-white/45 font-bold uppercase flex items-center gap-1 font-sans">
                    Khung chương trình ({lessons.length} bài học, {quizzes.length} bài thi, {assignments.length} tự luận)
                  </span>
                  
                  {lessons.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-sans">
                      {lessons.map((lesson: any, idx: number) => (
                        <div key={lesson.id} className="p-2.5 bg-white/3 border border-white/5 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-white/90">Bài {idx + 1}: {lesson.title}</span>
                          <span className="text-[10px] text-white/40 font-mono">{lesson.duration || "15 phút"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/35 italic font-sans">Chưa tải giáo trình bài giảng cho lớp học này.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 mt-5 flex justify-end">
                <button
                  onClick={() => setCourseDetailId(null)}
                  className="px-4 py-2 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-100 transition text-xs cursor-pointer font-sans"
                >
                  Đóng thông tin
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </>
  );
}
