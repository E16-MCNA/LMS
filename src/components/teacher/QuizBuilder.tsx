import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";

interface ComponentProps {
  [key: string]: any;
}

export default function QuizBuilder(props: ComponentProps) {
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
        {/* Tab 2: Quiz Management & Question Mapping panels */}
        {activeSubTab === "quizzes" && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white mb-2">Platform Quizzes Assessment Room</h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Side: Selectable Quizzes List across own courses */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 h-fit">
                <span className="text-xs font-semibold text-white uppercase tracking-wider block border-b border-white/10 pb-2">Active Assessments</span>
                
                <div className="space-y-2.5">
                  {store.quizzes.filter(q => myCourseIds.includes(q.courseId)).map(q => {
                    const courseName = store.courses.find(c => c.id === q.courseId)?.title || "Unknown Course";
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuizId(q.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition duration-150 relative block cursor-pointer ${
                          selectedQuizId === q.id 
                            ? "bg-white/15 border-white/20 text-white" 
                            : "bg-black/10 border-white/5 text-white/60 hover:text-white"
                        }`}
                      >
                        <h6 className="font-bold font-display leading-snug truncate max-w-[200px]">{q.title}</h6>
                        <span className="text-[10px] text-white/40 mt-1 block truncate font-mono">{courseName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Side Column: Questions Map for Selected Quiz */}
              <div className="lg:col-span-2 space-y-4">
                {selectedQuizId ? (
                  <>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h5 className="text-sm font-bold text-white">Questions configuration</h5>
                        <p className="text-[11px] text-white/40">Quiz ID: <span className="font-mono">{selectedQuizId}</span></p>
                      </div>
                      
                      <button
                        onClick={() => setShowQuestionModal(true)}
                        className="p-1 px-2.5 bg-[#2563eb] text-white font-bold text-xs rounded-xl hover:bg-opacity-90"
                      >
                        <PlusCircle className="h-4 w-4 inline mr-1" /> Quiz Question
                      </button>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      {store.questions.filter(qst => qst.quizId === selectedQuizId).map((qst, n) => (
                        <div key={qst.id} className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-3 relative">
                          <div className="flex justify-between items-start gap-3">
                            <span className="text-xs font-bold text-white flex-1">{n+1}. {qst.text}</span>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-indigo-300 bg-white/5 py-0.5 px-2 rounded-full border border-white/10 text-right">
                              {qst.type}
                            </span>
                          </div>

                          {qst.options.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                              {qst.options.map((opt, idx) => (
                                <div key={idx} className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                                  qst.correctAnswer.split(",").includes(String(idx)) 
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                    : "bg-black/20 border-white/5 text-white/50"
                                }`}>
                                  <span className="font-bold text-[10px]">{idx + 1}.</span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {qst.type === "text" && (
                            <div className="text-[11px] text-emerald-400 font-mono pl-4">
                              Correct answers trigger matching: <span className="bg-black/35 px-1.5 py-0.5 rounded border border-white/5">{qst.correctAnswer}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {store.questions.filter(qst => qst.quizId === selectedQuizId).length === 0 && (
                        <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/15">
                          <p className="text-xs text-white/40">No checking criteria or questions specified for this evaluation.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 bg-black/10 rounded-2xl border border-dashed border-white/5 flex flex-col justify-center items-center">
                    <HelpCircle className="h-8 w-8 text-white/30 mb-2" />
                    <p className="text-xs text-white/50">Select an assessment parameters folder from the tab sidebar to explore dynamic check sheets.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* MODAL 3: CREATE QUIZ FORM */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowQuizModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Award className="h-5 w-5 text-indigo-400" /> Course Assessment Quiz Criteria
            </h3>

            <form onSubmit={handleAddQuizSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Assessment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Final Core Assessment"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Passing Score %</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={quizPassing}
                    onChange={(e) => setQuizPassing(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Minutes Limit</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={quizLimit}
                    onChange={(e) => setQuizLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Max Attempts</label>
                  <input
                     type="number"
                     required
                     min={1}
                     max={10}
                     value={quizAttempts}
                     onChange={(e) => setQuizAttempts(Number(e.target.value))}
                     className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Configure Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD QUESTION FORM */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <button 
              onClick={() => setShowQuestionModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <PlusCircle className="h-5 w-5 text-indigo-400" /> Create Quiz Question Prompts
            </h3>

            <form onSubmit={handleAddQuestionSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Question Text</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Which of the following is correct syntax?"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Question Type</label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  >
                    <option value="single">Single Choice SELECT</option>
                    <option value="multiple">Multiple Choice CHECK</option>
                    <option value="text">Free Form Text Keyword</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Correct Answer Index / Text Key</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0 (First choice) or 'security, Separation' for text"
                    value={qCorrect}
                    onChange={(e) => setQCorrect(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {qType !== "text" && (
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-white/70 block">Provide Choice Options (Up to 3 options)</span>
                  {qOptions.map((opt, id) => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="font-mono text-white/40">Choice {id + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder={`Option details #${id + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const nextOpts = [...qOptions];
                          nextOpts[id] = e.target.value;
                          setQOptions(nextOpts);
                        }}
                        className="flex-1 px-3 py-1.5 bg-black/20 text-white border border-white/10 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Map Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
