import React, { useState } from "react";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  PlusCircle, 
  AlertCircle, 
  X, 
  BookOpen, 
  Users, 
  SlidersHorizontal,
  Info,
  Layers,
  GraduationCap
} from "lucide-react";
import { LMSDataStore, User as UserType, Course, CourseSection, CourseRegistration } from "../types";
import { AppStore } from "../store";
import { generateId } from "../utils";
import { api } from "../api";

interface TimetableProps {
  role: "student" | "teacher" | "admin";
  currentUser: UserType;
  store: LMSDataStore;
  onRefreshData: () => void;
  defaultLookupType?: "student" | "teacher" | "all";
}

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

const getVietnameseDayOfWeek = (date: Date): string => {
  const day = date.getDay();
  if (day === 0) return "Chủ Nhật";
  if (day === 1) return "Thứ Hai";
  if (day === 2) return "Thứ Ba";
  if (day === 3) return "Thứ Tư";
  if (day === 4) return "Thứ Năm";
  if (day === 5) return "Thứ Sáu";
  return "Thứ Bảy";
};

// Standard schedule ca slots
const STANDARD_SLOTS = [
  { id: 0, label: "Ca 1", time: "08:00 - 10:00", start: "08:00", end: "10:00" },
  { id: 1, label: "Ca 2", time: "10:00 - 12:00", start: "10:00", end: "12:00" },
  { id: 2, label: "Ca 3", time: "13:00 - 15:00", start: "13:00", end: "15:00" },
  { id: 3, label: "Ca 4", time: "15:00 - 17:00", start: "15:00", end: "17:00" },
  { id: 4, label: "Ca 5", time: "18:00 - 20:00", start: "18:00", end: "20:00" }
];

