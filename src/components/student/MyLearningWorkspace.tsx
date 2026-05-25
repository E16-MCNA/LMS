import React from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert } from "lucide-react";
import { AppStore } from "../../store";

interface ComponentProps {
  [key: string]: any;
}

export default function MyLearningWorkspace(props: ComponentProps) {
  const {
    activeSubTab,
    setActiveSubTab,
    viewingCourseId,
    setViewingCourseId,
    filteredCatalog,
    catalogSearch,
    setCatalogSearch,
    catalogCategory,
    setCatalogCategory,
    myEnrolledCourseIds,
    store,
    handleEnrollIntoCourse,
    setLearningCourseId,
    myEnrollments,
    currentUser,
    setActiveLessonId,
    handleToggleLessonComplete,
    learningCourseId,
    currentLearningCourse,
    currentLearningLessons,
    activeLearningEnrollment,
    activeLessonId,
    currentLessonContentObj,
    handleStartQuiz,
    setSubmittingAssignmentId,
    setSubmissionCodeText,
    submittingAssignmentId,
    submissionCodeText,
    handleSendAssignmentSubmit,
    quizTimeRemaining,
    activeQuizId,
    setActiveQuizId,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    quizAnswers,
    quizFinishedState,
    handleSelectQuizAnswer,
    handleAutoSubmitQuiz,
    showProfileEditForm,
    setShowProfileEditForm,
    myProfile,
    editPhone,
    setEditPhone,
    editBirth,
    setEditBirth,
    editGender,
    setEditGender,
    editAddress,
    setEditAddress,
    editParent,
    setEditParent,
    editParentPhone,
    setEditParentPhone,
    onRefreshData,
    triggerToast,
    showPrintTranscript,
    setShowPrintTranscript,
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  } = props;

  return (
    <>
        {/* Tab 2: Registered Courses checklist (My Learning) */}
        {activeSubTab === "learning" && !learningCourseId && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white">Khóa học Đào tạo của tôi</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myEnrollments.map(enroll => {
                const course = store.courses.find(c => c.id === enroll.courseId);
                if (!course) return null;
                const totalLessonsCount = store.lessons.filter(l => l.courseId === course.id).length;
                const completedProgress = store.lessonProgress.filter(p => p.enrollmentId === enroll.id && p.completed).length;
                const percentage = totalLessonsCount ? Math.round((completedProgress / totalLessonsCount) * 100) : 0;

                return (
                  <div key={enroll.id} className="bg-white/5 border border-white/10 hover:border-white/20 p-5 rounded-2xl flex flex-col justify-between transition">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-[10px] font-mono text-white/40 uppercase bg-white/5 py-0.5 px-2 rounded-full border border-white/5 font-bold">
                          {course.category}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono font-bold ${
                          enroll.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                          enroll.status === "pending_payment" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}>
                          {enroll.status === "pending_payment" ? "Chờ duyệt phí" : enroll.status === "active" ? "Đang học" : "Đã hoàn thành"}
                        </span>
                      </div>

                      <h5 className="font-display font-bold text-white text-sm line-clamp-1">{course.title}</h5>
                      
                      {/* Interactive Progress Tracking */}
                      {enroll.status !== "pending_payment" && (
                        <div className="space-y-1.5 pt-1.5">
                          <div className="flex justify-between text-[11px] text-white/50 font-mono">
                            <span>Tiến độ bài học</span>
                            <span>{completedProgress}/{totalLessonsCount} bài đã hoàn thành ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {enroll.status === "pending_payment" && (
                        <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl text-[11px] text-amber-300/80 leading-relaxed font-sans">
                          ℹ️ Giao dịch chuyển khoản học phí đang chờ đối soát sao kê. Bạn sẽ nhận được thông báo ngay khi Kế toán duyệt giao dịch.
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 mt-4 flex justify-between items-center text-xs">
                      {enroll.status === "pending_payment" ? (
                        <>
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-amber-400/80">Chờ kế toán</span>
                          <button
                            onClick={() => {
                              const foundTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id);
                              if (foundTx) setPaymentGuideTx(foundTx);
                            }}
                            className="p-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold border border-amber-500/20 rounded-xl transition cursor-pointer text-[10px]"
                          >
                            Hướng dẫn thanh toán
                          </button>
                        </>
                      ) : (
                        <>
                          <span></span>
                          <button
                            onClick={() => { setLearningCourseId(course.id); setActiveLessonId(null); }}
                            className="p-1.5 px-3.5 bg-white/10 hover:bg-white/15 text-xs text-white font-bold border border-white/10 rounded-xl transition cursor-pointer"
                          >
                            Vào lớp học <ArrowRight className="h-3.5 w-3.5 inline ml-1" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {myEnrollments.length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/10 border border-dashed border-white/5 rounded-2xl text-xs text-white/40">
                  Bạn chưa đăng ký lớp học nào. Vui lòng vào mục "Khám phá khóa học" để học hoặc liên hệ trường hỗ trợ.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 Detail: Active Classroom interactive study desk */}
        {activeSubTab === "learning" && learningCourseId && currentLearningCourse && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <button 
                onClick={() => setLearningCourseId(null)}
                className="p-2 px-3 text-xs bg-white/5 hover:bg-white/10 text-white/70 rounded-xl cursor-pointer"
              >
                Thoát lớp học
              </button>
              <h4 className="text-base font-display font-semibold text-indigo-300 truncate max-w-sm md:max-w-md">Lớp học: {currentLearningCourse.title}</h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Sidebar: Course Lesson list complete checkpoints */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-4 h-fit">
                <span className="text-xs font-semibold text-white uppercase tracking-wider block border-b border-white/5 pb-2">Danh sách bài học</span>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentLearningLessons.map((les, idx) => {
                    const progress = store.lessonProgress.find(
                      p => p.enrollmentId === activeLearningEnrollment?.id && p.lessonId === les.id
                    );
                    const isCompleted = progress?.completed ?? false;

                    return (
                      <div 
                        key={les.id} 
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 transition cursor-pointer ${
                          activeLessonId === les.id 
                            ? "bg-white/15 border-white/20 text-white" 
                            : "bg-black/10 border-white/5 text-white/60 hover:text-white"
                        }`}
                        onClick={() => setActiveLessonId(les.id)}
                      >
                        <div className="flex items-center gap-2 py-0.5 truncate">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // prevent modal opening duplicate
                              if (activeLearningEnrollment) {
                                handleToggleLessonComplete(activeLearningEnrollment.id, les.id);
                              }
                            }}
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition flex-shrink-0 cursor-pointer ${
                              isCompleted 
                                ? "bg-[#16a34a] border-[#16a34a] text-slate-900" 
                                : "border-white/20 hover:border-white/40"
                            }`}
                          >
                            {isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
                          </button>
                          <span className="truncate font-medium">{idx + 1}. {les.title}</span>
                        </div>

                        <span className="text-[9px] font-mono text-white/30 truncate">{les.duration}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Qualification Quiz Check trigger block */}
                {activeLearningEnrollment && (() => {
                  const checkQuiz = store.quizzes.find(q => q.courseId === learningCourseId);
                  const isAllSessionsRead = store.lessonProgress.filter(
                    p => p.enrollmentId === activeLearningEnrollment.id && p.completed
                  ).length === currentLearningLessons.length;

                  if (checkQuiz && isAllSessionsRead) {
                    return (
                      <div className="pt-2 border-t border-white/5 mt-4">
                        <button
                          onClick={() => handleStartQuiz(checkQuiz)}
                          className="w-full py-2 bg-[#16a34a] hover:bg-opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Award className="h-4 w-4" /> Làm bài Đánh giá Cuối khóa
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Main Module Content Inspector */}
              <div className="lg:col-span-3 space-y-6">
                {currentLessonContentObj ? (
                  <div className="bg-black/25 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h5 className="text-base font-display font-extrabold text-white">{currentLessonContentObj.title}</h5>
                    <div className="flex items-center gap-4 text-xs text-white/40 border-b border-white/5 pb-3">
                      <span>Giảng viên hướng dẫn: Hệ thống E16</span>
                      <span>Thời lượng bài học: {currentLessonContentObj.duration}</span>
                    </div>

                    <div className="text-sm text-white/70 leading-relaxed font-sans prose prose-invert max-w-none space-y-3 whitespace-pre-line">
                      {currentLessonContentObj.content}
                    </div>

                    {currentLessonContentObj.videoUrl && (
                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Video Bài giảng Đi kèm</span>
                        <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 relative flex items-center justify-center">
                          <video 
                            controls 
                            src={currentLessonContentObj.videoUrl} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-black/15 rounded-2xl border border-dashed border-white/5 flex flex-col justify-center items-center">
                    <BookOpen className="h-10 w-10 text-white/20 mb-2" />
                    <p className="text-xs text-white/50">Vui lòng bấm chọn bất kỳ bài học nào từ cột bên trái để hiển thị tài liệu học tập.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

    </>
  );
}
