import React, { useState } from "react";
import { 
  X,
  BookOpen, 
  Clock, 
  Award, 
  CheckCircle, 
  CreditCard, 
  Calendar, 
  Search, 
  Users, 
  Database, 
  SlidersHorizontal, 
  Layers, 
  HelpCircle, 
  Activity, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Sparkles,
  BookOpenCheck,
  LifeBuoy,
  ShieldAlert,
  TrendingUp,
  FileSpreadsheet,
  QrCode,
  AlertCircle,
  DollarSign,
  PlusCircle
} from "lucide-react";

interface UserGuideProps {
  role: "student" | "teacher" | "admin" | "manager" | "finance" | "advisor" | "parent" | "sale" | string;
  activeSystem: "SIS" | "LMS";
  onClose?: () => void;
}

export default function UserGuide({ role, activeSystem, onClose }: UserGuideProps) {
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(0);
  const [guideSearch, setGuideSearch] = useState("");

  const toggleSection = (index: number) => {
    setOpenSectionIndex(openSectionIndex === index ? null : index);
  };

  // Guide contents data
  interface GuideItem {
    title: string;
    description: string;
    icon: React.ReactNode;
    steps: string[];
    tips: string;
  }

  const getGuideData = (): GuideItem[] => {
    // 1. STUDENT GUIDES
    if (role === "student") {
      if (activeSystem === "LMS") {
        return [
          {
            title: "Khám phá khóa học & Ghi danh môn mới",
            description: "Tìm kiếm các bài giảng, chương trình đào tạo công khai và đăng ký học trực tuyến.",
            icon: <BookOpen className="h-5 w-5 text-indigo-400" />,
            steps: [
              "Vào tab 'Khám phá học trình' bên thanh Menu dọc trái.",
              "Sử dụng thanh tìm kiếm hoặc bộ lọc danh mục (Web, Python, Cloud,...) để tìm khóa học mong muốn.",
              "Nhấp chọn khóa học để xem tóm tắt mô tả đề cương môn học.",
              "Ấn nút 'Đăng ký ghi danh môn học' để ghi danh môn học ngay lập tức."
            ],
            tips: "💡 Phí ghi danh môn học sẽ được tự động kết toán và tạo hóa đơn nợ học phí gửi về phân hệ SIS của bạn."
          },
          {
            title: "Tham gia Học tập & Làm bài trắc nghiệm cuối khóa",
            description: "Xem nội dung bài giảng, video hướng dẫn, đánh dấu hoàn thành bài và thi sát hạch.",
            icon: <BookOpenCheck className="h-5 w-5 text-indigo-400" />,
            steps: [
              "Vào tab 'Lớp học của tôi' VÀ nhấp chọn khóa học đang tiến hành.",
              "Đọc giáo án và xem video hướng dẫn bài học, sau khi xem xong ấn 'Hoàn thành bài học'.",
              "Khi hoàn thành đầy đủ các bài giảng, nhấp tab 'Đề thi & Đánh giá'.",
              "Đọc kỹ thời gian làm bài, điểm sàn thi đỗ và số lượt làm tối đa, ấn 'Bắt đầu làm đề thi'.",
              "Chọn câu trả lời và ấn nút 'Nộp bài trắc nghiệm' ở cuối trang."
            ],
            tips: "💡 Bạn có thể xem kết quả thi và đáp án chi tiết ngay sau khi nộp bài để rút kinh nghiệm."
          },
          {
            title: "Nộp bài tập tự luận (Assignments)",
            description: "Thực hiện nộp mã nguồn, bài luận, nhận điểm số và phản hồi chi tiết từ Giảng viên.",
            icon: <FileText className="h-5 w-5 text-indigo-400" />,
            steps: [
              "Vào tab 'Bài tập về nhà'. Hệ thống sẽ tự động hiển thị các bài tập của các môn bạn đang học.",
              "Nhấp vào bài tập để xem chi tiết yêu cầu đề bài, thang điểm tối đa và hạn chót nộp bài.",
              "Nhập bài giải/mã nguồn hoặc liên kết bài giải vào khung soạn thảo.",
              "Ấn nút 'Xác nhận nộp bài giải' để gửi bài cho Giảng viên chấm điểm."
            ],
            tips: "💡 Bài tập nộp muộn sau Deadline sẽ có cảnh báo đỏ và có thể bị Giảng viên trừ điểm kỷ luật."
          },
          {
            title: "Kháng nghị điểm số & Phúc khảo bài thi (Appeals)",
            description: "Nộp đơn kháng cáo điểm số tự luận hoặc trắc nghiệm trực tiếp đến Giảng viên phụ trách.",
            icon: <ShieldAlert className="h-5 w-5 text-indigo-400" />,
            steps: [
              "Vào tab 'Sổ điểm' hoặc xem kết quả bài nộp của khóa học tương ứng.",
              "Nếu điểm số hoặc nhận xét chưa thỏa đáng, nhấp nút 'Nộp đơn phúc khảo (Appeal)'.",
              "Nhập lý do khiếu nại chi tiết kèm các bằng chứng / liên kết đối chiếu chứng minh.",
              "Ấn 'Xác nhận gửi đơn kháng nghị'. Giảng viên sẽ nhận được cảnh báo đỏ trên bàn làm việc của họ để rà soát lại bài làm của bạn."
            ],
            tips: "💡 Vui lòng nộp đơn phúc khảo trong vòng tối đa 7 ngày kể từ khi Giảng viên công bố điểm số chính thức."
          },
          {
            title: "Nhận Chứng chỉ tốt nghiệp tự động",
            description: "Hướng dẫn kích hoạt và tải về bằng tốt nghiệp số hóa MCNA.",
            icon: <Award className="h-5 w-5 text-indigo-400" />,
            steps: [
              "Bạn phải hoàn thành đồng thời 2 điều kiện: Học xong 100% bài học VÀ Đạt điểm đỗ bài thi trắc nghiệm kết thúc môn học.",
              "Khi đủ điều kiện, hệ thống sẽ tự động phát hành 1 mã Chứng chỉ tốt nghiệp độc bản.",
              "Vào tab 'Chứng nhận của tôi' để chiêm ngưỡng và kiểm tra văn bằng chứng chỉ số hóa.",
              "Bạn có thể sao chép mã độc bản này để gửi nhà tuyển dụng hoặc dán vào CV."
            ],
            tips: "💡 Mã chứng chỉ có cấu trúc MCNA-XXXX-XXXX và có thể được xác thực chính gốc trên Cổng Giáo vụ."
          }
        ];
      } else {
        // STUDENT SIS
        return [
          {
            title: "Tra cứu Thời khóa biểu & Điểm danh lớp học số",
            description: "Xem thời gian biểu các lớp học phần tuần hiện tại và nắm lịch đứng lớp.",
            icon: <Calendar className="h-5 w-5 text-cyan-400" />,
            steps: [
              "Vào tab 'Thời khóa biểu' trên Sidebar Menu SIS dọc trái.",
              "Lịch học hiển thị dưới dạng Lưới tuần (Thứ Hai -> Chủ Nhật) chia ca rõ ràng kèm số phòng học và Tên Giảng viên đứng lớp.",
              "Bạn có thể chuyển sang 'Dạng danh sách (List)' để xem lịch trình các ca học tuần tự cực kỳ dễ đọc trên điện thoại.",
              "Tại lớp học trực tiếp, sử dụng camera điện thoại quét mã QR Code Điểm Danh do Giảng viên hiển thị trên bảng máy chiếu đầu giờ để xác thực đi học tự động."
            ],
            tips: "💡 Phiên quét mã QR điểm danh chỉ hoạt động và mở cửa xác nhận trong vòng 15 ca học đầu tiên của buổi học."
          },
          {
            title: "Cập nhật Hồ sơ lý lịch & Cổng Phụ Huynh",
            description: "Quản lý thông tin liên hệ thường trú và thiết lập cổng liên lạc cho bố mẹ.",
            icon: <Users className="h-5 w-5 text-cyan-400" />,
            steps: [
              "Vào tab 'Lý lịch cá nhân' dưới phân hệ SIS Học Vụ.",
              "Nhấp chọn 'Cập nhật hồ sơ' ở góc trên bên phải.",
              "Nhập số điện thoại cá nhân, ngày sinh, giới tính, địa chỉ thường trú và thông tin người bảo lãnh.",
              "Ấn 'Lưu trữ hồ sơ' để cập nhật an toàn vào cơ sở dữ liệu học thuật."
            ],
            tips: "💡 Thông tin Phụ huynh rất quan trọng để hệ thống tự động đồng bộ kết quả học tập sang Cổng Phụ Huynh."
          },
          {
            title: "Kiểm tra chuyên cần & Đóng học phí trực tuyến",
            description: "Theo dõi tỷ lệ đi học thực tế và thực hiện kết toán biên lai học phí đúng thời hạn.",
            icon: <CreditCard className="h-5 w-5 text-cyan-400" />,
            steps: [
              "Vào tab 'Điểm chuyên cần' để xem tỷ lệ chuyên cần từng môn (Phải đạt tối thiểu 80% để được thi cuối kỳ).",
              "Nếu tỷ lệ dưới 80%, hệ thống sẽ tự động gửi Cảnh báo học tập màu đỏ ở trên cùng bảng điều khiển.",
              "Vào tab 'Đóng học phí' để xem danh sách các đợt học phí chưa thanh toán.",
              "Nhấp nút 'Nhận hướng dẫn chuyển khoản' để thực hiện đóng tiền trực tuyến hoặc chuyển khoản ngân hàng."
            ],
            tips: "💡 Sau khi chuyển khoản, bộ phận Kế toán sẽ phê duyệt và gửi biên lai có mã số xác thực về hòm thư của bạn."
          },
          {
            title: "Xem Bảng điểm & Học bạ điện tử (E-Transcript)",
            description: "Kiểm tra điểm thành phần (30%), điểm thi (70%) và GPA chuẩn hóa hệ 4.0 tích lũy.",
            icon: <FileSpreadsheet className="h-5 w-5 text-cyan-400" />,
            steps: [
              "Vào tab 'Kết quả học tập' dưới Menu SIS.",
              "Theo dõi bảng tổng hợp điểm môn học: Xem điểm số chi tiết, điểm hệ 4.0 và xếp loại học bạ (A, B, C, D, F).",
              "Sử dụng nút 'In Học Bạ Dấu Đỏ' ở góc trên bên phải để xuất bản in học bạ điện tử có dấu chứng nhận số của MCNA.",
              "Theo dõi tổng số tín chỉ tích lũy đợt đào tạo và điểm GPA trung bình chung ở dòng tổng kết dưới cùng."
            ],
            tips: "💡 Công thức GPA chuẩn hệ 4.0: A=4.0, B=3.0, C=2.0, D=1.0, F=0. Điểm môn học dưới 60 (loại F) là môn chưa đạt tín chỉ."
          }
        ];
      }
    }

    // 2. TEACHER GUIDES
    if (role === "teacher") {
      if (activeSystem === "LMS") {
        return [
          {
            title: "Biên soạn Giáo án & Xây dựng Bài học học phần",
            description: "Hướng dẫn tạo khung chương trình đào tạo, đăng tải bài giảng, video và đề cương.",
            icon: <BookOpen className="h-5 w-5 text-cyan-300" />,
            steps: [
              "Vào tab 'Chương trình Đào tạo' của Giảng viên.",
              "Nếu tạo khóa mới, nhấp nút 'Khởi tạo Khóa học Mới' ở góc phải. Điền tiêu đề, giá tiền, cấp độ và thẻ khóa học.",
              "Khi khóa học ở trạng thái Draft (Nháp), nhấp chọn khóa học để mở khung soạn thảo chi tiết.",
              "Ấn nút 'Thêm bài giảng mới', điền tiêu đề bài giảng, thời lượng, liên kết video bài giảng và nội dung hướng dẫn.",
              "Sau khi biên soạn xong toàn bộ giáo trình, nhấp chọn khóa học và ấn 'Nộp kiểm duyệt' để Giáo vụ phê duyệt mở lớp."
            ],
            tips: "💡 Giáo án cần có tối thiểu 1 bài giảng trước khi nộp lên Hội đồng Giáo vụ phê duyệt xuất bản."
          },
          {
            title: "Thiết kế Đề thi & Ngân hàng câu hỏi trắc nghiệm",
            description: "Thiết lập các bài kiểm tra đánh giá tự động chấm điểm cho học viên kết môn.",
            icon: <HelpCircle className="h-5 w-5 text-cyan-300" />,
            steps: [
              "Vào tab 'Đề thi & Đánh giá' trên bàn làm việc giảng viên.",
              "Nhấp nút 'Tạo đề thi mới', điền tiêu đề, giới hạn thời gian (phút), điểm đỗ tối thiểu (%) VÀ số lượt thử tối đa.",
              "Nhấp vào Đề thi vừa tạo để mở bảng quản lý ngân hàng câu hỏi.",
              "Nhấp 'Thêm câu hỏi', nhập nội dung câu hỏi, loại (một đáp án/nhiều đáp án/tự luận) và các phương án lựa chọn.",
              "Chỉ định đáp án đúng và ấn 'Lưu câu hỏi'."
            ],
            tips: "💡 Bạn có thể cấu hình câu hỏi trắc nghiệm nhiều lựa chọn bằng cách ngăn cách các đáp án đúng bằng dấu phẩy (VD: 0,2)."
          },
          {
            title: "Quản lý Sổ điểm & Chấm điểm Tự luận",
            description: "Đánh giá các bài nộp viết mã nguồn, cho điểm số kèm nhận xét chi tiết.",
            icon: <Award className="h-5 w-5 text-cyan-300" />,
            steps: [
              "Vào tab 'Bài tập & Chấm điểm' để xem danh sách các bài tự luận của học viên vừa nộp.",
              "Nhấp chọn bài nộp, đọc chi tiết mã nguồn / nội dung giải bài của học viên.",
              "Nhập điểm số đạt được (Thang điểm 100) và viết lời phê bình, nhận xét định hướng cải thiện.",
              "Ấn nút 'Lưu trữ điểm bài tập' để lưu an toàn và thông báo điểm ngay cho học sinh."
            ],
            tips: "💡 Bạn có thể chuyển sang tab 'Sổ điểm Tổng hợp' để xem bảng điểm Excel trực tuyến của toàn bộ lớp học và ấn 'Xuất tệp CSV Sổ điểm' để tải về báo cáo."
          },
          {
            title: "Đọc Báo cáo hiệu suất & Phân tích chất lượng Lớp học",
            description: "Phân tích biểu đồ cột phân bố điểm số và rà soát tỷ lệ học viên có nguy cơ.",
            icon: <TrendingUp className="h-5 w-5 text-cyan-300" />,
            steps: [
              "Vào tab 'Báo cáo Hiệu suất' trên bàn làm việc Giảng viên.",
              "Theo dõi biểu đồ cột thống kê chi tiết tỷ lệ phổ điểm của sinh viên trong lớp môn học.",
              "Kiểm tra danh sách học sinh có nguy cơ trượt môn (At-risk) dựa trên điểm thi và bài tập trung bình thấp.",
              "Nhấp gửi thông báo cảnh cáo khẩn cấp hoặc đề xuất học tập phục hồi lộ trình đến Cố vấn học tập."
            ],
            tips: "💡 Tỷ lệ phổ điểm dạng hình chuông chuẩn là chỉ báo cho thấy đề thi kiểm tra được biên soạn phân loại học lực xuất sắc."
          }
        ];
      } else {
        // TEACHER SIS
        return [
          {
            title: "Khởi tạo, Điều chỉnh & Lập Lớp học phần mới",
            description: "Tự tạo lớp học phần (lớp ca học) cho các khóa học do bạn sở hữu và thiết lập lịch biểu tuần.",
            icon: <PlusCircle className="h-5 w-5 text-indigo-300" />,
            steps: [
              "Vào phân hệ 'SIS Học Vụ' -> Tab 'Thời khóa biểu giảng dạy'.",
              "Nhấp nút 'Tạo lớp học' ở góc trên bên phải để mở biểu mẫu thiết lập.",
              "Chọn 'Môn học đào tạo' trong danh sách các môn bạn đang làm giảng viên chính.",
              "Điền 'Mã lớp học phần' (ví dụ: CS101-02), sức chứa tối đa và chọn học kỳ.",
              "Cấu hình các ca học tuần chi tiết bằng cách thêm ngày học, giờ học và phòng học.",
              "Nhấp 'Lưu thiết lập' để hệ thống tự động kiểm tra trùng lịch (giảng viên & phòng học) trước khi chính thức tạo lớp."
            ],
            tips: "💡 Hệ thống tích hợp thuật toán Conflict Detection thông minh, giúp bạn phát hiện ngay lập tức nếu ca học trùng lịch dạy khác của chính bạn hoặc phòng học đã bị đặt chỗ."
          },
          {
            title: "Tra cứu Thời khóa biểu & Lịch đứng lớp giảng dạy",
            description: "Theo dõi thời gian biểu tuần, phòng học phân bổ và chuẩn bị bài giảng trước khi lên lớp.",
            icon: <Calendar className="h-5 w-5 text-indigo-300" />,
            steps: [
              "Chuyển sang phân hệ 'SIS Học Vụ' từ thanh Header góc trên bên phải.",
              "Hệ thống sẽ tự động đưa bạn vào trang Thời khóa biểu giảng dạy cá nhân.",
              "Theo dõi lịch dạy tuần ở dạng Lưới (Grid) để nắm rõ ca học đứng lớp (Ca 1 -> Ca 5), ngày dạy và số phòng học cụ thể.",
              "Bạn cũng có thể chuyển sang 'Dạng danh sách (List)' để xem lịch dạy tuần xếp theo thứ tự dòng thời gian trực quan."
            ],
            tips: "💡 Bên cạnh việc tự lập lớp học phần cho các khóa học của mình, bạn cũng có thể được Giáo vụ phân công giảng dạy các môn học khác."
          },
          {
            title: "Xuất mã QR & Điểm danh chuyên cần lớp học phần",
            description: "Tạo phiên điểm danh số hóa, hiển thị mã QR Code hoặc tích chuyên cần thủ công.",
            icon: <QrCode className="h-5 w-5 text-indigo-300" />,
            steps: [
              "Tại giao diện Thời khóa biểu giảng dạy SIS, nhấp chọn lớp học phần đang diễn ra.",
              "Nhấp nút 'Tạo phiên điểm danh chuyên cần' cho ca học hiện tại.",
              "Nhấp nút 'Bật mã QR Điểm danh'. Trình chiếu mã QR Code này lên bảng máy chiếu lớn của lớp để học sinh tự quét xác nhận đi học bằng thiết bị di động.",
              "Đối với sinh viên quên mang máy, Giảng viên có thể tích chọn thủ công: Đi học (Present), Đi muộn (Late), Nghỉ học (Absent) ngay trên danh sách lớp học phần hiển thị bên dưới.",
              "Ấn 'Lưu biên bản chuyên cần' để hệ thống tự động chốt tỷ lệ và đồng bộ báo cáo về phòng Giáo vụ."
            ],
            tips: "💡 Sinh viên tự động bị khóa quét QR sau 15 phút đầu ca học. Đi muộn 3 lần sẽ được thuật toán tự động tính tương đương với 1 buổi nghỉ học không phép."
          }
        ];
      }
    }

    // 3. ADMIN HOC TAP GUIDES (role admin)
    if (role === "admin") {
      return [
        {
          title: "Xếp ca & Thiết lập Thời khóa biểu tuần (detect trùng lịch)",
          description: "Phân chia ca học lớp học phần, gán giảng viên đứng lớp, gán phòng học và kiểm tra xung đột.",
          icon: <Calendar className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Quản lý Thời khóa biểu' dưới phân hệ SIS.",
            "Nhấp nút 'Tạo lớp học' ở góc trên bên phải để mở modal xếp lịch lớp học phần mới.",
            "Chọn môn học, chọn học kỳ, gán Giảng viên phụ trách, nhập mã lớp (VD: CS101-02) và sức chứa tối đa.",
            "Nhấp nút 'Thêm ca học tuần' để lập lịch biểu: chọn ngày trong tuần (Thứ Hai -> Chủ Nhật), giờ bắt đầu, giờ kết thúc, và nhập số phòng học cụ thể.",
            "Ấn 'Lưu thiết lập'. Hệ thống sẽ tự động chạy thuật toán phát hiện xung đột lịch: Kiểm tra xem Giảng viên đó có bị trùng lịch dạy khác, hoặc Phòng học đó có bị trùng lớp học khác vào cùng khung giờ hay không. Nếu trùng sẽ hiển thị cảnh báo đỏ ngăn lưu chéo."
          ],
          tips: "💡 Thuật toán so khớp lịch hoạt động theo cơ chế thời gian thực, quét toàn bộ lớp học phần trong kỳ để đảm bảo phòng học và giảng viên không bao giờ bị xếp lịch chồng chéo."
        },
        {
          title: "Thống kê & Sắp xếp lớp học học viên (Class Placement)",
          description: "Quét dữ liệu học viên chưa được gán lịch học, xếp lớp học phần hành chính nhanh gọn.",
          icon: <Users className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Xếp lớp Học viên' trên Sidebar SIS.",
            "Hệ thống sẽ tự động quét cơ sở dữ liệu để đếm và thống kê chính xác: đang có bao nhiêu học viên đóng học phí/ghi danh nhưng chưa được phân lớp học phần hành chính.",
            "Tại tab 'Chờ xếp lớp', theo dõi danh sách học viên, nhấp nút 'Xếp lớp học phần' bên cạnh học viên.",
            "Modal xếp lớp hiển thị thông tin học viên. Giáo vụ chọn 1 Lớp học phần đang mở của môn đó trong học kỳ hiện tại (Dropdown hiển thị rõ số lượng học viên thực tế đang có trong lớp để tránh quá tải sĩ số).",
            "Ấn 'Xác nhận Xếp lớp' để hoàn tất phân lịch đi học chính thức cho sinh viên."
          ],
          tips: "💡 Giáo vụ cũng có thể quản lý hàng đợi 'Danh sách chờ (Waitlist)' tại tab bên cạnh, nhấp duyệt chuyển học viên từ danh sách chờ vào đăng ký lớp chính thức with 1 click."
        },
        {
          title: "Duyệt cấp & Xác thực mã Chứng chỉ độc bản",
          description: "Phê duyệt điều kiện cấp chứng chỉ số hóa cho học sinh đã hoàn tất khóa học.",
          icon: <Award className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Duyệt & Xác thực Bằng' trên Menu SIS Giáo vụ.",
            "Tại tab 'Chờ cấp chứng nhận', hệ thống sẽ tự động quét toàn bộ cơ sở dữ liệu học tập để tìm ra những học sinh đã **hoàn thành 100% bài giảng** VÀ **thi đậu trắc nghiệm kết môn** nhưng chưa được cấp chứng chỉ.",
            "Giáo vụ kiểm tra thông tin và nhấp nút 'Duyệt & Cấp bằng'. Hệ thống sẽ tự động cấp phát mã kiểm định văn bằng độc bản có định dạng MCNA-XXXX-XXXX VÀ gửi thư báo thành công về tài khoản học viên.",
            "Bạn có thể xác thực tính pháp lý của bất kỳ văn bằng nào bằng cách sang tab 'Xác thực Mã (Verify Code)', nhập mã chứng chỉ và nhấp 'Kiểm tra' để xem tấm bằng tốt nghiệp glassmorphic số hóa của sinh viên đó."
          ],
          tips: "💡 Tab 'Sổ Chứng Chỉ' lưu ký toàn bộ văn bằng đang lưu hành, cho phép Giáo vụ tìm kiếm nhanh và thực hiện Thu hồi (Revoke) chứng chỉ trong trường hợp phát hiện học viên có gian lận học thuật."
        }
      ];
    }

    // 4. SYSTEM MANAGER GUIDES (QTV - role manager)
    if (role === "manager" || role === "super_admin") {
      return [
        {
          title: "Cấu hình nền tảng, thiết lập hệ thống tích hợp",
          description: "Quản trị các tham số hệ thống tổng thể, tích hợp email server, sms brandname và phòng học trực tuyến.",
          icon: <SlidersHorizontal className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Đăng nhập tài khoản Manager QTV (admin@mcna.local), chuyển sang phân hệ 'LMS Học Tập' hoặc 'SIS Học Vụ'.",
            "Vào tab 'Cấu hình hệ thống (Settings)' trên thanh menu hành chính.",
            "Thiết lập tên miền học viện, tải lên logo đại diện MCNA LMS và định vị mã màu sắc thương hiệu đồng bộ.",
            "Thiết lập email SMTP server phục vụ gửi mã 2FA, thông báo học phí, và gửi thư báo cấp chứng chỉ cho học viên tự động.",
            "Cấu hình các API bên thứ 3: Tích hợp phòng học ảo trực tuyến Zoom/MS Teams, cổng thanh toán ngân hàng tự động và tổng đài gửi mã OTP SMS."
          ],
          tips: "💡 Cấu hình chính xác email server SMTP là cốt lõi để đảm bảo hệ thống gửi thông tin mã kích hoạt tài khoản an toàn cho học viên mới."
        },
        {
          title: "Quản lý Phân quyền & Nhập dữ liệu an toàn hàng loạt (Bulk Import)",
          description: "Quản trị danh sách nhân sự học viện và đăng ký nhập liệu số học sinh đầu vào hàng loạt.",
          icon: <Database className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Phân quyền người dùng' (LMS) hoặc 'Sổ học sinh sinh viên' (SIS).",
            "Để thêm học viên mới hàng loạt, Giáo vụ/Manager truy cập mục 'Nhập dữ liệu CSV'. Tải lên tệp danh sách Excel/CSV nhân sự học viện có cấu trúc định sẵn.",
            "Ấn nút 'Xác nhận Nhập dữ liệu CSV'. Hệ thống sẽ tự động khởi tạo hàng loạt tài khoản người dùng, mã hóa mật khẩu bảo mật và gửi thông báo kích hoạt tài khoản.",
            "Để phân quyền nhân sự hành chính, nhấp chọn người dùng, chỉnh sửa role (Manager, admin, finance, sale, teacher, advisor, student) để gán đúng quyền hạn trong SIS/LMS."
          ],
          tips: "💡 Sổ nhật ký hệ thống (Audit Logs) ghi nhận chính xác 100% từng hành động của tất cả nhân sự (ai điều chỉnh điểm, ai phê duyệt khóa học, ai import CSV) phục vụ mục đích bảo mật kỹ thuật tối đa."
        },
        {
          title: "Phê duyệt Đề cương & Duyệt mở Môn học giảng dạy",
          description: "Giám sát giáo án giảng dạy của giảng viên, phê duyệt xuất bản môn học lên cổng đào tạo công khai.",
          icon: <BookOpen className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Duyệt khóa học (Approval)' dưới phân hệ LMS.",
            "Hệ thống sẽ hiển thị danh sách các đề cương môn học đang ở trạng thái chờ duyệt (Pending review) do các Giảng viên chuyên môn soạn thảo và nộp lên.",
            "Nhấp chọn môn học để kiểm tra: Xem số lượng bài giảng, nội dung bài học, đề thi trắc nghiệm kết môn đã đầy đủ yêu cầu chưa.",
            "Nếu giáo án hợp chuẩn học thuật, nhấp nút 'Phê duyệt & Xuất bản' để môn học chính thức hiển thị lên Cổng đào tạo và cho phép học sinh đăng ký tuyển sinh.",
            "Nếu giáo án cần chỉnh sửa thêm, nhấp 'Từ chối' VÀ viết lời nhận xét yêu cầu bổ sung chỉnh lý gửi lại cho Giảng viên."
          ],
          tips: "💡 Chỉ những môn học ở trạng thái 'Đã xuất bản (Published)' mới xuất hiện trong catalog học trình của Học viên để ghi danh tuyển sinh."
        }
      ];
    }

    // 5. PARENT GUIDES
    if (role === "parent") {
      return [
        {
          title: "Kiểm tra tiến độ & kết quả học tập GPA",
          description: "Theo dõi học lực trực tuyến, xem nhận xét cố vấn và GPA học kỳ chuẩn hóa.",
          icon: <Activity className="h-5 w-5 text-emerald-400" />,
          steps: [
            "Đăng nhập tài khoản Phụ huynh, hệ thống đưa bạn thẳng vào trang tổng quan giám sát.",
            "Tại tab 'Tổng Quan Con Em', xem các thông tin lý lịch sinh viên định danh.",
            "Kéo xuống phần 'Nhận xét của Cố vấn học tập' để cập nhật ý kiến của nhà trường về tình hình học tập và đạo đức.",
            "Sang tab 'Bảng Điểm Học Tập' để theo dõi chi tiết điểm trung bình các môn, điểm thi trắc nghiệm thực hành."
          ],
          tips: "💡 Bảng điểm tổng kết hiển thị theo thời gian thực giúp phụ huynh nhanh chóng nắm bắt các môn thế mạnh và hạn chế của con em."
        },
        {
          title: "Theo dõi Chuyên cần & Cảnh báo học tập",
          description: "Giám sát tỷ lệ đi học thực tế trên lớp và các cờ đỏ kỷ luật.",
          icon: <AlertCircle className="h-5 w-5 text-emerald-400" /> as any, // fallback icon
          steps: [
            "Vào tab 'Biểu Đồ Chuyên Cần' dưới phân hệ SIS.",
            "Xem tổng tỷ lệ phần trạng chuyên cần (Yêu cầu chung của học viện E16 là đạt tối thiểu 80% thời lượng đứng lớp).",
            "Nếu con em bị nghỉ học quá số ca quy định, sang tab 'Cảnh Báo & Kỷ Luật' để kiểm tra chi tiết lỗi vi phạm và các cờ cảnh báo đỏ từ Cố vấn học tập."
          ],
          tips: "💡 Khi có cảnh báo mới phát sinh, hệ thống sẽ tự động đẩy thông báo hòm thư khẩn cấp đến hòm thư Phụ huynh."
        },
        {
          title: "Đóng học phí trực tuyến con em qua chuyển khoản",
          description: "Rà soát hóa đơn học kỳ và thực hiện thanh toán chuyển khoản ngân hàng bảo mật.",
          icon: <CreditCard className="h-5 w-5 text-emerald-400" />,
          steps: [
            "Vào tab 'Sổ Học Phí & Biên Lai' dưới Menu SIS.",
            "Theo dõi danh sách các kỳ học phí đang nợ, kỳ hạn chót đóng tiền và số tiền cụ thể.",
            "Sử dụng thông tin chuyển khoản ngân hàng hoặc mã quét thanh toán hiển thị để chuyển khoản đóng tiền.",
            "Sau khi chuyển tiền, bộ phận Kế toán sẽ rà soát sao kê và phát hành biên lai thu tiền điện tử gửi trực tiếp vào tab này."
          ],
          tips: "💡 Trạng thái hóa đơn sẽ chuyển từ 'Chờ đóng tiền' sang màu xanh lá 'Đã thanh toán' ngay khi kế toán xác nhận khớp giao dịch."
        }
      ];
    }

    // 6. FINANCE GUIDES
    if (role === "finance") {
      return [
        {
          title: "Đối soát thanh toán & Duyệt quyền tham gia khóa học",
          description: "Rà soát yêu cầu chuyển khoản ngân hàng từ học viên và phê duyệt kích hoạt quyền học.",
          icon: <DollarSign className="h-5 w-5 text-emerald-400" /> as any,
          steps: [
            "Vào tab 'Đối soát & Giao dịch' trên Bàn làm việc Kế toán.",
            "Rà soát các giao dịch ở trạng thái 'Chờ đối soát' màu vàng do học sinh gửi yêu cầu thanh toán lên.",
            "Đối chiếu số tiền chuyển khoản và nội dung giao dịch thực tế trên tài khoản sao kê ngân hàng.",
            "If khớp thông tin, ấn nút 'Phê duyệt'. Hệ thống sẽ tự động kích hoạt quyền tham gia khóa học cho sinh viên và gửi thư báo thành công.",
            "If thông tin bị sai lệch, nhấp 'Từ chối', ghi rõ nguyên do (Ví dụ: Chuyển thiếu tiền, sai thông tin khóa học) để thông báo gửi về tài khoản học viên."
          ],
          tips: "💡 Sổ thu chi lưu trữ vĩnh viễn dấu vân tay số của kế toán xử lý giao dịch phục vụ mục đích kiểm toán."
        },
        {
          title: "Quản lý Công nợ học phí & Phát hành hóa đơn",
          description: "Lập học phí đồng loạt cho lớp học phần học kỳ và rà soát nợ xấu.",
          icon: <FileText className="h-5 w-5 text-emerald-400" />,
          steps: [
            "Vào tab 'Quản lý Học phí & Công nợ' dưới phân hệ SIS.",
            "Nhấp nút 'Tạo đợt học phí mới', chọn học kỳ, gán số tiền (VND) và đặt thời hạn đóng học phí quy định.",
            "Tại Sổ theo dõi học phí, kế toán có thể quét nhanh toàn bộ sinh viên quá hạn đóng tiền.",
            "Sử dụng tính năng 'Gửi SMS/Email nhắc nợ' để hệ thống gửi thư cảnh báo nợ tự động đến học sinh và phụ huynh liên quan."
          ],
          tips: "💡 Thuận tiện xuất tệp CSV danh sách nợ học phí quá hạn bất cứ khi nào để chuyển giao cho bộ phận xử lý nợ."
        },
        {
          title: "Tính toán & Phê duyệt bảng lương Giảng viên",
          description: "Tổng hợp tiền lương đứng lớp cơ bản và chiết khấu hoa hồng tuyển sinh giảng dạy.",
          icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
          steps: [
            "Vào tab 'Bảng lương Giảng viên' dưới thanh Menu.",
            "Hệ thống sẽ chạy thuật toán tự động tổng hợp: Số môn giảng viên phụ trách (3.000.000đ/môn) cộng với hoa hồng đứng lớp tuyển sinh (15% doanh thu thực thu từ học viên active).",
            "Kiểm tra chi tiết bảng kê breakdown của từng giáo viên để đối chiếu độ chính xác.",
            "Sau khi kiểm toán xong, ấn nút 'Thanh toán' để ghi nhận chi lương và hệ thống gửi thông báo kết toán lương về tài khoản giảng viên."
          ],
          tips: "💡 Tiền lương hoa hồng chỉ tính dựa trên các học viên đã đóng tiền thực tế và đang có trạng thái kích hoạt hoạt động."
        }
      ];
    }

    // 7. SALE / RECEPTION GUIDES
    if (role === "sale") {
      return [
        {
          title: "Tạo tài khoản học viên offline nhập học",
          description: "Ghi danh học viên trực tiếp tại quầy và thiết lập tài khoản ban đầu.",
          icon: <Users className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Đăng ký tài khoản học viên' dưới bàn làm việc Tiếp tân.",
            "Nhập chính xác Họ tên học viên, Email cá nhân (rất quan trọng để gửi kích hoạt) và Số điện thoại.",
            "Thiết lập mật khẩu mặc định (Hệ thống gợi ý sẵn 'studente16' theo quy chuẩn tuyển sinh).",
            "Ấn nút 'Tạo tài khoản học viên'. Hệ thống sẽ tự động lưu thông tin vào DB, cấp quyền 'student' và gửi thông báo kích hoạt hòm thư."
          ],
          tips: "💡 Học viên sau khi có tài khoản có thể tự đăng nhập cổng LMS để bổ sung hồ sơ học bạ."
        },
        {
          title: "Tra cứu thông tin học viên & Hỗ trợ kỹ thuật khẩn cấp",
          description: "Tìm kiếm thông tin nhanh, hỗ trợ reset mật khẩu cho học viên gặp sự cố đăng nhập.",
          icon: <Search className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Tra cứu học viên' trên Menu chính.",
            "Nhập tên học viên hoặc email/sđt vào ô tìm kiếm nhanh.",
            "Bảng kết quả hiển thị thông tin: trạng thái hoạt động, số khóa học đăng ký của học sinh.",
            "If học viên bị quên mật khẩu hoặc lỗi đăng nhập, nhấp nút 'Reset Mật khẩu'. Hệ thống sẽ tự động đặt lại mật khẩu về mặc định (studente16) để giúp học sinh đăng nhập khẩn cấp ngay tại quầy."
          ],
          tips: "💡 Khuyên học viên đổi lại mật khẩu cá nhân ngay sau khi đăng nhập thành công bằng mật khẩu mặc định."
        },
        {
          title: "Tư vấn lộ trình khóa học & Cấp học bổng đào tạo",
          description: "Rà soát đề cương giáo án môn học để tư vấn chi tiết khung chương trình cho khách hàng tuyển sinh.",
          icon: <BookOpen className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Vào tab 'Chương trình khóa học tư vấn'.",
            "Sử dụng thanh tìm kiếm nhanh để lọc các khóa học đang được xuất bản hoạt động.",
            "Xem các thông tin về: giá học phí môn học, giảng viên phụ trách đứng lớp và sĩ số thực tế.",
            "Nhấp 'Xem chi tiết' để mở modal tư vấn: tại đây tiếp tân có thể đọc giáo án chi tiết từng bài giảng, thời lượng học và số lượng đề thi trắc nghiệm để trả lời các câu hỏi thắc mắc của phụ huynh/học viên."
          ],
          tips: "💡 Tiếp tân có thể in đề cương này ra bản cứng để gửi tặng khách hàng tại quầy tư vấn tuyển sinh E16."
        }
      ];
    }

    // 8. ADVISOR GUIDES
    if (role === "advisor") {
      return [
        {
          title: "Ghi nhận xét cố vấn học thuật & Đạo đức học tập",
          description: "Theo dõi hồ sơ sinh viên phụ trách và viết nhật ký tư vấn định hướng.",
          icon: <Users className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Đăng nhập tài khoản Cố Vấn, hệ thống tự động tải danh sách sinh viên được gán phụ trách ở Sidebar trái.",
            "Tìm kiếm và nhấp chọn sinh viên mong muốn. Hệ thống hiển thị chi tiết hồ sơ lý lịch, kết quả điểm GPA tích lũy.",
            "Chuyển sang tab 'Nhật Ký Tư Vấn & Đề Xuất'.",
            "Tại form ghi chép, chọn loại nhận xét (Học tập/Hành vi kỷ luật/Tài chính học bổng).",
            "Tích chọn 'Chia sẻ dữ liệu với Phụ huynh' nếu muốn thông tin nhận xét đồng bộ sang Cổng phụ huynh trực tuyến.",
            "Nhập nội dung tư vấn chi tiết và ấn 'Lưu và gửi thông báo'."
          ],
          tips: "💡 Ghi nhận xét đều đặn hàng tuần giúp nhà trường và gia đình có sự phối hợp kèm cặp tốt nhất."
        },
        {
          title: "Lập lộ trình đề cử khóa học học kỳ mới",
          description: "Đề xuất các lớp học phần học kỳ mới hiển thị trực tiếp lên cổng đăng ký của sinh viên.",
          icon: <Calendar className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Chọn sinh viên cần thiết lập lộ trình.",
            "Vào tab 'Nhật Ký Tư Vấn & Đề Xuất Lộ Trình'. Kéo xuống mục 'Đề xuất đăng ký môn học kì tới'.",
            "Đọc kỹ bản đồ tín chỉ chương trình đào tạo của sinh viên để biết môn học nào chưa đạt hoặc cần cải thiện GPA.",
            "Nhập hướng dẫn đăng ký (Ví dụ: Khuyên đăng ký lớp Core HTTP, đăng ký môn CS101-01 ca sáng để tối ưu thời gian).",
            "Ấn 'Xác nhận Kế hoạch đăng ký'. Hệ thống sẽ tự động thông báo và hiển thị trực quan thông tin này trên tài khoản học sinh khi kỳ đăng ký môn mở ra."
          ],
          tips: "💡 Sinh viên sẽ tự tin ghi danh đúng ca học mà cố vấn đã phê duyệt lộ trình."
        },
        {
          title: "Giải quyết & Xóa cờ Cảnh báo học tập đỏ",
          description: "Rà soát sinh viên có nguy cơ bỏ học (at-risk) và gỡ bỏ cờ đỏ cảnh báo.",
          icon: <ShieldAlert className="h-5 w-5 text-indigo-400" />,
          steps: [
            "Chọn sinh viên có ký hiệu chấm đỏ cảnh báo trên danh sách.",
            "Tại tab 'Tiến Trình & Cảnh Báo', xem chi tiết lỗi cảnh báo (nghỉ học quá ca/GPA thấp dưới 2.0).",
            "Thực hiện gặp mặt tư vấn, định hướng lộ trình khắc phục cho sinh viên.",
            "Sau khi hoàn tất tư vấn khắc phục, nhấp nút 'Đánh dấu đã giải quyết'. Hệ thống sẽ xóa cờ đỏ cảnh báo kỷ luật, đưa sinh viên về trạng thái an toàn."
          ],
          tips: "💡 Đóng cảnh báo kỷ luật kịp thời giúp sinh viên đủ điều kiện thi cuối kỳ theo quy chế học viện."
        }
      ];
    }

    return [];
  };

  const guideData = getGuideData();

  const filteredGuides = guideData.filter(item => 
    item.title.toLowerCase().includes(guideSearch.toLowerCase()) ||
    item.description.toLowerCase().includes(guideSearch.toLowerCase()) ||
    item.steps.some(step => step.toLowerCase().includes(guideSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <LifeBuoy className="h-5.5 w-5.5 text-indigo-400 animate-spin-slow shrink-0" />
              Sách Hướng dẫn Sử dụng Hệ thống
            </h3>
            <p className="text-xs text-white/50">
              Xem tài liệu hướng dẫn nhanh, quy trình các bước vận hành hệ thống tối ưu cho vai trò của bạn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search bar inside guide */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu hướng dẫn..."
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
          </div>

          {/* Close / Back button */}
          {onClose && (
            <button
              onClick={onClose}
              title="Đóng hướng dẫn"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white transition duration-150 cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Đóng</span>
            </button>
          )}
        </div>
      </div>

      {/* Role banner status card */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 p-4.5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/15 rounded-2xl flex items-center justify-center font-bold text-lg text-indigo-300">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
             <h5 className="font-bold text-white text-xs">
              Định vị Vai trò:{" "}
              <span className="text-indigo-300 uppercase font-mono font-black">
                {role === "student" && "Học Viên"}
                {role === "teacher" && "Giảng Viên"}
                {role === "admin" && "Admin học tập"}
                {role === "manager" && "Quản trị viên Hệ thống"}
                {role === "parent" && "Phụ Huynh Học Viên"}
                {role === "finance" && "Phòng Tài Chính"}
                {role === "sale" && "Tuyển sinh Lễ tân"}
                {role === "advisor" && "Cố Vấn Học Tập"}
              </span>
            </h5>
            <p className="text-[11px] text-white/50 mt-0.5">
              Bạn đang duyệt thư mục hướng dẫn nghiệp vụ thuộc phân hệ:{" "}
              <strong className="text-indigo-200 uppercase font-mono">
                {activeSystem === "SIS" ? "SIS Hành chính học vụ" : "LMS Học tập trực tuyến"}
              </strong>
            </p>
          </div>
        </div>
        
        <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase rounded-lg">
          Tài liệu chính thức
        </span>
      </div>

      {/* ACCORDION GUIDE SECTIONS */}
      <div className="space-y-3.5">
        {filteredGuides.map((item, idx) => {
          const isOpen = openSectionIndex === idx;

          return (
            <div 
              key={idx} 
              className={`bg-white/3 border rounded-3xl transition-all duration-200 overflow-hidden ${
                isOpen ? "border-indigo-500/20 shadow-lg shadow-indigo-500/5 bg-white/5" : "border-white/5"
              }`}
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleSection(idx)}
                className="w-full text-left p-4.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/2 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-black/30 border border-white/5 rounded-2xl shrink-0 group-hover:scale-105 transition">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs md:text-sm leading-tight">{item.title}</h4>
                    <p className="text-[11px] text-white/50 mt-0.5 truncate">{item.description}</p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4.5 w-4.5 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="h-4.5 w-4.5 text-white/40 shrink-0" />
                )}
              </button>

              {/* Accordion Content */}
              {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t border-white/5 space-y-4 text-xs leading-relaxed animate-in slide-in-from-top-3 duration-200">
                  
                  {/* Step list */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono block">
                      Các bước thực hiện vận hành:
                    </span>
                    <ol className="space-y-2 pl-4 list-decimal text-white/80 font-sans">
                      {item.steps.map((step, stepIdx) => (
                        <li key={stepIdx} className="pl-1">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tips Box */}
                  <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-300 rounded-2xl text-[11px] leading-relaxed flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                    <span>{item.tips}</span>
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {filteredGuides.length === 0 && (
          <div className="text-center py-16 bg-black/10 border border-dashed border-white/5 rounded-3xl text-xs text-white/40 font-sans">
            Không tìm thấy bài viết hoặc quy trình hướng dẫn nào khớp với từ khóa tìm kiếm.
          </div>
        )}
      </div>
    </div>
  );
}