export default function Timetable({ role, currentUser, store, onRefreshData, defaultLookupType }: TimetableProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeSemesterId, setActiveSemesterId] = useState<string>("sem_spring25");

  // Admin Lookup States
  const [lookupType, setLookupType] = useState<"student" | "teacher" | "all">(defaultLookupType || "all");
  const [lookupUserId, setLookupUserId] = useState<string>(() => {
    if (defaultLookupType === "teacher") {
      return store.users.find(u => u.role === "teacher")?.id || "";
    }
    return "";
  });
  const [searchRoom, setSearchRoom] = useState<string>("");

  // Section Management states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // Form states
  const [formCourseId, setFormCourseId] = useState("");
  const [formSemesterId, setFormSemesterId] = useState("sem_spring25");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formSectionCode, setFormSectionCode] = useState("");
  const [formMaxStudents, setFormMaxStudents] = useState<number>(30);
  const [formStatus, setFormStatus] = useState<"open" | "closed" | "cancelled">("open");
  const [formSlots, setFormSlots] = useState<Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>>([
    { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "Phòng A101" }
  ]);
  const [formConflicts, setFormConflicts] = useState<string[]>([]);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const timeToMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Buckets starting hours into our standard slots indexes (0 to 4)
  const getSlotIndex = (startTime: string): number => {
    const mins = timeToMins(startTime);
    if (mins < 600) return 0; // < 10:00 -> Ca 1
    if (mins < 780) return 1; // < 13:00 -> Ca 2
    if (mins < 900) return 2; // < 15:00 -> Ca 3
    if (mins < 1080) return 3; // < 18:00 -> Ca 4
    return 4; // >= 18:00 -> Ca 5
  };

  // Conflict Checker
  const checkConflicts = (
    sectionId: string | null,
    teacherId: string,
    slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>,
    semesterId: string
  ): string[] => {
    const sections = store.courseSections || [];
    const activeSections = sections.filter(
      s => s.id !== sectionId && s.semesterId === semesterId && s.status !== "cancelled"
    );

    const conflicts: string[] = [];

    slots.forEach(slot => {
      const start = timeToMins(slot.startTime);
      const end = timeToMins(slot.endTime);

      if (start >= end) {
        conflicts.push(`Ca học vào ${slot.dayOfWeek} có giờ bắt đầu (${slot.startTime}) phải nhỏ hơn giờ kết thúc (${slot.endTime}).`);
        return;
      }

      activeSections.forEach(sec => {
        sec.schedule.forEach(secSlot => {
          if (secSlot.dayOfWeek === slot.dayOfWeek) {
            const secStart = timeToMins(secSlot.startTime);
            const secEnd = timeToMins(secSlot.endTime);

            // Overlap logic: startA < endB && startB < endA
            const isOverlapping = start < secEnd && secStart < end;

            if (isOverlapping) {
              // Check teacher conflict
              if (sec.teacherId === teacherId) {
                const tName = store.users.find(u => u.id === teacherId)?.name || "Giảng viên";
                const cTitle = store.courses.find(c => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Giảng viên ${tName} đã bị trùng lịch dạy lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} cùng ngày ${slot.dayOfWeek}.`
                );
              }
              // Check room conflict
              if (secSlot.room.trim().toLowerCase() === slot.room.trim().toLowerCase() && slot.room.trim()) {
                const cTitle = store.courses.find(c => c.id === sec.courseId)?.title || "Môn học";
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

  // Determine current filtered sections to render in the timetable
  const getRenderSections = (): CourseSection[] => {
    const allSections = store.courseSections || [];
    const activeSemesterSections = allSections.filter(s => s.semesterId === activeSemesterId);

    if (role === "student") {
      const myRegIds = (store.courseRegistrations || [])
        .filter(r => r.studentId === currentUser.id && r.status === "registered")
        .map(r => r.sectionId);
      return activeSemesterSections.filter(s => myRegIds.includes(s.id));
    }

    if (role === "teacher") {
      return activeSemesterSections.filter(s => s.teacherId === currentUser.id);
    }

    // Role is ADMIN
    if (lookupType === "student" && lookupUserId) {
      const studentRegs = (store.courseRegistrations || [])
        .filter(r => r.studentId === lookupUserId && r.status === "registered")
        .map(r => r.sectionId);
      return activeSemesterSections.filter(s => studentRegs.includes(s.id));
    }

    if (lookupType === "teacher" && lookupUserId) {
      return activeSemesterSections.filter(s => s.teacherId === lookupUserId);
    }

    if (searchRoom.trim()) {
      return activeSemesterSections.filter(s => 
        s.schedule.some(slot => slot.room.toLowerCase().includes(searchRoom.toLowerCase()))
      );
    }

    return activeSemesterSections;
  };

  const renderedSections = getRenderSections();

  // Create list of items with coordinates for grid rendering
  interface TimetableCellItem {
    section: CourseSection;
    courseTitle: string;
    teacherName: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string;
  }

  const gridData: Record<string, TimetableCellItem[]> = {};
  renderedSections.forEach(sec => {
    const courseTitle = store.courses.find(c => c.id === sec.courseId)?.title || "Môn học";
    const teacherName = store.users.find(u => u.id === sec.teacherId)?.name || "Giảng viên";

    sec.schedule.forEach(slot => {
      const slotIdx = getSlotIndex(slot.startTime);
      const key = `${slot.dayOfWeek}_${slotIdx}`;
      if (!gridData[key]) gridData[key] = [];
      gridData[key].push({
        section: sec,
        courseTitle,
        teacherName,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room
      });
    });
  });

  // Flat list of all sessions sorted by day and time
  const dayOrder: Record<string, number> = {
    "Thứ Hai": 1, "Thứ Ba": 2, "Thứ Tư": 3, "Thứ Năm": 4, "Thứ Sáu": 5, "Thứ Bảy": 6, "Chủ Nhật": 7
  };

  const sortedScheduleList = renderedSections.flatMap(sec => {
    const courseTitle = store.courses.find(c => c.id === sec.courseId)?.title || "Môn học";
    const teacherName = store.users.find(u => u.id === sec.teacherId)?.name || "Giảng viên";

    return sec.schedule.map(slot => ({
      ...slot,
      section: sec,
      courseTitle,
      teacherName
    }));
  }).sort((a, b) => {
    const orderA = dayOrder[a.dayOfWeek] || 99;
    const orderB = dayOrder[b.dayOfWeek] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.startTime.localeCompare(b.startTime);
  });

  // Save Modal Action
  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId || !formTeacherId || !formSectionCode.trim()) {
      triggerToast("⚠️ Vui lòng nhập đầy đủ: Môn học, Giảng viên và Mã lớp!");
      return;
    }

    // Check overlaps
    const conflicts = checkConflicts(editingSectionId, formTeacherId, formSlots, formSemesterId);
    if (conflicts.length > 0) {
      setFormConflicts(conflicts);
      triggerToast("❗ Phát hiện xung đột trùng lịch biểu. Vui lòng kiểm tra kỹ chi tiết báo đỏ!");
      return;
    }

    const storeData = AppStore.get();
    if (modalMode === "create") {
      const newSection: CourseSection = {
        id: generateId("section"),
        courseId: formCourseId,
        semesterId: formSemesterId,
        teacherId: formTeacherId,
        sectionCode: formSectionCode,
        maxStudents: formMaxStudents,
        schedule: formSlots,
        status: formStatus
      };

      if (!storeData.courseSections) storeData.courseSections = [];
      storeData.courseSections.push(newSection);
      AppStore.log(currentUser.id, "create_section", newSection.sectionCode, `Khởi tạo lớp học phần ${newSection.sectionCode} kèm thời khóa biểu.`);
      triggerToast("✅ Khởi tạo lớp học phần thành công!");
    } else {
      storeData.courseSections = (storeData.courseSections || []).map(s => {
        if (s.id === editingSectionId) {
          AppStore.log(currentUser.id, "edit_section", s.sectionCode, `Cập nhật cấu hình và lịch dạy lớp ${formSectionCode}.`);
          return {
            ...s,
            courseId: formCourseId,
            semesterId: formSemesterId,
            teacherId: formTeacherId,
            sectionCode: formSectionCode,
            maxStudents: formMaxStudents,
            schedule: formSlots,
            status: formStatus
          };
        }
        return s;
      });
      triggerToast("✅ Cập nhật lớp học phần thành công!");
    }

    AppStore.save(storeData);
    setShowModal(false);
    onRefreshData();
  };

  // Open Edit Modal
  const handleOpenEdit = (sec: CourseSection) => {
    setModalMode("edit");
    setEditingSectionId(sec.id);
    setFormCourseId(sec.courseId);
    setFormSemesterId(sec.semesterId);
    setFormTeacherId(sec.teacherId);
    setFormSectionCode(sec.sectionCode);
    setFormMaxStudents(sec.maxStudents);
    setFormStatus(sec.status);
    setFormSlots(sec.schedule);
    setFormConflicts([]);
    setShowModal(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    const allowedCourses = role === "teacher"
      ? store.courses.filter(c => c.teacherId === currentUser.id)
      : store.courses;

    if (role === "teacher" && allowedCourses.length === 0) {
      triggerToast("⚠️ Bạn cần khởi tạo ít nhất một khóa học trước khi lập lớp học phần!");
      return;
    }

    setModalMode("create");
    setEditingSectionId(null);
    setFormCourseId(allowedCourses[0]?.id || "");
    setFormSemesterId(activeSemesterId);
    setFormTeacherId(role === "teacher" ? currentUser.id : (store.users.find(u => u.role === "teacher")?.id || ""));
    setFormSectionCode("");
    setFormMaxStudents(30);
    setFormStatus(role === "teacher" ? "pending" : "open");
    setFormSlots(role === "teacher" ? [] : [{ dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "Phòng A101" }]);
    setFormConflicts([]);
    setShowModal(true);
  };

  const handleDropSection = (
    sectionId: string,
    day: string,
    slot: typeof STANDARD_SLOTS[0],
    draggedDay?: string | null,
    draggedStartTime?: string | null,
    draggedEndTime?: string | null
  ) => {
    if (role !== "admin") return;
    if (!sectionId) return;

    const storeData = AppStore.get();
    const sections = storeData.courseSections || [];
    const sec = sections.find((s: any) => s.id === sectionId);

    if (!sec) {
      triggerToast("⚠️ Lớp học phần không hợp lệ hoặc không tìm thấy!");
      return;
    }

    let newSlots = [];
    if (draggedDay && draggedStartTime && draggedEndTime) {
      // Dragging an existing scheduled slot from the timetable grid.
      // Update only the specific slot being dragged, preserving other slots in the weekly schedule!
      newSlots = sec.schedule.map((s: any) => {
        if (s.dayOfWeek === draggedDay && s.startTime === draggedStartTime && s.endTime === draggedEndTime) {
          return {
            ...s,
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end
          };
        }
        return s;
      });
    } else {
      // Dragging a pending slot from the left queue sidebar.
      // Overwrite the schedule since it wasn't active on the timetable.
      newSlots = [{ dayOfWeek: day, startTime: slot.start, endTime: slot.end, room: "Phòng A101" }];
    }

    // Run overlap logic against other active sections
    const conflicts = checkConflicts(sec.id, sec.teacherId, newSlots, sec.semesterId);
    if (conflicts.length > 0) {
      alert(`❗ Không thể xếp lớp học phần ${sec.sectionCode} do xung đột lịch:\n\n${conflicts.join("\n")}`);
      return;
    }

    // Update section schedule and set status to open (approved)
    storeData.courseSections = sections.map((s: any) => {
      if (s.id === sec.id) {
        AppStore.log(
          currentUser.id,
          "schedule_section_drag_drop",
          s.sectionCode,
          `Phê duyệt & xếp ca lớp ${s.sectionCode} vào ${day} (${slot.start} - ${slot.end}) qua kéo thả.`
        );
        return {
          ...s,
          schedule: newSlots,
          status: "open"
        };
      }
      return s;
    });

    AppStore.save(storeData);
    onRefreshData();
    triggerToast(`✅ Đã phê duyệt & xếp ca lớp ${sec.sectionCode} vào ${day} (${slot.start} - ${slot.end})!`);
  };

  // Delete Section
  const handleDeleteSection = (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học phần "${code}"? Tất cả thông tin lịch dạy sẽ bị hủy bỏ hoàn toàn.`)) return;
    
    const storeData = AppStore.get();
    storeData.courseSections = (storeData.courseSections || []).filter(s => s.id !== id);
    // Also remove registrations associated with it
    storeData.courseRegistrations = (storeData.courseRegistrations || []).filter(r => r.sectionId !== id);

    AppStore.log(currentUser.id, "delete_section", code, `Xóa bỏ lớp học phần và hủy đăng ký môn.`);
    AppStore.save(storeData);
    onRefreshData();
    triggerToast(`🗑️ Đã xóa lớp học phần ${code}!`);
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

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 border border-white/20 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Top Title & System Toggle controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-indigo-400" />
            {role === "student" && "Thời khóa biểu cá nhân của bạn"}
            {role === "teacher" && "Lịch giảng dạy Học thuật"}
            {role === "admin" && "Hệ thống Quản lý Thời khóa biểu tổng"}
          </h3>
          <p className="text-xs text-white/50 mt-1">
            {role === "student" && "Theo dõi cụ thể phòng học, giờ học và giáo sư phụ trách từng môn học."}
            {role === "teacher" && "Kiểm tra giờ đứng lớp, danh sách ca và cập nhật phòng dạy học trực quan."}
            {role === "admin" && "Điều phối, xếp ca học, giải quyết xung đột lịch học của Giảng viên và Phòng học."}
          </p>
        </div>

        {/* View Mode Switching & Semester controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="bg-white/5 p-0.5 border border-white/10 rounded-xl flex">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 text-[10.5px] font-bold rounded-lg transition ${
                viewMode === "grid" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              Lịch tuần (Grid)
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-[10.5px] font-bold rounded-lg transition ${
                viewMode === "list" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              Dạng danh sách (List)
            </button>
          </div>

          <select
            value={activeSemesterId}
            onChange={(e) => setActiveSemesterId(e.target.value)}
            className="px-3 py-1.5 bg-black/40 text-white border border-white/10 rounded-xl text-xs focus:outline-none"
          >
            {store.semesters.map(sem => (
              <option key={sem.id} value={sem.id}>{sem.name}</option>
            ))}
          </select>

          {(role === "admin" || role === "teacher") && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 bg-white text-indigo-950 font-bold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4.5 w-4.5" /> Tạo lớp học
            </button>
          )}
        </div>
      </div>

      {/* Admin Lookup Sidebar tools */}
      {role === "admin" && (
        <div className="bg-white/3 border border-white/5 p-4 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-white/50 block font-bold flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" /> Tra cứu theo nhóm
            </label>
            <select
              value={lookupType}
              onChange={(e) => {
                setLookupType(e.target.value as any);
                setLookupUserId("");
              }}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs"
            >
              <option value="all">Tất cả lớp học phần</option>
              <option value="student">Lịch học của Học sinh</option>
              <option value="teacher">Lịch dạy của Giảng viên</option>
            </select>
          </div>

          {lookupType !== "all" && (
            <div className="space-y-1">
              <label className="text-white/50 block font-bold">
                Chọn {lookupType === "student" ? "Học sinh" : "Giảng viên"}
              </label>
              <select
                value={lookupUserId}
                onChange={(e) => setLookupUserId(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="">-- Chọn tài khoản --</option>
                {store.users
                  .filter(u => u.role === lookupType)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email.split("@")[0]})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-white/50 block font-bold">Tìm theo Phòng học</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ví dụ: Phòng A101"
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                className="w-full px-3 py-2 pl-8 bg-black/20 border border-white/10 rounded-xl text-white text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
            </div>
          </div>

          {/* Quick Clear filters */}
          <div className="flex items-end">
            {(lookupUserId || searchRoom || lookupType !== "all") && (
              <button
                onClick={() => {
                  setLookupType("all");
                  setLookupUserId("");
                  setSearchRoom("");
                }}
                className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 text-xs transition font-semibold"
              >
                Clear bộ lọc tra cứu
              </button>
            )}
          </div>
        </div>
      )}

      {/* DỰNG LỊCH TUẦN DẠNG LƯỚI - GRID MODE (MD trở lên) */}
      {viewMode === "grid" && (
        <div className="hidden md:flex flex-col lg:flex-row gap-6">
          {/* CỘT TRÁI: HÀNG ĐỢI CHỜ DUYỆT (Chỉ dành cho Admin) */}
          {role === "admin" && (
            <div className="w-full lg:w-1/4 bg-white/3 border border-white/10 rounded-3xl p-4 space-y-4 shrink-0 flex flex-col justify-start max-h-[600px] overflow-y-auto font-sans">
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Layers className="h-4.5 w-4.5 animate-pulse" />
                  Chờ duyệt & xếp ca ({
                    (store.courseSections || []).filter(
                      (s: any) => s.status === "pending" && s.semesterId === activeSemesterId
                    ).length
                  })
                </h4>
                <p className="text-[10px] text-white/40 mt-1">
                  Giảng viên đề xuất lớp. Kéo thả thẻ lớp dưới đây vào ca học bất kỳ trên lưới để Phê duyệt & xếp lịch tức thì.
                </p>
              </div>

              <div className="space-y-2.5">
                {(store.courseSections || [])
                  .filter((s: any) => s.status === "pending" && s.semesterId === activeSemesterId)
                  .map((sec: any) => {
                    const courseTitle = store.courses.find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                    const teacherName = store.users.find((u: any) => u.id === sec.teacherId)?.name || "Giảng viên";

                    return (
                      <div
                        key={sec.id}
                        draggable="true"
                        onDragStart={(e) => {
                          e.dataTransfer.setData("sectionId", sec.id);
                        }}
                        className="p-3 bg-slate-900 border border-white/10 rounded-2xl cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition duration-150 relative group shadow-lg"
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded-lg text-[9px] font-mono tracking-wider">
                            {sec.sectionCode}
                          </span>
                          <button
                            onClick={() => handleDeleteSection(sec.id, sec.sectionCode)}
                            className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition p-0.5 cursor-pointer"
                            title="Từ chối / Xóa đề xuất"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="font-bold text-white text-[11px] mt-1.5 leading-normal">
                          {courseTitle}
                        </div>
                        
                        <div className="text-[10px] text-white/40 mt-1 font-sans flex items-center gap-1">
                          <User className="h-3 w-3 text-indigo-400" />
                          <span>GV: {teacherName}</span>
                        </div>

                        <div className="text-[9px] text-white/30 font-mono mt-1">
                          Sĩ số max: {sec.maxStudents}
                        </div>
                      </div>
                    );
                  })}

                {(store.courseSections || []).filter((s: any) => s.status === "pending" && s.semesterId === activeSemesterId).length === 0 && (
                  <div className="text-center py-10 bg-black/10 border border-dashed border-white/5 rounded-2xl text-[10px] text-white/40 italic">
                    Tất cả đề xuất đã được phê duyệt & xếp lịch!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CỘT PHẢI: LƯỚI THỜI KHÓA BIỂU CHÍNH */}
          <div className="flex-1 overflow-x-auto border border-white/10 rounded-3xl bg-slate-950/20">
            <table className="w-full table-fixed min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="py-4 px-2 w-[120px] text-center text-[10.5px] uppercase font-bold text-indigo-300 font-mono border-r border-white/5">Ca / Khung Giờ</th>
                  {DAYS_OF_WEEK.map(day => (
                    <th key={day} className="py-4 px-3 text-center text-xs font-bold text-white uppercase tracking-wider">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {STANDARD_SLOTS.map((slot) => (
                  <tr key={slot.id} className="min-h-[120px] transition duration-150 hover:bg-white/2">
                    <td className="py-6 px-2 text-center border-r border-white/5 bg-black/20 flex-col space-y-1 align-middle">
                      <span className="font-black text-xs text-white block">{slot.label}</span>
                      <span className="font-mono text-[9px] text-white/40 block">{slot.time}</span>
                    </td>

                    {DAYS_OF_WEEK.map(day => {
                      const key = `${day}_${slot.id}`;
                      const sessions = gridData[key] || [];
                      const isDragOver = dragOverCell === key;

                      return (
                        <td 
                          key={day} 
                          className={`p-2 border-r border-white/2 align-top h-[130px] transition-all duration-150 ${
                            isDragOver 
                              ? "bg-indigo-600/15 border-2 border-dashed border-indigo-500 scale-[0.98] shadow-inner" 
                              : ""
                          }`}
                          onDragOver={(e) => {
                            if (role === "admin") {
                              e.preventDefault();
                            }
                          }}
                          onDragEnter={() => {
                            if (role === "admin") {
                              setDragOverCell(key);
                            }
                          }}
                          onDragLeave={() => {
                            if (role === "admin") {
                              setDragOverCell(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (role === "admin") {
                              e.preventDefault();
                              setDragOverCell(null);
                              const sectionId = e.dataTransfer.getData("sectionId");
                              const draggedDay = e.dataTransfer.getData("draggedDay");
                              const draggedStartTime = e.dataTransfer.getData("draggedStartTime");
                              const draggedEndTime = e.dataTransfer.getData("draggedEndTime");
                              handleDropSection(sectionId, day, slot, draggedDay, draggedStartTime, draggedEndTime);
                            }
                          }}
                        >
                          <div className="space-y-2 h-full flex flex-col justify-start">
                            {sessions.map((item, idx) => (
                              <div
                                key={idx}
                                draggable={role === "admin" ? "true" : "false"}
                                onDragStart={(e) => {
                                  if (role === "admin") {
                                    e.dataTransfer.setData("sectionId", item.section.id);
                                    e.dataTransfer.setData("draggedDay", item.dayOfWeek);
                                    e.dataTransfer.setData("draggedStartTime", item.startTime);
                                    e.dataTransfer.setData("draggedEndTime", item.endTime);
                                  }
                                }}
                                className={`p-2.5 rounded-2xl border text-[11px] leading-tight space-y-1.5 transition-all shadow-md backdrop-blur-sm relative overflow-hidden group ${
                                  role === "admin" ? "cursor-grab active:cursor-grabbing hover:border-indigo-400" : ""
                                } ${
                                  role === "student" 
                                    ? "bg-indigo-600/10 hover:bg-indigo-600/15 border-indigo-500/20 text-indigo-200" 
                                    : role === "teacher"
                                    ? "bg-cyan-600/10 hover:bg-cyan-600/15 border-cyan-500/20 text-cyan-200"
                                    : "bg-emerald-600/10 hover:bg-emerald-600/15 border-emerald-500/20 text-emerald-200"
                                }`}
                              >
                                <div className="flex justify-between items-start gap-1 font-bold">
                                  <span className="text-white font-black">{item.section.sectionCode}</span>
                                  {(role === "admin" || (role === "teacher" && item.section.teacherId === currentUser.id)) && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
                                      <button
                                        onClick={() => handleOpenEdit(item.section)}
                                        className="p-0.5 hover:bg-white/10 text-indigo-300 rounded cursor-pointer"
                                        title="Chỉnh sửa ca học"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSection(item.section.id, item.section.sectionCode)}
                                        className="p-0.5 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                                        title="Xóa lớp học phần"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="font-semibold text-white/90 line-clamp-2" title={item.courseTitle}>
                                  {item.courseTitle}
                                </div>

                                <div className="flex items-center gap-1 text-[10px] text-white/50">
                                  <MapPin className="h-3 w-3 text-indigo-400 shrink-0" />
                                  <span className="font-mono">{item.room || "Trực tuyến"}</span>
                                </div>

                                {role !== "teacher" && (
                                  <div className="flex items-center gap-1 text-[10px] text-white/50 pt-1 border-t border-white/5 font-sans">
                                    <User className="h-3 w-3 text-cyan-400 shrink-0" />
                                    <span className="truncate">{item.teacherName}</span>
                                  </div>
                                )}

                                {role === "teacher" && (() => {
                                  const now = new Date();
                                  const currentDay = getVietnameseDayOfWeek(now);
                                  const currentHourStr = now.toTimeString().slice(0, 5); // "HH:MM"
                                  
                                  const currentMins = timeToMins(currentHourStr);
                                  const startMins = timeToMins(item.startTime);
                                  
                                  const isSameDay = item.dayOfWeek === currentDay;
                                  const minutesElapsed = currentMins - startMins;
                                  const isWithinTenMinutes = isSameDay && minutesElapsed >= 0 && minutesElapsed <= 10;
                                  const remainingMinutes = 10 - minutesElapsed;
                                  
                                  if (isWithinTenMinutes) {
                                    const classDateStr = now.toISOString().slice(0, 10);
                                    const hasCheckedIn = (store.teacherAttendance || []).some(
                                      (ta: any) =>
                                        ta.teacherId === currentUser.id &&
                                        ta.sectionId === item.section.id &&
                                        ta.classDate === classDateStr
                                    );

                                    if (hasCheckedIn) {
                                      return (
                                        <div className="mt-2 w-full py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-lg text-center text-[10px] flex items-center justify-center gap-1 font-sans">
                                          ✅ Đã lên lớp (Có mặt)
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            // 1. Mark lecturer checked in
                                            await api.teacherCheckin({
                                              courseId: item.section.courseId,
                                              sectionId: item.section.id,
                                              slotTime: `${item.startTime} - ${item.endTime}`,
                                              classDate: classDateStr
                                            });

                                            // 2. Activate student attendance session
                                            const res = await api.generateAttendanceLink({
                                              courseId: item.section.courseId,
                                              topic: `Điểm danh tự động theo lịch học (${item.startTime} ${item.dayOfWeek})`
                                            });

                                            alert(`🚀 Điểm danh thành công!\n- Giảng viên: Đã có mặt\n- Lớp học: Kích hoạt mã code: ${res.code}`);
                                            onRefreshData();
                                          } catch (err: any) {
                                            alert(err.message || "Không thể thực hiện điểm danh.");
                                          }
                                        }}
                                        className="mt-2 w-full py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-lg transition-all duration-200 text-[10px] flex items-center justify-center gap-1 shadow-lg shadow-orange-500/10 cursor-pointer animate-pulse font-sans"
                                      >
                                        🔑 Giảng viên điểm danh (còn {remainingMinutes}p)
                                      </button>
                                    );
                                  }
                                  
                                  return (
                                    <div className="text-[10px] text-white/40 pt-1 border-t border-white/5 font-mono">
                                      Quy mô: {item.section.maxStudents} HS max
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}

                            {sessions.length === 0 && (
                              <span className="text-[10px] text-white/5 italic text-center block my-auto select-none">Trống</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DẠNG DANH SÁCH - LIST AGENDA MODE (Mọi thiết bị hoặc mobile) */}
      {(viewMode === "list" || viewMode === "grid") && (
        <div className={`${viewMode === "grid" ? "block md:hidden" : "block"} space-y-4`}>
          {sortedScheduleList.map((slot, idx) => (
            <div
              key={idx}
              className="bg-white/3 border border-white/10 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition duration-150 hover:bg-white/5"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-2xl flex flex-col items-center justify-center font-mono w-14 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider block">THỨ</span>
                  <span className="text-[11px] font-black mt-0.5 text-white">{slot.dayOfWeek.split(" ")[1] || slot.dayOfWeek}</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold rounded-lg text-[10px] font-mono tracking-wider">
                      {slot.section.sectionCode}
                    </span>
                    <h5 className="font-bold text-white text-sm leading-snug">{slot.courseTitle}</h5>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/50 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      Lớp học: {slot.startTime} - {slot.endTime}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <MapPin className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      Phòng: {slot.room || "Trực tuyến"}
                    </span>
                    {role !== "teacher" && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        GV: {slot.teacherName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              {(role === "admin" || (role === "teacher" && slot.section.teacherId === currentUser.id)) && (
                <div className="flex gap-2 self-end sm:self-auto items-center">
                  {(() => {
                    const now = new Date();
                    const currentDay = getVietnameseDayOfWeek(now);
                    const currentHourStr = now.toTimeString().slice(0, 5); // "HH:MM"
                    
                    const currentMins = timeToMins(currentHourStr);
                    const startMins = timeToMins(slot.startTime);
                    
                    const isSameDay = slot.dayOfWeek === currentDay;
                    const minutesElapsed = currentMins - startMins;
                    const isWithinTenMinutes = isSameDay && minutesElapsed >= 0 && minutesElapsed <= 10;
                    const remainingMinutes = 10 - minutesElapsed;
                    
                    if (isWithinTenMinutes) {
                      const classDateStr = now.toISOString().slice(0, 10);
                      const hasCheckedIn = (store.teacherAttendance || []).some(
                        (ta: any) =>
                          ta.teacherId === currentUser.id &&
                          ta.sectionId === slot.section.id &&
                          ta.classDate === classDateStr
                      );

                      if (hasCheckedIn) {
                        return (
                          <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-1 font-sans shrink-0">
                            ✅ Đã lên lớp (Có mặt)
                          </div>
                        );
                      }

                      return (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              // 1. Mark lecturer checked in
                              await api.teacherCheckin({
                                courseId: slot.section.courseId,
                                sectionId: slot.section.id,
                                slotTime: `${slot.startTime} - ${slot.endTime}`,
                                classDate: classDateStr
                              });

                              // 2. Activate student attendance session
                              const res = await api.generateAttendanceLink({
                                courseId: slot.section.courseId,
                                topic: `Điểm danh tự động theo lịch học (${slot.startTime} ${slot.dayOfWeek})`
                              });

                              alert(`🚀 Điểm danh thành công!\n- Giảng viên: Đã có mặt\n- Lớp học: Kích hoạt mã code: ${res.code}`);
                              onRefreshData();
                            } catch (err: any) {
                              alert(err.message || "Không thể thực hiện điểm danh.");
                            }
                          }}
                          className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl transition-all duration-200 text-xs flex items-center gap-1 shadow-lg shadow-orange-500/10 cursor-pointer animate-pulse shrink-0 font-sans"
                        >
                          🔑 Giảng viên điểm danh (còn {remainingMinutes}p)
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={() => handleOpenEdit(slot.section)}
                    className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Sửa
                  </button>
                  <button
                    onClick={() => handleDeleteSection(slot.section.id, slot.section.sectionCode)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hủy
                  </button>
                </div>
              )}
            </div>
          ))}

          {sortedScheduleList.length === 0 && (
            <div className="text-center py-16 bg-black/10 border border-dashed border-white/5 rounded-3xl text-xs text-white/40">
              Không có lớp học phần / lịch biểu nào khớp với bộ lọc tra cứu của bạn.
            </div>
          )}
        </div>
      )}

      {/* FORM MODAL THÊM / SỬA LỚP HỌC PHẦN */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex justify-between items-center bg-white/3 px-6 py-4 border-b border-white/5">
              <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
                <Layers className="h-5 w-5 text-indigo-400" />
                {modalMode === "create" ? "Khởi tạo Lớp học phần & Lập thời khóa biểu mới" : `Điều chỉnh lớp học phần ${formSectionCode}`}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Form Scrollable */}
            <form onSubmit={handleSaveSection} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              
              {/* Overlapping warnings red banner */}
              {formConflicts.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[11px] leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-1 font-bold text-xs">
                    <AlertCircle className="h-4.5 w-4.5 text-red-500" /> Phát hiện trùng lặp lịch biểu!
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    {formConflicts.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-white/60 block font-bold">Môn học đào tạo</label>
                  <select
                    value={formCourseId}
                    onChange={(e) => setFormCourseId(e.target.value)}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                  >
                    {store.courses
                      .filter(c => role !== "teacher" || c.teacherId === currentUser.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-white/60 block font-bold">Học Kỳ</label>
                  <select
                    value={formSemesterId}
                    onChange={(e) => setFormSemesterId(e.target.value)}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                  >
                    {store.semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-white/60 block font-bold">Giảng viên phụ trách</label>
                  <select
                    value={formTeacherId}
                    onChange={(e) => setFormTeacherId(e.target.value)}
                    disabled={role === "teacher"}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {store.users
                      .filter(u => u.role === "teacher")
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-white/60 block font-bold">Mã lớp học phần</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: CS101-02"
                    value={formSectionCode}
                    onChange={(e) => setFormSectionCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/60 block font-bold">Sức chứa tối đa (Học sinh)</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={formMaxStudents}
                    onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                  />
                </div>

                {role === "teacher" ? (
                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Trạng thái phê duyệt</label>
                    <div className="px-3 py-2 bg-black/40 text-amber-300 font-bold border border-amber-500/20 rounded-xl text-xs flex items-center gap-1.5 h-[38px]">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>Chờ duyệt & xếp ca</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Trạng thái lớp</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none"
                    >
                      <option value="pending" className="bg-slate-900">Chờ duyệt</option>
                      <option value="open" className="bg-slate-900">Đang mở đăng ký</option>
                      <option value="closed" className="bg-slate-900">Đã khóa</option>
                      <option value="cancelled" className="bg-slate-900">Hủy lớp</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Sub-form for schedules array */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400">
                    Cấu hình ca học chi tiết ({formSlots.length})
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
                          {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
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
                        <label className="text-white/40 text-[10px] block">Phòng học</label>
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

              {/* Footer Modal Actions */}
              <div className="border-t border-white/5 pt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition cursor-pointer"
                >
                  Lưu thiết lập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
