import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";

interface ComponentProps {
  [key: string]: any;
}

export default function GradebookTable(props: ComponentProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
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

  const enrolledStudents = store.enrollments.filter((e: any) => myCourseIds.includes(e.courseId));
  const filteredStudents = enrolledStudents.filter((enroll: any) => {
    const studentUser = store.users.find((u: any) => u.id === enroll.studentId);
    if (!studentUser) return false;
    return !searchTerm ||
      studentUser.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      studentUser.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <>
        {/* Tab 4: Student gradebook matrix table & CSV Export */}
        {activeSubTab === "gradebook" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-display font-semibold text-white">Sổ điểm Tổng hợp & Kiểm định Tiến trình</h4>
                <p className="text-xs text-white/40">Thống kê tiến độ xem bài giảng và điểm thi trung bình của học viên đăng ký.</p>
              </div>

              <button
                onClick={handleExportCSVGradebook}
                disabled={studentSubmissionsRaw.length === 0}
                className="px-4 py-2 text-xs font-bold text-indigo-950 bg-white hover:bg-white/95 rounded-xl disabled:bg-white/20 disabled:text-white/40 flex items-center gap-1.5 transition duration-150 cursor-pointer"
              >
                <Download className="h-4 w-4" /> Xuất bảng điểm CSV
              </button>
            </div>

            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs">
              <input
                type="text"
                placeholder="Tìm kiếm học viên theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80 font-sans">
                <thead className="bg-white/5 border-b border-white/10 text-white uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="p-4 font-semibold">Tên Học sinh</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Tiến độ bài học</th>
                    <th className="p-4 font-semibold text-right flex-shrink-0">Tóm tắt trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStudents.map((enroll, i) => {
                    const studentUser = store.users.find((u: any) => u.id === enroll.studentId);
                    const completedLessons = store.lessonProgress.filter((p: any) => p.enrollmentId === enroll.id && p.completed).length;
                    const totalLessons = store.lessons.filter((l: any) => l.courseId === enroll.courseId).length;

                    return (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-medium text-white">{studentUser?.name || "Không xác định"}</td>
                        <td className="p-4 font-mono text-white/50">{studentUser?.email || "Không xác định"}</td>
                        <td className="p-4 text-xs font-mono">
                          Đã hoàn thành {completedLessons}/{totalLessons} bài học
                        </td>
                        <td className="p-4 text-right text-[11px] text-indigo-300 font-medium">
                          Học viên đang hoạt động
                        </td>
                      </tr>
                    );
                  })}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-white/40 italic">
                        {enrolledStudents.length === 0 ? "Chưa có học sinh đăng ký các khóa học này." : "Không tìm thấy học sinh nào phù hợp."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

    </>
  );
}
