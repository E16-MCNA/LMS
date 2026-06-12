import React, { useState } from "react";
import { 
  Users, 
  Layers, 
  MapPin, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  TrendingUp,
  UserCheck,
  Search
} from "lucide-react";
import { LMSDataStore, User } from "../types";
import { AppStore } from "../store";
import { api } from "../api";

interface ClassPlacementProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
}

const resolveCurrentSemesterId = (store: LMSDataStore) => {
  const semesters = store.semesters || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  return semesters.find(s => s.isCurrent)?.id ||
    semesters.find(s => s.startDate && s.endDate && todayStr >= String(s.startDate).slice(0, 10) && todayStr <= String(s.endDate).slice(0, 10))?.id ||
    semesters[0]?.id ||
    "";
};

export default function ClassPlacement({ store, currentUser, onRefreshData }: ClassPlacementProps) {
  const [activeTab, setActiveTab] = useState<"unplaced" | "waitlisted">("unplaced");
  const [activeSemesterId, setActiveSemesterId] = useState<string>(() => resolveCurrentSemesterId(store));
  const [searchQuery, setSearchQuery] = useState("");
  
  // Placement Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    courseId: string;
    courseTitle: string;
  } | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getUnplacedStudents = () => {
    const enrollments = store.enrollments || [];
    const regs = store.courseRegistrations || [];
    const sections = store.courseSections || [];

    // Filter course-level enrollment requests that still need class placement.
    const activeEnrollments = enrollments.filter(
      e => e.status === "pending" || e.status === "active"
    );

    return activeEnrollments.map(e => {
      const student = store.users.find(u => u.id === e.studentId);
      const course = store.courses.find(c => c.id === e.courseId);

      if (!student || !course) return null;

      // Find registrations for this student in sections of this course for the active semester
      const studentRegsForCourse = regs.filter(r => 
        r.studentId === e.studentId && 
        r.semesterId === activeSemesterId &&
        ["registered", "completed"].includes(r.status) &&
        sections.some(s => s.id === r.sectionId && s.courseId === e.courseId)
      );

      // If no active registration exists, the student is unplaced!
      if (studentRegsForCourse.length === 0) {
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          studentName: student.name,
          studentEmail: student.email,
          courseId: e.courseId,
          courseTitle: course.title,
          enrolledAt: e.enrolledAt,
          status: e.status
        };
      }
      return null;
    }).filter(Boolean) as Array<{
      enrollmentId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      courseId: string;
      courseTitle: string;
      enrolledAt: string;
      status: string;
    }>;
  };

  const getWaitlistedStudents = () => {
    const regs = store.courseRegistrations || [];
    const waitlisted = regs.filter(r => r.status === "waitlisted" && r.semesterId === activeSemesterId);

    return waitlisted.map(r => {
      const student = store.users.find(u => u.id === r.studentId);
      const section = (store.courseSections || []).find(s => s.id === r.sectionId);
      const course = section ? store.courses.find(c => c.id === section.courseId) : null;

      if (!student || !section || !course) return null;

      return {
        registrationId: r.id,
        studentId: r.studentId,
        studentName: student.name,
        studentEmail: student.email,
        sectionId: r.sectionId,
        sectionCode: section.sectionCode,
        courseTitle: course.title,
        registeredAt: r.registeredAt,
        credits: r.credits
      };
    }).filter(Boolean) as Array<{
      registrationId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      sectionId: string;
      sectionCode: string;
      courseTitle: string;
      registeredAt: string;
      credits: number;
    }>;
  };

  const unplacedList = getUnplacedStudents().filter(item => 
    item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const waitlistedList = getWaitlistedStudents().filter(item => 
    item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenPlacement = (item: typeof unplacedList[0]) => {
    setSelectedEnrollment({
      enrollmentId: item.enrollmentId,
      studentId: item.studentId,
      studentName: item.studentName,
      courseId: item.courseId,
      courseTitle: item.courseTitle
    });
    // Set default section as first available
    const availableSections = (store.courseSections || []).filter(
      s => s.courseId === item.courseId && s.semesterId === activeSemesterId && s.status === "open"
    );
    setSelectedSectionId(availableSections[0]?.id || "");
    setShowModal(true);
  };

  // Submit placement
  const handleAssignPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment || !selectedSectionId) {
      triggerToast("⚠️ Vui lòng chọn một lớp học phần hợp lệ!");
      return;
    }

    const section = (store.courseSections || []).find(s => s.id === selectedSectionId);
    
    if (!section) {
      triggerToast("⚠️ Không tìm thấy thông tin lớp học phần!");
      return;
    }

    // Check capacity
    const currentRegs = (store.courseRegistrations || []).filter(
      r => r.sectionId === selectedSectionId && r.status === "registered"
    ).length;

    if (currentRegs >= section.maxStudents) {
      if (!window.confirm("⚠️ Lớp này đã đạt sĩ số tối đa. Bạn có chắc chắn muốn xếp lớp vượt sĩ số giới hạn (Over-enroll)?")) {
        return;
      }
    }

    try {
      await api.approveEnrollment(selectedEnrollment.enrollmentId, {
        sectionId: selectedSectionId,
        semesterId: activeSemesterId
      });
      setShowModal(false);
      onRefreshData();
      triggerToast(`✅ Đã duyệt và xếp lớp thành công cho học viên ${selectedEnrollment.studentName}!`);
    } catch (err: any) {
      triggerToast(err.message || "Không thể duyệt và xếp lớp học viên.");
    }
  };

  // Approve waitlist registration
  const handleApproveWaitlist = (id: string, name: string, code: string) => {
    if (!window.confirm(`Xác nhận duyệt học viên ${name} từ danh sách chờ vào đăng ký chính thức của lớp ${code}?`)) return;

    const storeData = AppStore.get();
    storeData.courseRegistrations = (storeData.courseRegistrations || []).map(r => {
      if (r.id === id) {
        return { ...r, status: "registered" as any };
      }
      return r;
    });

    AppStore.log(currentUser.id, "approve_waitlist", name, `Phê duyệt học viên vào lớp chính thức ${code}.`);
    AppStore.save(storeData);
    onRefreshData();
    triggerToast(`✅ Đã xếp lớp thành công cho ${name}!`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 border border-white/20 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Header controls block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-indigo-400" />
            Điều phối & Sắp xếp Lớp học
          </h3>
          <p className="text-xs text-white/50 mt-1">
            Quản lý những học viên đã đóng học phí/đăng ký môn học nhưng chưa được phân vào lớp cụ thể để đi học theo thời khóa biểu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activeSemesterId}
            onChange={(e) => setActiveSemesterId(e.target.value)}
            className="px-3 py-1.5 bg-black/40 text-white border border-white/10 rounded-xl text-xs focus:outline-none"
          >
            {store.semesters.map(sem => (
              <option key={sem.id} value={sem.id}>{sem.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono">
            Học viên chờ xếp lớp
          </span>
          <h4 className="text-3xl font-mono font-black text-white">{getUnplacedStudents().length} HV</h4>
          <p className="text-[10px] text-white/40">Đã đăng ký nhưng chưa có lịch học cụ thể.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest font-mono">
            Danh sách chờ (Waitlist)
          </span>
          <h4 className="text-3xl font-mono font-black text-amber-400">{getWaitlistedStudents().length} HV</h4>
          <p className="text-[10px] text-white/40">Đang xếp hàng chờ lớp học phần trống chỗ.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">
            Lớp học phần hoạt động
          </span>
          <h4 className="text-3xl font-mono font-black text-emerald-400">
            {(store.courseSections || []).filter(s => s.semesterId === activeSemesterId && s.status === "open").length} Lớp
          </h4>
          <p className="text-[10px] text-white/40">Lớp học phần mở trong kỳ {activeSemesterId}.</p>
        </div>
      </div>

      {/* Tab select and search input bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
        <div className="flex gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("unplaced")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "unplaced" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Chờ xếp lớp ({getUnplacedStudents().length})
          </button>
          <button
            onClick={() => setActiveTab("waitlisted")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "waitlisted" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Danh sách Chờ ({getWaitlistedStudents().length})
          </button>
        </div>

        <div className="relative max-w-md w-full">
          <input
            type="text"
            placeholder="Tìm theo tên học viên, môn học..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
          />
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 overflow-x-auto">
        {activeTab === "unplaced" ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="py-3">Học viên chờ xếp</th>
                <th className="py-3">Môn học đã đăng ký</th>
                <th className="py-3">Ngày đăng ký môn</th>
                <th className="py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/85">
              {unplacedList.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/2 transition">
                  <td className="py-3.5">
                    <div className="font-bold text-white">{item.studentName}</div>
                    <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                  </td>
                  <td className="py-3.5 font-semibold text-white/90">{item.courseTitle}</td>
                  <td className="py-3.5 font-mono text-indigo-300">
                    {new Date(item.enrolledAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleOpenPlacement(item)}
                      className="px-3.5 py-1.5 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer text-[10.5px] inline-flex items-center gap-1"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Xếp lớp học phần
                    </button>
                  </td>
                </tr>
              ))}

              {unplacedList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-white/30 italic">
                    🎉 Tất cả học viên đã được sắp xếp lớp học cụ thể học kỳ này!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="py-3">Học viên chờ lớp</th>
                <th className="py-3">Môn học đăng ký</th>
                <th className="py-3">Mã lớp xếp hàng</th>
                <th className="py-3">Đăng ký vào</th>
                <th className="py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/85">
              {waitlistedList.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/2 transition">
                  <td className="py-3.5">
                    <div className="font-bold text-white">{item.studentName}</div>
                    <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                  </td>
                  <td className="py-3.5 font-semibold text-white/90">{item.courseTitle}</td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 font-mono font-bold rounded text-[10px]">
                      {item.sectionCode}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-indigo-300">
                    {new Date(item.registeredAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleApproveWaitlist(item.registrationId, item.studentName, item.sectionCode)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-[10.5px] inline-flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" /> Phê duyệt vào lớp
                    </button>
                  </td>
                </tr>
              ))}

              {waitlistedList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-white/30 italic">
                    Danh sách chờ lớp học phần hiện tại trống.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PLACEMENT MODAL */}
      {showModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center bg-white/3 px-6 py-4 border-b border-white/5">
              <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
                <Layers className="h-5 w-5 text-indigo-400" />
                Xếp lớp Học phần Hành chính
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleAssignPlacement} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono">Học viên lựa chọn</span>
                <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                  <h5 className="font-bold text-white text-sm">{selectedEnrollment.studentName}</h5>
                  <p className="text-[11px] text-white/50 mt-0.5">Môn học đã ghi danh: <strong className="text-white">{selectedEnrollment.courseTitle}</strong></p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/60 block font-bold">Chọn lớp học phần trống chỗ</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 text-xs"
                >
                  <option value="">-- Chọn Lớp học phần mở trong kỳ --</option>
                  {(store.courseSections || [])
                    .filter(s => s.courseId === selectedEnrollment.courseId && s.semesterId === activeSemesterId && s.status === "open")
                    .map(s => {
                      const currentCount = (store.courseRegistrations || []).filter(
                        r => r.sectionId === s.id && r.status === "registered"
                      ).length;

                      const scheduleSummary = s.schedule.map(slot => 
                        `${slot.dayOfWeek} (${slot.startTime}-${slot.endTime})`
                      ).join(", ");

                      return (
                        <option key={s.id} value={s.id}>
                          {s.sectionCode} - Phòng {s.schedule[0]?.room || "Chưa gán"} ({currentCount}/{s.maxStudents} HV) - Lịch: {scheduleSummary}
                        </option>
                      );
                    })}
                </select>

                {(store.courseSections || []).filter(
                  s => s.courseId === selectedEnrollment.courseId && s.semesterId === activeSemesterId && s.status === "open"
                ).length === 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span>
                      ⚠️ Hiện chưa có lớp học phần mở nào cho môn học này trong học kỳ {activeSemesterId}. Vui lòng tạo mới Lớp học phần trước!
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Modal Actions */}
              <div className="border-t border-white/5 pt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!selectedSectionId}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Xác nhận Xếp lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
