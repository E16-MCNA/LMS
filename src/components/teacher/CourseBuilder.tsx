import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus, MapPin, Calendar, Trash2, AlertCircle, Layers } from "lucide-react";
import ModalPortal from "../ModalPortal";
import { AppStore } from "../../store";

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];


interface ComponentProps {
  [key: string]: any;
}

export default function CourseBuilder(props: ComponentProps) {
  const [courseSearch, setCourseSearch] = React.useState("");
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

  // Local states for CourseSection management inside CourseBuilder
  const [showSectionModal, setShowSectionModal] = React.useState(false);
  const [sectionModalMode, setSectionModalMode] = React.useState<"create" | "edit">("create");
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);

  // Form states
  const [formSemesterId, setFormSemesterId] = React.useState("sem_spring25");
  const [formSectionCode, setFormSectionCode] = React.useState("");
  const [formMaxStudents, setFormMaxStudents] = React.useState<number>(30);
  const [formStatus, setFormStatus] = React.useState<"open" | "closed" | "cancelled">("open");
  const [formSlots, setFormSlots] = React.useState<Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>>([
    { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "Phòng A101" }
  ]);
  const [formConflicts, setFormConflicts] = React.useState<string[]>([]);

  // Conflict Checker
  const checkConflicts = (
    sectionId: string | null,
    teacherId: string,
    slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>,
    semesterId: string
  ): string[] => {
    const sections = store.courseSections || [];
    const activeSections = sections.filter(
      (s: any) => s.id !== sectionId && s.semesterId === semesterId && s.status !== "cancelled"
    );

    const conflicts: string[] = [];

    slots.forEach(slot => {
      const timeToMins = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const start = timeToMins(slot.startTime);
      const end = timeToMins(slot.endTime);

      if (start >= end) {
        conflicts.push(`Ca học vào ${slot.dayOfWeek} có giờ bắt đầu (${slot.startTime}) phải nhỏ hơn giờ kết thúc (${slot.endTime}).`);
        return;
      }

      activeSections.forEach((sec: any) => {
        sec.schedule.forEach((secSlot: any) => {
          if (secSlot.dayOfWeek === slot.dayOfWeek) {
            const secStart = timeToMins(secSlot.startTime);
            const secEnd = timeToMins(secSlot.endTime);

            // Overlap logic: startA < endB && startB < endA
            const isOverlapping = start < secEnd && secStart < end;

            if (isOverlapping) {
              // Check teacher conflict
              if (sec.teacherId === teacherId) {
                const tName = store.users.find((u: any) => u.id === teacherId)?.name || "Giảng viên";
                const cTitle = store.courses.find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Giảng viên ${tName} đã bị trùng lịch dạy lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} cùng ngày ${slot.dayOfWeek}.`
                );
              }
              // Check room conflict
              if (secSlot.room.trim().toLowerCase() === slot.room.trim().toLowerCase() && slot.room.trim()) {
                const cTitle = store.courses.find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Phòng học "${slot.room}" đã bị đặt bởi lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} cùng ngày ${slot.dayOfWeek}.`
                );
              }
            }
          }
        });
      });
    });

    return conflicts;
  };

  const handleOpenCreateSection = () => {
    setSectionModalMode("create");
    setEditingSectionId(null);
    setFormSemesterId("sem_spring25");
    setFormSectionCode("");
    setFormMaxStudents(30);
    setFormStatus("pending");
    setFormSlots([]);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (sec: any) => {
    setSectionModalMode("edit");
    setEditingSectionId(sec.id);
    setFormSemesterId(sec.semesterId);
    setFormSectionCode(sec.sectionCode);
    setFormMaxStudents(sec.maxStudents);
    setFormStatus(sec.status);
    setFormSlots(sec.schedule);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  const handleDeleteSection = (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học phần "${code}"? Tất cả thông tin lịch dạy sẽ bị hủy bỏ hoàn toàn.`)) return;
    
    const storeData = AppStore.get();
    storeData.courseSections = (storeData.courseSections || []).filter((s: any) => s.id !== id);
    storeData.courseRegistrations = (storeData.courseRegistrations || []).filter((r: any) => r.sectionId !== id);

    AppStore.log(currentUser.id, "delete_section_from_builder", code, `Xóa lớp học phần ${code} trực tiếp từ trình quản lý khóa học.`);
    AppStore.save(storeData);
    props.onRefreshData();
    alert(`🗑️ Đã xóa lớp học phần ${code}!`);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSectionCode.trim()) {
      alert("⚠️ Vui lòng nhập Mã lớp học phần!");
      return;
    }

    const conflicts = checkConflicts(editingSectionId, currentUser.id, formSlots, formSemesterId);
    if (conflicts.length > 0) {
      setFormConflicts(conflicts);
      alert("❗ Phát hiện xung đột trùng lịch biểu. Vui lòng kiểm tra kỹ chi tiết báo đỏ!");
      return;
    }

    const storeData = AppStore.get();
    const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

    if (sectionModalMode === "create") {
      const newSection = {
        id: generateId("section"),
        courseId: activeCourse.id,
        semesterId: formSemesterId,
        teacherId: currentUser.id,
        sectionCode: formSectionCode,
        maxStudents: formMaxStudents,
        schedule: formSlots,
        status: formStatus
      };

      if (!storeData.courseSections) storeData.courseSections = [];
      storeData.courseSections.push(newSection);
      AppStore.log(currentUser.id, "create_section_from_builder", newSection.sectionCode, `Khởi tạo lớp học phần ${newSection.sectionCode} cho khóa ${activeCourse.title} trực tiếp từ CourseBuilder.`);
    } else {
      storeData.courseSections = (storeData.courseSections || []).map((s: any) => {
        if (s.id === editingSectionId) {
          AppStore.log(currentUser.id, "edit_section_from_builder", s.sectionCode, `Cập nhật lớp học phần ${formSectionCode} từ CourseBuilder.`);
          return {
            ...s,
            semesterId: formSemesterId,
            sectionCode: formSectionCode,
            maxStudents: formMaxStudents,
            schedule: formSlots,
            status: formStatus
          };
        }
        return s;
      });
    }

    AppStore.save(storeData);
    setShowSectionModal(false);
    props.onRefreshData();
  };

  const addFormSlot = () => {
    setFormSlots([...formSlots, { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "" }]);
  };

  const removeFormSlot = (idx: number) => {
    setFormSlots(formSlots.filter((_, i) => i !== idx));
  };

  const updateFormSlot = (idx: number, field: string, value: string) => {
    setFormSlots(formSlots.map((slot, i) => {
      if (i === idx) {
        return { ...slot, [field]: value };
      }
      return slot;
    }));
  };

  const courseSections = (store.courseSections || []).filter((s: any) => s.courseId === activeCourse?.id);

  const filteredCourses = myCourses.filter((course: any) => {
    return !courseSearch ||
      course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.category.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.description.toLowerCase().includes(courseSearch.toLowerCase());
  });

  return (
    <>
        {/* Tab 1: Curriculum development & course viewer */}
        {activeSubTab === "courses" && !selectedCourseId && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white">Khóa học Phụ trách ({myCourses.length})</h4>
            
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs">
              <input
                type="text"
                placeholder="Tìm kiếm khóa học theo tên, danh mục hoặc mô tả..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full md:w-64 px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {filteredCourses.map((course: any) => {
                const enrolledCount = store.enrollments.filter((e: any) => e.courseId === course.id).length;
                return (
                  <div key={course.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition duration-150 flex flex-col justify-between">
                    <div>
                      <div className="h-40 relative">
                        <img 
                          referrerPolicy="no-referrer"
                          src={course.thumbnail} 
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
                            course.status === "published" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            course.status === "pending" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            course.status === "rejected" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                            "bg-white/10 text-white/60 border border-white/5"
                          }`}>
                            {course.status === "published" ? "ĐÃ DUYỆT" :
                             course.status === "pending" ? "CHỜ DUYỆT" :
                             course.status === "rejected" ? "BỊ TRẢ VỀ" : "BẢN NHÁP"}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2">
                        <p className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">{course.category}</p>
                        <h5 className="font-display font-bold text-white text-sm line-clamp-1">{course.title}</h5>
                        <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">{course.description}</p>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-white/5 mt-3 flex items-center justify-between text-xs">
                      <span className="text-white/50">{enrolledCount} học viên đã đăng ký</span>
                      
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenEditCourse(course)}
                          className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-[10px] rounded-lg border border-white/10 text-white/85 cursor-pointer flex items-center"
                        >
                          <Edit className="h-3 w-3 inline mr-1" /> Sửa
                        </button>
                        <button
                          onClick={() => setSelectedCourseId(course.id)}
                          className="p-1 px-2.5 bg-white/10 hover:bg-indigo-600 font-bold hover:text-white text-[10px] rounded-lg text-white transition cursor-pointer flex items-center"
                        >
                          Chi tiết <ChevronRight className="h-3 w-3 inline ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCourses.length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/10 rounded-2xl border-2 border-dashed border-white/5">
                  <p className="text-xs text-white/50 mb-3">
                    {myCourses.length === 0 ? "Chưa có bản nháp khóa học nào được tạo trên hồ sơ này." : "Không tìm thấy khóa học nào phù hợp với bộ lọc."}
                  </p>
                  {myCourses.length === 0 && (
                    <button 
                      onClick={handleOpenCreateCourse}
                      className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl"
                    >
                      Tạo bản nháp khóa học
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1 Detail: Comprehensive Single Course modules editor */}
        {activeSubTab === "courses" && selectedCourseId && activeCourse && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <button 
                onClick={() => setSelectedCourseId(null)}
                className="p-1 px-2 bg-white/5 hover:bg-white/10 text-xs text-white/70 rounded-lg cursor-pointer"
              >
                Quay lại danh sách
              </button>
              <h4 className="text-base font-display font-semibold text-white truncate max-w-sm md:max-w-md">Khóa học: {activeCourse.title}</h4>
              <span className="text-xs text-white/40">Trạng thái: <strong className="text-indigo-200 uppercase">{
                activeCourse.status === "published" ? "Đã duyệt" :
                activeCourse.status === "pending" ? "Đang chờ duyệt" :
                activeCourse.status === "rejected" ? "Bị trả về chỉnh sửa" : "Bản nháp"
              }</strong></span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Lesson sessions timeline creator */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white tracking-widest uppercase">Danh sách bài học giáo trình ({lessons.length})</span>
                  <button
                    onClick={() => setShowLessonModal(true)}
                    className="p-1.5 bg-white/15 hover:bg-white/20 text-[11px] text-white font-bold rounded-xl border border-white/10 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" /> Thêm Bài học
                  </button>
                </div>

                <div className="space-y-3">
                  {lessons.map(lesson => (
                    <div key={lesson.id} className="bg-black/25 border border-white/10 rounded-2xl p-4 flex items-start gap-3.5 hover:bg-black/35 transition">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/20 text-indigo-300 font-mono text-[11px] flex items-center justify-center flex-shrink-0">
                        {lesson.order}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h6 className="text-xs font-display font-bold text-white">{lesson.title}</h6>
                          <span className="text-[10px] font-mono text-white/40">{lesson.duration}</span>
                        </div>
                        <p className="text-xs text-white/60 line-clamp-3 leading-relaxed font-sans">{lesson.content}</p>
                        {lesson.videoUrl && (
                          <div className="text-[10px] text-indigo-200 font-mono flex items-center gap-1 pt-1">
                            <Tv className="h-3 w-3" /> Bài giảng đính kèm: {lesson.videoUrl}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {lessons.length === 0 && (
                    <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
                      <p className="text-xs text-white/50">Chương trình học hiện đang trống. Hãy bấm "Thêm Bài học" để bắt đầu thiết lập bài giảng.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Mini tools linked (Quizzes, Assignments, workflow status actions) */}
              <div className="space-y-6">
                {/* Actions Block */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <span className="text-xs font-semibold text-white block border-b border-white/10 pb-2.5">Hành động tiến trình</span>
                  
                  {activeCourse.status === "draft" && (
                    <button
                      onClick={() => handleSubmitCourseForApproval(activeCourse.id)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Gửi yêu cầu duyệt xuất bản
                    </button>
                  )}

                  {activeCourse.status === "rejected" && (
                    <div className="space-y-2">
                      <div className="bg-red-500/15 border border-red-500/20 rounded-xl p-3 text-[11px] text-red-200/90 leading-relaxed">
                        Yêu cầu xuất bản bị từ chối. Vui lòng đọc chi tiết lý do trả về, cập nhật các nội dung cần thiết và gửi yêu cầu phê duyệt lại.
                      </div>
                      <button
                        onClick={() => handleSubmitCourseForApproval(activeCourse.id)}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Gửi lại yêu cầu duyệt
                      </button>
                    </div>
                  )}

                  {activeCourse.status === "published" && (
                    <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-300 flex items-center gap-1.5 font-semibold">
                      <Check className="h-4 w-4" /> Giáo trình đã xuất bản và đang hoạt động.
                    </div>
                  )}

                  {activeCourse.status === "pending" && (
                    <div className="bg-amber-500/15 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-300 leading-normal">
                      Đang chờ ban điều hành duyệt phê duyệt trước khi đưa lên danh mục công khai.
                    </div>
                  )}
                </div>

                {/* Class sections list for this course */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">Các Lớp học phần đang mở</span>
                      <span className="text-[10px] text-white/40 block">Phân bổ ca học & thời khóa biểu</span>
                    </div>
                    {activeCourse.status === "published" && (
                      <button 
                        onClick={handleOpenCreateSection}
                        className="text-[10px] text-indigo-300 font-bold hover:underline cursor-pointer"
                      >
                        + Lập lớp học
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {courseSections.map((sec: any) => {
                      const currentCount = (store.courseRegistrations || []).filter(
                        (r: any) => r.sectionId === sec.id && r.status === "registered"
                      ).length;

                      return (
                        <div key={sec.id} className="text-xs space-y-1.5 bg-black/25 p-3 rounded-xl border border-white/5 relative group">
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold rounded-lg text-[9px] font-mono tracking-wider">
                              {sec.sectionCode}
                            </span>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => handleOpenEditSection(sec)}
                                className="p-0.5 hover:bg-white/10 text-indigo-300 rounded cursor-pointer"
                                title="Chỉnh sửa ca học"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSection(sec.id, sec.sectionCode)}
                                className="p-0.5 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                                title="Xóa lớp học phần"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-[10px] text-white/50 space-y-1 font-sans">
                            {sec.schedule.map((slot: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0 text-indigo-400" />
                                <span>{slot.dayOfWeek} ({slot.startTime} - {slot.endTime})</span>
                                <span className="font-mono text-white/30">|</span>
                                <MapPin className="h-3 w-3 shrink-0 text-indigo-400" />
                                <span className="truncate">{slot.room || "Trực tuyến"}</span>
                              </div>
                            ))}
                            {(!sec.schedule || sec.schedule.length === 0) && (
                              <div className="text-[10px] text-amber-400/80 italic flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Chờ Giáo vụ xếp ca & phòng học</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center text-[9px] pt-1 border-t border-white/5 font-mono text-white/40">
                            <span>Sĩ số: {currentCount}/{sec.maxStudents} HS</span>
                            <span className={`uppercase font-bold ${
                              sec.status === "pending" ? "text-amber-400" :
                              sec.status === "open" ? "text-emerald-400" : "text-white/40"
                            }`}>
                              {sec.status === "pending" ? "Chờ duyệt" :
                               sec.status === "open" ? "Đang mở" : 
                               sec.status === "closed" ? "Đã đóng" : "Đã hủy"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {courseSections.length === 0 && (
                      <p className="text-[11px] text-white/40 italic">Chưa có lớp học phần nào được lập. Hãy xuất bản khóa học và nhấp "+ Lập lớp học" để bắt đầu xếp thời khóa biểu.</p>
                    )}
                  </div>
                </div>

                {/* Quizzes overview in Course details */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-xs font-semibold text-white">Bài thi trắc nghiệm tương tác</span>
                    <button 
                      onClick={() => setShowQuizModal(true)}
                      className="text-[10px] text-indigo-300 font-bold hover:underline"
                    >
                      + Tạo Đề thi
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {courseQuizzes.map(q => (
                      <div key={q.id} className="text-xs flex items-center justify-between bg-black/25 p-2 rounded-xl border border-white/5">
                        <span className="truncate text-white max-w-[140px] font-medium">{q.title}</span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/80 font-mono">
                          {q.passingScore}% đạt
                        </span>
                      </div>
                    ))}

                    {courseQuizzes.length === 0 && (
                      <p className="text-[11px] text-white/40">Chưa có bài thi trắc nghiệm nào được tạo.</p>
                    )}
                  </div>
                </div>

                {/* Assignments overview in Course details */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-xs font-semibold text-white">Thử thách Bài tự luận</span>
                    <button 
                      onClick={() => setShowAssignModal(true)}
                      className="text-[10px] text-indigo-300 font-bold hover:underline"
                    >
                      + Tạo Bài tập
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {courseAssignments.map(a => (
                      <div key={a.id} className="text-xs flex items-center justify-between bg-black/25 p-2 rounded-xl border border-white/5">
                        <span className="truncate text-white max-w-[140px] font-medium">{a.title}</span>
                        <span className="text-[10px] font-mono text-indigo-200">
                          Tối đa: {a.maxScore} đ
                        </span>
                      </div>
                    ))}

                    {courseAssignments.length === 0 && (
                      <p className="text-[11px] text-white/40">Chưa có thử thách bài tập tự luận nào được tạo.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      {/* MODAL 1: ADD / EDIT COURSE FORMS */}
      {showCourseModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowCourseModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <BookOpen className="h-5 w-4 text-indigo-400" /> 
              {courseModalMode === "create" ? "Khởi tạo Khóa học Mới" : "Chỉnh sửa Thông tin Khóa học"}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tiêu đề Khóa học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế hệ thống cơ sở dữ liệu quy mô lớn"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Danh mục Chuyên môn</label>
                <select
                  value={courseCategory}
                  onChange={(e) => setCourseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                >
                  <option value="Web Development" className="bg-slate-900">Phát triển Web</option>
                  <option value="Data Science" className="bg-slate-900">Khoa học Dữ liệu</option>
                  <option value="Software Engineering" className="bg-slate-900">Kỹ thuật Phần mềm</option>
                  <option value="DevOps & Infrastructure" className="bg-slate-900">DevOps & Hạ tầng</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Đường dẫn Ảnh đại diện (Thumbnail)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={courseThumb}
                  onChange={(e) => setCourseThumb(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Mô tả / Đề cương khóa học</label>
                <textarea
                  required
                  placeholder="Mô tả chi tiết nội dung chương trình học..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-20 max-h-24 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Mức học phí (VND)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Miễn phí"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Trình độ đào tạo</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                  >
                    <option value="Cơ bản" className="bg-slate-900">Cơ bản</option>
                    <option value="Trung cấp" className="bg-slate-900">Trung cấp</option>
                    <option value="Nâng cao" className="bg-slate-900">Nâng cao</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Các thẻ từ khóa Tìm kiếm (tags)</label>
                <input
                  type="text"
                  placeholder="Next.js, Python, CSS (phân tách bằng dấu phẩy)"
                  value={courseTags}
                  onChange={(e) => setCourseTags(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Xác nhận lưu thông số
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL 2: ADD LESSON FORM */}
      {showLessonModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowLessonModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Plus className="h-4 w-4 text-indigo-400" /> Thêm Bài học mới
            </h3>

            <form onSubmit={handleAddLessonSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tiêu đề Bài học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 1. Làm việc với HTTP controllers"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Video bài giảng (Không bắt buộc)</label>
                  <input
                    type="text"
                    placeholder="https://example.com/lecture.mp4"
                    value={lessonVideo}
                    onChange={(e) => setLessonVideo(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Thời lượng bài học</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 20 phút"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Nội dung hướng dẫn chi tiết (Hỗ trợ Markdown)</label>
                <textarea
                  required
                  placeholder="Mô tả hướng dẫn chi tiết từng bước cho học sinh tại đây..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-36 max-h-48 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Xác nhận thêm
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {showSectionModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-2 border-b border-white/10 pb-3">
                <Layers className="h-5 w-5 text-indigo-400" /> 
                {sectionModalMode === "create" ? "Khởi tạo Lớp học phần mới" : "Chỉnh sửa Lớp học phần"}
              </h3>

              <form onSubmit={handleSaveSection} className="space-y-4 text-xs font-sans">
                {/* Basic info row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Học Kỳ</label>
                    <select
                      value={formSemesterId}
                      onChange={(e) => setFormSemesterId(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                    >
                      {(store.semesters || []).map((s: any) => (
                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Mã lớp học phần</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: CS101-L02"
                      value={formSectionCode}
                      onChange={(e) => setFormSectionCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Sĩ số tối đa (Học sinh)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={formMaxStudents}
                      onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Trạng thái phê duyệt</label>
                    <div className="px-3 py-2 bg-black/40 text-amber-300 font-bold border border-amber-500/20 rounded-xl text-xs flex items-center gap-1.5 h-[34px]">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                      <span>Chờ duyệt & xếp ca</span>
                    </div>
                  </div>
                </div>

                {/* Sub-form for schedule slots */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400">
                      Thời khóa biểu chi tiết ({formSlots.length})
                    </h5>
                    <button
                      type="button"
                      onClick={addFormSlot}
                      className="px-3 py-1 bg-white/5 border border-white/10 text-white font-bold rounded-lg hover:bg-white/10 transition cursor-pointer text-[10.5px]"
                    >
                      + Thêm ca học tuần
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {formSlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className="bg-black/15 border border-white/5 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end relative overflow-hidden"
                      >
                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Ngày học</label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => updateFormSlot(idx, "dayOfWeek", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs"
                          >
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Giờ bắt đầu</label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => updateFormSlot(idx, "startTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Giờ kết thúc</label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => updateFormSlot(idx, "endTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-white/40 text-[10px] block">Phòng học / Đường dẫn</label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Phòng A101"
                            value={slot.room}
                            onChange={(e) => updateFormSlot(idx, "room", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs"
                          />
                          {formSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeFormSlot(idx)}
                              className="absolute -top-1.5 -right-1 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-lg border border-red-500/10 cursor-pointer"
                              title="Xóa ca học"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conflicts Panel */}
                {formConflicts.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-red-400 font-bold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Phát hiện trùng lịch biểu ({formConflicts.length})</span>
                    </div>
                    <ul className="list-disc pl-5 text-red-200/80 space-y-1 leading-relaxed">
                      {formConflicts.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Modal Actions */}
                <div className="border-t border-white/5 pt-4 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowSectionModal(false)}
                    className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    Lưu thiết lập
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

    </>
  );
}

