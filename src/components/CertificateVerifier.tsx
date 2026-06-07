import React, { useState } from "react";
import { 
  Award, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  User, 
  BookOpen, 
  Calendar, 
  Layers, 
  AlertCircle,
  HelpCircle,
  FileCheck,
  Check,
  Trash2
} from "lucide-react";
import { LMSDataStore, User as UserType, Certificate } from "../types";
import { api } from "../api";

interface CertificateVerifierProps {
  store: LMSDataStore;
  currentUser: UserType;
  onRefreshData: () => void;
}

export default function CertificateVerifier({ store, onRefreshData }: CertificateVerifierProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "lookup" | "registry">("pending");
  
  // Verification Lookup States
  const [verifyCode, setVerifyCode] = useState("");
  const [searchedCertificate, setSearchedCertificate] = useState<Certificate | null>(null);
  const [searchHasRun, setSearchHasRun] = useState(false);

  // General States
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Find all students eligible for a certificate but not yet issued
  const getEligiblePendingStudents = () => {
    const enrollments = store.enrollments || [];
    const lessons = store.lessons || [];
    const progress = store.lessonProgress || [];
    const quizAttempts = store.quizAttempts || [];
    const certificates = store.certificates || [];
    const quizzes = store.quizzes || [];

    const eligibleList: Array<{
      enrollmentId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      courseId: string;
      courseTitle: string;
      lessonsCompleted: number;
      lessonsTotal: number;
      quizScore: number;
      quizPassingScore: number;
      isPassed: boolean;
    }> = [];

    enrollments.forEach(enroll => {
      // 1. Skip if certificate already issued
      const hasCert = certificates.some(c => c.studentId === enroll.studentId && c.courseId === enroll.courseId);
      if (hasCert) return;

      const student = store.users.find(u => u.id === enroll.studentId);
      const course = store.courses.find(c => c.id === enroll.courseId);
      if (!student || !course) return;

      // 2. Count lessons & progress
      const courseLessons = lessons.filter(l => l.courseId === enroll.courseId);
      const lessonsTotal = courseLessons.length;
      if (lessonsTotal === 0) return; // skip courses with no lessons yet

      const completedCount = progress.filter(p => 
        p.enrollmentId === enroll.id && p.completed
      ).length;

      const allLessonsCompleted = completedCount >= lessonsTotal;

      // 3. Check quiz attempts
      const courseQuiz = quizzes.find(q => q.courseId === enroll.courseId);
      if (!courseQuiz) return; // skip courses with no final quiz

      const attempts = quizAttempts.filter(a => 
        a.studentId === enroll.studentId && a.quizId === courseQuiz.id
      );

      const bestAttempt = attempts.reduce((max, cur) => cur.score > max ? cur.score : max, -1);
      const isPassed = bestAttempt >= courseQuiz.passingScore;

      // Eligible if completed 100% lessons AND passed the final quiz!
      if (allLessonsCompleted && isPassed) {
        eligibleList.push({
          enrollmentId: enroll.id,
          studentId: enroll.studentId,
          studentName: student.name,
          studentEmail: student.email,
          courseId: enroll.courseId,
          courseTitle: course.title,
          lessonsCompleted: completedCount,
          lessonsTotal,
          quizScore: bestAttempt,
          quizPassingScore: courseQuiz.passingScore,
          isPassed
        });
      }
    });

    return eligibleList;
  };

  const pendingList = getEligiblePendingStudents().filter(item => 
    item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const registryList = (store.certificates || []).map(cert => {
    const student = store.users.find(u => u.id === cert.studentId);
    const course = store.courses.find(c => c.id === cert.courseId);
    return {
      ...cert,
      studentName: student?.name || "Không xác định",
      studentEmail: student?.email || "—",
      courseTitle: course?.title || "Không xác định"
    };
  }).filter(cert => 
    cert.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cert.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.certificateCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Verify Single Code
  const handleLookupCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    const cert = (store.certificates || []).find(
      c => c.certificateCode.trim().toLowerCase() === verifyCode.trim().toLowerCase()
    );

    setSearchedCertificate(cert || null);
    setSearchHasRun(true);
    if (cert) {
      triggerToast("✅ Chứng chỉ được tìm thấy và xác thực thành công!");
    } else {
      triggerToast("❌ Mã chứng chỉ không tồn tại trong hệ thống!");
    }
  };

  // Manually Approve & Issue Certificate
  const handleIssueCertificate = async (item: typeof pendingList[0]) => {
    if (!window.confirm(`Xác nhận Phê duyệt kết quả và phát hành Chứng chỉ tốt nghiệp cho học viên ${item.studentName}?`)) return;

    try {
      const certificate = await api.issueCertificate({ enrollmentId: item.enrollmentId });
      onRefreshData();
      triggerToast(`🏆 Đã cấp thành công chứng chỉ mã ${certificate.certificateCode} cho ${item.studentName}!`);
    } catch (err: any) {
      triggerToast(err.message || "Không thể cấp chứng chỉ.");
    }
  };

  // Revoke/Delete Certificate
  const handleRevokeCertificate = async (id: string, code: string, name: string) => {
    if (!window.confirm(`⚠️ Cảnh báo: Bạn có chắc chắn muốn THU HỒI chứng chỉ mã "${code}" của học viên "${name}"? Hành động này sẽ xóa vĩnh viễn chứng nhận khỏi hệ thống.`)) return;

    try {
      await api.revokeCertificate(id);
      onRefreshData();
      triggerToast(`🗑️ Đã thu hồi chứng chỉ ${code}!`);
    } catch (err: any) {
      triggerToast(err.message || "Không thể thu hồi chứng chỉ.");
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 border border-white/20 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Header block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Award className="h-5.5 w-5.5 text-indigo-400" />
            Duyệt & Xác thực Chứng chỉ Tốt nghiệp
          </h3>
          <p className="text-xs text-white/50 mt-1">
            Xem xét kết quả trắc nghiệm và tiến độ học bài của học viên, phê duyệt phát hành văn bằng số hóa độc bản bảo mật.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono">
            Chờ xét duyệt chứng chỉ
          </span>
          <h4 className="text-3xl font-mono font-black text-white">{getEligiblePendingStudents().length} Học viên</h4>
          <p className="text-[10px] text-white/40">Học viên đã học xong 100% & thi đạt điểm quiz.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">
            Tổng chứng chỉ đã cấp
          </span>
          <h4 className="text-3xl font-mono font-black text-emerald-400">
            {(store.certificates || []).length} Văn bằng
          </h4>
          <p className="text-[10px] text-white/40">Văn bằng số hóa đang lưu hành trong hệ thống.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest font-mono">
            Tỷ lệ tốt nghiệp trung bình
          </span>
          <h4 className="text-3xl font-mono font-black text-amber-400">
            {store.enrollments && store.enrollments.length > 0 
              ? Math.round(((store.certificates || []).length / store.enrollments.length) * 100) 
              : 0}%
          </h4>
          <p className="text-[10px] text-white/40">Số chứng chỉ cấp / Tổng số lượt đăng ký môn.</p>
        </div>
      </div>

      {/* Tab Select and filter bar */}
      <div className="space-y-3 bg-white/5 p-3 rounded-2xl border border-white/10">
        <div className="flex flex-wrap gap-1 w-full">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "pending" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Chờ cấp chứng nhận ({getEligiblePendingStudents().length})
          </button>
          <button
            onClick={() => setActiveTab("lookup")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "lookup" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Xác thực Mã (Verify Code)
          </button>
          <button
            onClick={() => setActiveTab("registry")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "registry" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Sổ Chứng Chỉ ({ (store.certificates || []).length })
          </button>
        </div>

        {activeTab !== "lookup" && (
          <div className="relative w-full max-w-none">
            <input
              type="text"
              placeholder="Tìm theo tên học viên, môn học, mã..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
          </div>
        )}
      </div>

      {/* TAB CONTENT: LOOKUP / VERIFY CODE */}
      {activeTab === "lookup" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleLookupCode} className="lg:col-span-5 bg-white/3 border border-white/5 p-6 rounded-3xl space-y-4">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 text-indigo-400">
              <ShieldCheck className="h-4.5 w-4.5" /> Tra cứu văn bằng chính thống
            </h5>
            <p className="text-[11.5px] text-white/60 leading-relaxed font-sans">
              Mỗi chứng chỉ phát ra từ MCNA LMS đều mang một mã kiểm định số hóa duy nhất. Nhập mã này để kiểm tra xem văn bằng đó có hợp pháp và chính chủ hay không.
            </p>

            <div className="space-y-1">
              <label className="text-white/50 block font-bold">Mã số chứng nhận cần xác thực</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: MCNA-XXXX-XXXX"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-black/25 border border-white/10 text-white font-mono uppercase rounded-xl focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-indigo-950 hover:bg-slate-50 font-bold rounded-xl cursor-pointer text-xs"
                >
                  Kiểm tra
                </button>
              </div>
            </div>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {searchHasRun && (
              searchedCertificate ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-black text-white uppercase text-[10px] tracking-wide block">Xác thực thành công!</span>
                      <p className="text-emerald-300">Chứng nhận là hợp lệ, được lưu ký chính chủ tại Cổng Học vụ MCNA.</p>
                    </div>
                  </div>

                  {/* VISUAL CERTIFICATE PREVIEW CARD */}
                  <div className="relative overflow-hidden bg-slate-950 border-2 border-amber-500/40 rounded-3xl p-8 shadow-2xl backdrop-blur-md font-sans">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full filter blur-2xl" />
                    
                    <div className="space-y-5 text-center relative z-10">
                      <div className="flex justify-between items-start border-b border-amber-500/20 pb-3">
                        <Award className="h-10 w-10 text-amber-400 mx-auto" />
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase block">HỆ THỐNG ĐÀO TẠO MCNA LMS</span>
                        <h4 className="font-display font-black text-white text-xl leading-tight tracking-tight uppercase">CHỨNG CHỈ TỐT NGHIỆP</h4>
                        <p className="text-xs text-white/40 italic font-serif leading-relaxed">Được trân trọng trao tặng cho học viên:</p>
                        
                        <h3 className="text-lg font-black text-white tracking-wide border-b border-white/5 pb-2 max-w-sm mx-auto">
                          {store.users.find(u => u.id === searchedCertificate.studentId)?.name || "Học viên MCNA"}
                        </h3>

                        <p className="text-xs text-white/60 font-sans leading-relaxed max-w-md mx-auto pt-2">
                          Vì đã xuất sắc hoàn thành toàn diện lộ trình đào tạo, tích lũy đủ tín chỉ và vượt qua kỳ thi sát hạch cuối khóa của môn học chuyên đề học phần:
                        </p>
                        <h5 className="font-bold text-amber-300 text-sm">{store.courses.find(c => c.id === searchedCertificate.courseId)?.title || "Khóa đào tạo"}</h5>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex items-center justify-between gap-4 text-[10.5px] font-mono text-white/40 text-left max-w-md mx-auto">
                        <div>
                          <span className="block uppercase text-[8.5px]">Ngày phê duyệt</span>
                          <span className="text-white/80 font-bold">{new Date(searchedCertificate.issuedAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                        <div className="text-right">
                          <span className="block uppercase text-[8.5px]">Mã kiểm định độc bản</span>
                          <span className="text-amber-400 font-bold tracking-widest font-mono uppercase">{searchedCertificate.certificateCode}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                  <div>
                    <span className="font-black text-white uppercase text-[10px] tracking-wide block">Xác thực thất bại!</span>
                    <p className="text-red-300">Không tìm thấy mã chứng chỉ này trong hệ thống. Vui lòng kiểm tra lại ký tự hoa thường và dấu gạch ngang.</p>
                  </div>
                </div>
              )
            )}

            {!searchHasRun && (
              <div className="flex flex-col items-center justify-center p-12 text-center text-white/30 border border-dashed border-white/5 rounded-3xl">
                <HelpCircle className="h-10 w-10 text-white/10 mb-2" />
                <span className="text-xs font-sans">Nhập mã xác thực ở khung bên trái để bắt đầu tra cứu kiểm định văn bằng số.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ELIGIBLE PENDING STUDENTS FOR CERTIFICATES */}
      {activeTab === "pending" && (
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="py-3">Học viên đủ điều kiện</th>
                <th className="py-3">Môn học học thuật</th>
                <th className="py-3 text-center">Tiến độ bài học</th>
                <th className="py-3 text-center">Điểm thi trắc nghiệm</th>
                <th className="py-3 text-right">Phê duyệt cấp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/85">
              {pendingList.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/2 transition">
                  <td className="py-3.5">
                    <div className="font-bold text-white">{item.studentName}</div>
                    <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                  </td>
                  <td className="py-3.5 font-semibold text-white/90">{item.courseTitle}</td>
                  <td className="py-3.5 text-center font-mono font-bold text-indigo-300">
                    {item.lessonsCompleted} / {item.lessonsTotal} bài
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="px-2.5 py-0.5 bg-emerald-200 text-emerald-950 border border-emerald-100 font-mono font-bold rounded text-[10px]">
                      {item.quizScore}% (Đậu)
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleIssueCertificate(item)}
                      className="px-3.5 py-1.5 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer text-[10.5px] inline-flex items-center gap-1"
                    >
                      <FileCheck className="h-3.5 w-3.5" /> Duyệt & Cấp bằng
                    </button>
                  </td>
                </tr>
              ))}

              {pendingList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-white/30 italic">
                    Hiện chưa ghi nhận thêm học viên mới nào thi đậu & hoàn tất khóa học chờ xét cấp chứng chỉ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: CENTRAL CERTIFICATES REGISTRY */}
      {activeTab === "registry" && (
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="py-3">Học viên sở hữu</th>
                <th className="py-3">Môn học tốt nghiệp</th>
                <th className="py-3">Mã kiểm định độc bản</th>
                <th className="py-3">Ngày phát hành</th>
                <th className="py-3 text-right">Hủy bỏ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/85">
              {registryList.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/2 transition">
                  <td className="py-3.5">
                    <div className="font-bold text-white">{item.studentName}</div>
                    <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                  </td>
                  <td className="py-3.5 font-semibold text-white/90">{item.courseTitle}</td>
                  <td className="py-3.5">
                    <span className="font-mono font-bold text-amber-400 tracking-wider text-[11px]">
                      {item.certificateCode}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-indigo-300">
                    {new Date(item.issuedAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleRevokeCertificate(item.id, item.certificateCode, item.studentName)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold justify-end self-end ml-auto"
                      title="Thu hồi / Hủy chứng chỉ"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Thu hồi
                    </button>
                  </td>
                </tr>
              ))}

              {registryList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-white/30 italic">
                    Sổ lưu ký chứng chỉ hiện đang trống hoặc từ khóa tìm kiếm không chính xác.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
