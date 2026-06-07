import React, { useState, useEffect } from "react";
import {
  BookOpen,
  HelpCircle,
  FileText,
  Plus,
  Eye,
  Edit,
  Check,
  Award,
  Settings,
  Download,
  Tv,
  Trash,
  ChevronRight,
  TrendingUp,
  BarChart,
  Users,
  Clock,
  Search,
  MessageSquare,
  X,
  PlusCircle,
  FolderPlus
} from "lucide-react";
import { LMSDataStore, User, Course, Lesson, Quiz, Question, Assignment, Submission, QuizAttempt } from "../types";
import { AppStore } from "../store";
import CourseBuilder from "./teacher/CourseBuilder";
import QuizBuilder from "./teacher/QuizBuilder";
import AssignmentGrader from "./teacher/AssignmentGrader";
import GradebookTable from "./teacher/GradebookTable";
import TeacherAnalytics from "./teacher/TeacherAnalytics";
import Timetable from "./Timetable";
import UserGuide from "./UserGuide";
import AttendanceManager from "./AttendanceManager";
import AdvisorPanel from "./AdvisorPanel";
import { generateId } from "../utils";
import { useApiStore } from "../hooks/apiHooks";
import { api } from "../api";

interface TeacherPanelProps {
  currentUser: User;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSystem?: "SIS" | "LMS";
  updateStore?: (updater: (draft: LMSDataStore) => void) => void;
}

