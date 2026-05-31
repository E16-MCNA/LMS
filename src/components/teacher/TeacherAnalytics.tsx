import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";

interface ComponentProps {
  [key: string]: any;
}

export default function TeacherAnalytics(props: ComponentProps) {
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

  return (
    <>
        {/* Tab 5: Analytics metrics */}
        {activeSubTab === "analytics" && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white">Bảng Thống kê Hiệu suất Giáo dục & Đào tạo</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {myCourses.map(course => {
                const enrolledEnroll = store.enrollments.filter(e => e.courseId === course.id);
                const averageScoreRaw = store.quizAttempts.filter(qa => {
                  const quiz = store.quizzes.find(q => q.id === qa.quizId);
                  return quiz?.courseId === course.id;
                });
                const totalAvgQuiz = averageScoreRaw.reduce((sum, qa) => sum + qa.score, 0) / (averageScoreRaw.length || 1);

                return (
                  <div key={course.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-white/20 transition backdrop-blur-md">
                    <span className="text-[10px] font-mono text-white/40 block pb-1 border-b border-white/5 truncate uppercase">
                      Chi tiết Đánh giá Khóa học
                    </span>
                    <h5 className="font-display font-bold text-white text-sm my-2 truncate">{course.title}</h5>

                    <div className="space-y-3.5 pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Lượt đăng ký học</span>
                        <span className="font-mono text-white font-bold">{enrolledEnroll.length} học viên</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Điểm kiểm tra trung bình</span>
                        <span className="font-mono text-cyan-300 font-bold">{Math.round(totalAvgQuiz)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Trạng thái Phê duyệt</span>
                        <span className="text-indigo-200 uppercase font-mono text-[10px] bg-white/5 py-0.5 px-2 rounded-full border border-white/10 font-bold">
                          {course.status === "published" ? "Đã duyệt" : course.status === "pending" ? "Chờ duyệt" : course.status === "rejected" ? "Bị từ chối" : "Bản nháp"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {myCourses.length === 0 && (
                <div className="col-span-full text-center py-16 text-white/40">
                  Chưa có dữ liệu thống kê. Vui lòng khởi tạo chương trình đào tạo của bạn trước.
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
}