export default function TeacherPanel({ currentUser, onLogout, onRefreshData, activeSystem = "LMS", updateStore }: TeacherPanelProps) {
  const { store, isLoading, isError } = useApiStore();

  // Local active sub-module state
  const [activeSubTab, setActiveSubTab] = useState<string>("teacher_guide");
  const [showSidebar, setShowSidebar] = useState(false);

  // Attendance routing/locking states from Timetable redirect
  const [attendanceCourseId, setAttendanceCourseId] = useState<string | null>(null);
  const [attendanceSectionId, setAttendanceSectionId] = useState<string | null>(null);
  const [lockAttendanceSelectors, setLockAttendanceSelectors] = useState<boolean>(false);

  const handleNavClick = (tab: string) => {
    setActiveSubTab(tab);
    setShowSidebar(false);
    if (tab !== "attendance") {
      setAttendanceCourseId(null);
      setAttendanceSectionId(null);
      setLockAttendanceSelectors(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSubTab]);

  useEffect(() => {
    if (activeSystem === "SIS") {
      setActiveSubTab("timetable");
    } else {
      setActiveSubTab("courses");
    }
  }, [activeSystem]);

  // Selection states
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // Modal control states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalMode, setCourseModalMode] = useState<"create" | "edit">("create");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // Create / Edit course fields
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseCategory, setCourseCategory] = useState("Web Development");
  const [courseThumb, setCourseThumb] = useState("");
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [courseLevel, setCourseLevel] = useState<string>("Cơ bản");
  const [courseTags, setCourseTags] = useState<string>("");

  // Create Lesson state
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideo, setLessonVideo] = useState("");
  const [lessonDuration, setLessonDuration] = useState("15 mins");

  // Create Quiz state
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizPassing, setQuizPassing] = useState(70);
  const [quizLimit, setQuizLimit] = useState(15);
  const [quizAttempts, setQuizAttempts] = useState(3);
  const [quizDeadline, setQuizDeadline] = useState("");
  const [quizAttachmentUrl, setQuizAttachmentUrl] = useState("");

  // Add Question state
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"single" | "multiple" | "text">("single");
  const [qOptions, setQOptions] = useState<string[]>(["", "", ""]);
  const [qCorrect, setQCorrect] = useState("0");

  // Create Assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDeadline, setAssignDeadline] = useState("");
  const [assignMaxScore, setAssignMaxScore] = useState(100);
  const [assignAttachmentUrl, setAssignAttachmentUrl] = useState("");

  // Grading submission state
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState(100);
  const [gradingFeedback, setGradingFeedback] = useState("");

  // General feedback messaging
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Get active teacher datasets
  const myCourses = store.courses.filter(c => c.teacherId === currentUser.id);
  const myCourseIds = myCourses.map(c => c.id);

  useEffect(() => {
    if (showAssignModal && !selectedCourseId && myCourses.length === 1) {
      setSelectedCourseId(myCourses[0].id);
    }
  }, [showAssignModal, selectedCourseId, myCourses]);

  // Handle Course creation / update
  const handleOpenCreateCourse = () => {
    setCourseModalMode("create");
    setCourseTitle("");
    setCourseDesc("");
    setCourseCategory("Web Development");
    setCourseThumb("");
    setCoursePrice(0);
    setCourseLevel("Cơ bản");
    setCourseTags("");
    setShowCourseModal(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setCourseModalMode("edit");
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDesc(course.description);
    setCourseCategory(course.category);
    setCourseThumb(course.thumbnail || "");
    setCoursePrice(course.price || 0);
    setCourseLevel(course.level || "Cơ bản");
    setCourseTags(course.tags ? course.tags.join(", ") : "");
    setShowCourseModal(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDesc.trim()) {
      triggerToast("Vui lòng điền đầy đủ các thông tin tiêu đề và mô tả khóa học.");
      return;
    }

    const storeData = AppStore.get();
    const tagsArray = courseTags
      ? courseTags.split(",").map(item => item.trim()).filter(Boolean)
      : [];

    if (courseModalMode === "create") {
      const newCourse: Course = {
        id: generateId("course"),
        title: courseTitle,
        description: courseDesc,
        teacherId: currentUser.id,
        status: "published",
        category: courseCategory,
        thumbnail: courseThumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date().toISOString(),
        price: Number(coursePrice) || 0,
        level: courseLevel as any,
        tags: tagsArray
      };
      storeData.courses.push(newCourse);

      api.createCourse({
        title: courseTitle,
        description: courseDesc,
        teacherId: currentUser.id,
        category: courseCategory,
        thumbnail: courseThumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60",
        price: Number(coursePrice) || 0,
        level: courseLevel,
        tags: tagsArray
      }).catch(err => console.warn("Failed to create course on server:", err));

      AppStore.log(currentUser.id, "create_course_draft", newCourse.title, "Saved course outline draft successfully.");
      triggerToast("Đã lập bản nháp khóa đào tạo mới thành công.");
    } else {
      storeData.courses = storeData.courses.map(c => {
        if (c.id === editingCourseId) {
          AppStore.log(currentUser.id, "edit_course_details", c.title, "Updated course detailed descriptors.");
          return {
            ...c,
            title: courseTitle,
            description: courseDesc,
            category: courseCategory,
            thumbnail: courseThumb,
            price: Number(coursePrice) || 0,
            level: courseLevel as any,
            tags: tagsArray
          };
        }
        return c;
      });
      triggerToast("Cập nhật thông tin khóa học thành công!");
    }

    AppStore.save(storeData);
    setShowCourseModal(false);
    onRefreshData();
  };

  const handleSubmitCourseForApproval = (courseId: string) => {
    const storeData = AppStore.get();
    storeData.courses = storeData.courses.map(c => {
      if (c.id === courseId) {
        AppStore.log(currentUser.id, "publish_course_direct", c.title, "Published course without manager approval queue.");
        return { ...c, status: "published" };
      }
      return c;
    });

    api.submitCourse(courseId).catch(err => console.warn("Failed to publish course on server:", err));

    AppStore.save(storeData);
    onRefreshData();
    triggerToast("Khóa học đã được xuất bản.");
  };

  // Add Lesson to current Course
  const handleAddLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    if (!lessonTitle.trim() || !lessonContent.trim()) {
      triggerToast("Please enter title and tutorial details.");
      return;
    }

    const orderNum = (store.lessons.filter(l => l.courseId === selectedCourseId)).length + 1;

    try {
      const created = await api.addLesson({
        courseId: selectedCourseId,
        title: lessonTitle,
        content: lessonContent,
        videoUrl: lessonVideo || undefined,
        order: orderNum,
        duration: lessonDuration
      }) as Lesson;

      if (updateStore) {
        updateStore(draft => {
          draft.lessons.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.lessons.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "add_lesson", created.title, `Added learning module inside course: ${selectedCourseId}`);
      
      setLessonTitle("");
      setLessonContent("");
      setLessonVideo("");
      setLessonDuration("15 mins");
      setShowLessonModal(false);
      triggerToast("Module successfully published inside course.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to add lesson on server.");
    }
  };

  // Create Quiz linked to Course
  const handleAddQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    if (!quizTitle.trim()) {
      triggerToast("Please provide a valid assessment caption.");
      return;
    }

    try {
      const created = await api.createQuiz({
        courseId: selectedCourseId,
        title: quizTitle,
        passingScore: quizPassing,
        timeLimit: quizLimit,
        maxAttempts: quizAttempts,
        deadline: quizDeadline || null
      }) as Quiz;

      if (updateStore) {
        updateStore(draft => {
          draft.quizzes.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.quizzes.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "create_quiz", created.title, `Added assessment linked to course: ${selectedCourseId}`);

      setSelectedQuizId(created.id);
      setQuizTitle("");
      setQuizPassing(70);
      setQuizLimit(15);
      setQuizAttempts(3);
      setQuizDeadline("");
      setQuizAttachmentUrl("");
      setShowQuizModal(false);
      triggerToast("Course final assessment criteria mapped successfully.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to create quiz on server.");
    }
  };

  // Add question to active Quiz
  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;
    if (!qText.trim()) {
      triggerToast("Please describe the question prompt.");
      return;
    }

    const cleanedOptions = qType !== "text" ? qOptions.filter(o => o.trim() !== "") : [];

    try {
      const created = await api.addQuestion(selectedQuizId, {
        text: qText,
        type: qType,
        options: cleanedOptions,
        correctAnswer: qCorrect
      }) as Question;

      if (updateStore) {
        updateStore(draft => {
          draft.questions.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.questions.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "add_quiz_question", created.text, `Added question mapping inside quiz ID: ${selectedQuizId}`);

      setQText("");
      setQOptions(["", "", ""]);
      setQCorrect("0");
      setShowQuestionModal(false);
      triggerToast("Question prompt mapped into standard checks.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to add question on server.");
    }
  };

  // Create Assignment
  const handleAddAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      triggerToast("Vui lòng chọn khóa học trước khi tạo bài tự luận.");
      return;
    }
    if (!assignTitle.trim() || !assignDesc.trim() || !assignDeadline) {
      triggerToast("All fields elements are mandatory.");
      return;
    }

    try {
      const created = await api.createAssignment({
        courseId: selectedCourseId,
        title: assignTitle,
        description: assignDesc,
        deadline: assignDeadline,
        maxScore: Number(assignMaxScore)
      }) as Assignment;

      if (updateStore) {
        updateStore(draft => {
          draft.assignments.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.assignments.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "create_assignment", created.title, `Added task outline inside course: ${selectedCourseId}`);

      setAssignTitle("");
      setAssignDesc("");
      setAssignDeadline("");
      setAssignMaxScore(100);
      setAssignAttachmentUrl("");
      setShowAssignModal(false);
      triggerToast("Course Assignment challenge configured.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to create assignment on server.");
    }
  };

  // Submit Grading Score
  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmissionId) return;

    try {
      await api.gradeAssignment({
        submissionId: activeSubmissionId,
        score: Number(gradingScore),
        feedback: gradingFeedback
      });

      if (updateStore) {
        updateStore(draft => {
          const sub = draft.submissions.find(s => s.id === activeSubmissionId);
          if (sub) {
            sub.score = Number(gradingScore);
            sub.feedback = gradingFeedback;
            sub.gradedAt = new Date().toISOString();
            
            const chal = draft.assignments.find(a => a.id === sub.assignmentId);
            const maxScore = chal?.maxScore || 100;
            AppStore.log(currentUser.id, "grade_assignment", sub.id, `Graded score ${gradingScore} with feedback: ${gradingFeedback}`);
            AppStore.notify(sub.studentId, "success", `Bài làm của bạn cho bài tập "${chal?.title || "Không tên"}" đã được chấm điểm! Điểm số: ${gradingScore}/${maxScore}. Nhận xét: ${gradingFeedback}`);
          }
        });
      } else {
        await onRefreshData();
      }

      setActiveSubmissionId(null);
      setGradingFeedback("");
      triggerToast("Đã cập nhật điểm số và nhận xét thành công!");
    } catch (err: any) {
      console.error("Failed to grade assignment on server:", err);
      triggerToast(`Lỗi chấm điểm: ${err.message || "Không thể kết nối tới máy chủ."}`);
    }
  };

  // Export Gradebook CSV
  const handleExportCSVGradebook = () => {
    const storeData = AppStore.get();
    let csvContent = "data:text/csv;charset=utf-8,Student Name,Email,Course,Assignment,Score Obtained,Max Possible Score\n";

    const mySubmissions = storeData.submissions.filter(sub => {
      const assignment = storeData.assignments.find(a => a.id === sub.assignmentId);
      return assignment && myCourseIds.includes(assignment.courseId);
    });

    mySubmissions.forEach(sub => {
      const student = storeData.users.find(u => u.id === sub.studentId);
      const assignment = storeData.assignments.find(a => a.id === sub.assignmentId);
      const course = storeData.courses.find(c => c.id === assignment?.courseId);

      const parts = [
        `"${student?.name || "Không xác định"}"`,
        `"${student?.email || "Không xác định"}"`,
        `"${course?.title || "Không xác định"}"`,
        `"${assignment?.title || "Không xác định"}"`,
        `"${sub.score ?? "Chưa chấm"}"`,
        `"${assignment?.maxScore || 100}"`
      ];
      csvContent += parts.join(",") + "\n";
    });

    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `mcna_lms_gradebook_export.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Gradebook CSV compilation exported for local download.");
  };

  // Retrieve matching subsets for Course details explorer
  const activeCourse = store.courses.find(c => c.id === selectedCourseId);
  const lessons = store.lessons.filter(l => l.courseId === selectedCourseId).sort((a,b) => a.order - b.order);
  const courseQuizzes = store.quizzes.filter(q => q.courseId === selectedCourseId);
  const courseAssignments = store.assignments.filter(a => a.courseId === selectedCourseId);

  // Retrieve Grading lists
  const myAssignments = store.assignments.filter(a => myCourseIds.includes(a.courseId));
  const myAssignmentIds = myAssignments.map(a => a.id);
  const studentSubmissionsRaw = store.submissions.filter(sub => myAssignmentIds.includes(sub.assignmentId));

  const teacherPanelProps = {
    activeSubTab, setActiveSubTab, selectedCourseId, setSelectedCourseId, selectedQuizId, setSelectedQuizId,
    showCourseModal, setShowCourseModal, courseModalMode, courseTitle, setCourseTitle, courseDesc, setCourseDesc,
    courseCategory, setCourseCategory, courseThumb, setCourseThumb, coursePrice, setCoursePrice, courseLevel, setCourseLevel, courseTags, setCourseTags,
    showLessonModal, setShowLessonModal, lessonTitle, setLessonTitle, lessonContent, setLessonContent, lessonVideo, setLessonVideo, lessonDuration, setLessonDuration,
    showQuizModal, setShowQuizModal, quizTitle, setQuizTitle, quizPassing, setQuizPassing, quizLimit, setQuizLimit, quizAttempts, setQuizAttempts, quizDeadline, setQuizDeadline, quizAttachmentUrl, setQuizAttachmentUrl,
    showQuestionModal, setShowQuestionModal, qText, setQText, qType, setQType, qOptions, setQOptions, qCorrect, setQCorrect,
    showAssignModal, setShowAssignModal, assignTitle, setAssignTitle, assignDesc, setAssignDesc, assignDeadline, setAssignDeadline, assignMaxScore, setAssignMaxScore, assignAttachmentUrl, setAssignAttachmentUrl,
    activeSubmissionId, setActiveSubmissionId, gradingScore, setGradingScore, gradingFeedback, setGradingFeedback,
    store, currentUser, myCourses, myCourseIds, handleOpenCreateCourse, handleOpenEditCourse, handleSaveCourse,
    handleSubmitCourseForApproval, handleAddLessonSubmit, handleAddQuizSubmit, handleAddQuestionSubmit, handleAddAssignmentSubmit,
    handleGradeSubmission, handleExportCSVGradebook, activeCourse, lessons, courseQuizzes, courseAssignments, myAssignments, studentSubmissionsRaw, updateStore,
    triggerToast, onRefreshData
  };

  return (
    <div className="space-y-8">
      {/* Toast Alert bottom right */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#16a34a] text-white font-medium text-xs px-4 py-3 rounded-2xl shadow-2xl border border-white/10">
          {toastMessage}
        </div>
      )}

      {/* Header section spacing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold tracking-widest text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase">
            {activeSystem === "SIS" ? "Học Vụ Hành Chính SIS" : "Góc Nghiệp vụ Giảng viên"}
          </span>
          <h2 className="text-2xl font-display font-bold text-white mt-1.5">
            {activeSystem === "SIS" ? "Quản lý Lịch giảng dạy & Chuyên cần" : "Bàn làm việc & Chấm điểm Học thuật"}
          </h2>
          <p className="text-sm text-white/60">
            {activeSystem === "SIS" 
              ? "Theo dõi ca học đứng lớp, phân bổ thời khóa biểu dạy tuần và quản lý lớp học hành chính."
              : "Tải lên giáo án bài giảng mới, thiết lập đề thi đánh giá tự động, quản lý điểm và tương tác trực quan với học viên."
            }
          </p>
        </div>

        {activeSystem !== "SIS" && (
          <button
            onClick={handleOpenCreateCourse}
            className="px-4 py-2 text-xs font-bold text-indigo-950 bg-white hover:bg-white/95 rounded-xl flex items-center gap-1.5 transition duration-150 cursor-pointer self-start"
          >
            <FolderPlus className="h-4 w-4" /> Khởi tạo Khóa học Mới
          </button>
        )}
      </div>

      {/* Side-by-side dashboard layout: sidebar navigation on the left, workspace canvas on the right */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
        {/* Mobile: sidebar toggle bar */}
        <div className="lg:hidden w-full">
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/70 hover:text-white hover:bg-white/8 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
              <span className="font-semibold">Menu điều hướng</span>
              <span className="text-white/40">— đang xem: <strong className="text-indigo-300">{{
                teacher_guide: "Hướng dẫn sử dụng",
                courses: "Chương trình Đào tạo",
                quizzes: "Đề thi & Đánh giá",
                assignments: "Bài tập & Chấm điểm",
                gradebook: "Sổ điểm Tổng hợp",
                analytics: "Báo cáo Hiệu suất",
                timetable: "Thời khóa biểu giảng dạy",
                attendance: "Điểm danh lớp học",
                advising: "Cố vấn học tập",
              }[activeSubTab] || activeSubTab}</strong></span>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showSidebar ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Left Navigation Sidebar */}
        <div className={`w-full lg:w-64 xl:w-72 flex flex-col gap-4 shrink-0 ${showSidebar ? "block" : "hidden"} lg:flex lg:flex-col`}>
          <div className="bg-white/3 border border-white/10 rounded-3xl p-3 flex flex-col gap-1 w-full text-xs">
            <span className="text-[10px] text-white/40 uppercase tracking-widest px-3 py-2 font-bold font-mono border-b border-white/5 mb-1.5">
              {activeSystem === "SIS" ? "HỒ SƠ HỌC VỤ SIS" : "GIẢNG DẠY LMS"}
            </span>
            
            {activeSystem === "SIS" ? (
              <>
                <button
                  onClick={() => handleNavClick("teacher_guide")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "teacher_guide" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <HelpCircle className={`h-4.5 w-4.5 ${activeSubTab === "teacher_guide" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Hướng dẫn sử dụng</span>
                </button>
                <button
                  onClick={() => handleNavClick("timetable")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "timetable" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Clock className={`h-4.5 w-4.5 ${activeSubTab === "timetable" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Thời khóa biểu giảng dạy</span>
                </button>
                <button
                  onClick={() => handleNavClick("advising")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "advising" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Users className={`h-4.5 w-4.5 ${activeSubTab === "advising" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Cố vấn học tập</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick("teacher_guide")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "teacher_guide" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <HelpCircle className={`h-4.5 w-4.5 ${activeSubTab === "teacher_guide" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Hướng dẫn sử dụng</span>
                </button>
                <button
                  onClick={() => { handleNavClick("courses"); setSelectedCourseId(null); }}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "courses" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BookOpen className={`h-4.5 w-4.5 ${activeSubTab === "courses" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Chương trình Đào tạo</span>
                </button>
                <button
                  onClick={() => handleNavClick("quizzes")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "quizzes" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <FileText className={`h-4.5 w-4.5 ${activeSubTab === "quizzes" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Đề thi & Đánh giá</span>
                </button>
                <button
                  onClick={() => handleNavClick("assignments")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "assignments" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Edit className={`h-4.5 w-4.5 ${activeSubTab === "assignments" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Bài tập & Chấm điểm</span>
                </button>
                <button
                  onClick={() => handleNavClick("gradebook")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "gradebook" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Award className={`h-4.5 w-4.5 ${activeSubTab === "gradebook" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Sổ điểm Tổng hợp</span>
                </button>
                <button
                  onClick={() => handleNavClick("analytics")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "analytics" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BarChart className={`h-4.5 w-4.5 ${activeSubTab === "analytics" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Báo cáo Hiệu suất</span>
                </button>
                <button
                  onClick={() => handleNavClick("timetable")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "timetable" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Clock className={`h-4.5 w-4.5 ${activeSubTab === "timetable" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Thời khóa biểu</span>
                </button>
                <button
                  onClick={() => handleNavClick("advising")}
                  className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                    activeSubTab === "advising" 
                      ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Users className={`h-4.5 w-4.5 ${activeSubTab === "advising" ? "text-indigo-300" : "text-white/40"}`} />
                  <span>Cố vấn học tập</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Active Panel View Canvas */}
        <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 min-w-0 w-full">
          <CourseBuilder {...teacherPanelProps} />
          <QuizBuilder {...teacherPanelProps} />
          <AssignmentGrader {...teacherPanelProps} />
          <GradebookTable {...teacherPanelProps} />
          <TeacherAnalytics {...teacherPanelProps} />

          {activeSubTab === "timetable" && (
            <Timetable
              role="teacher"
              currentUser={currentUser}
              store={store}
              onRefreshData={onRefreshData}
              onRedirectToAttendance={(courseId, sectionId) => {
                setAttendanceCourseId(courseId);
                setAttendanceSectionId(sectionId);
                setLockAttendanceSelectors(true);
                setActiveSubTab("attendance");
              }}
            />
          )}

          {activeSubTab === "teacher_guide" && (
            <UserGuide
              role="teacher"
              activeSystem={activeSystem}
              onClose={() => setActiveSubTab(activeSystem === "SIS" ? "timetable" : "courses")}
            />
          )}

          {activeSubTab === "attendance" && (
            <AttendanceManager
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              triggerToast={triggerToast}
              lockSelectors={lockAttendanceSelectors}
              courseId={attendanceCourseId}
              sectionId={attendanceSectionId}
              onGoBackToTimetable={() => {
                setAttendanceCourseId(null);
                setAttendanceSectionId(null);
                setLockAttendanceSelectors(false);
                setActiveSubTab("timetable");
              }}
            />
          )}

          {activeSubTab === "advising" && (
            <AdvisorPanel
              currentUser={currentUser}
              onLogout={onLogout}
              onRefreshData={onRefreshData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
