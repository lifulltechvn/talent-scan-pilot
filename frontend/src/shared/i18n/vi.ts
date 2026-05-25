import type { TranslationKey } from './en';

export const vi: Record<TranslationKey, string> = {
  // Common
  search: 'Tìm kiếm',
  save: 'Lưu',
  cancel: 'Hủy',
  delete: 'Xóa',
  edit: 'Sửa',
  create: 'Tạo mới',
  back: 'Quay lại',
  viewAll: 'Xem tất cả',
  loading: 'Đang tải...',
  noData: 'Không có dữ liệu',

  // Auth
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  email: 'Email',
  password: 'Mật khẩu',
  loginFailed: 'Đăng nhập thất bại. Vui lòng kiểm tra lại.',

  // Sidebar
  navDashboard: 'Tổng quan',
  navCandidates: 'Ứng viên',
  navJobs: 'Tin tuyển dụng',
  navInterviews: 'Phỏng vấn',
  navTalentPool: 'Talent Pool',
  navOutreach: 'Email',
  navSettings: 'Cài đặt',

  // Dashboard
  dashboardTitle: 'Tổng quan',
  dashboardSubtitle: 'Tổng quan quy trình tuyển dụng',
  todayTasks: '📋 Hôm nay cần làm gì?',
  tasksCount: '{count} việc cần xử lý',
  allCaughtUp: 'Xong hết rồi! 🎉',
  noTasksDescription: 'Không có việc gì cần xử lý ngay.',
  totalCVs: 'Tổng CV',
  goldCandidates: 'Ứng viên Gold',
  activeJobs: 'Job đang mở',
  avgScore: 'Điểm TB',
  classification: 'Phân loại',
  candidateDistribution: 'Phân bố ứng viên',
  scoreDistribution: 'Phân bố điểm',
  candidatesByScoreRange: 'Ứng viên theo khoảng điểm',
  weeklyTrend: 'Xu hướng tuần',
  cvsScannedThisWeek: 'CV quét trong tuần',
  recentCandidates: 'Ứng viên gần đây',
  latestScannedCVs: 'CV mới quét gần đây',

  // Action Items
  unreviewedCVs: '{count} CV chưa review',
  staleWarning: '{count} đã chờ hơn 3 ngày',
  needsReview: 'Cần xem xét và phân loại',
  quizSubmitted: '{count} quiz đã nộp — cần đánh giá',
  quizExpiring: '{count} quiz sắp hết hạn',
  upcomingInterviews: '{count} phỏng vấn sắp tới',
  pendingBookings: '{count} ứng viên chưa chọn lịch phỏng vấn',
  pendingBookingsDesc: 'Đã gửi link nhưng chưa có phản hồi',
  expiringJobs: '{count} job sắp hết deadline',
  urgent: 'Gấp',
  expiring: 'Sắp hết hạn',
  deadline: 'Deadline',

  // Candidates
  candidatesTitle: 'Ứng viên',
  candidatesTotal: '{total} tổng · {gold} gold · {silver} silver',
  searchByNameOrSkill: 'Tìm theo tên hoặc kỹ năng...',
  all: 'Tất cả',
  gold: 'Gold',
  silver: 'Silver',
  pool: 'Pool',
  list: 'Danh sách',
  pipeline: 'Pipeline',
  compare: 'So sánh',
  selectMoreToCompare: 'Chọn thêm {count} để so sánh',
  noCandidatesFound: 'Không tìm thấy ứng viên',
  adjustFilters: 'Thử điều chỉnh tìm kiếm hoặc bộ lọc',
  experience: 'Kinh nghiệm',
  skills: 'Kỹ năng',
  score: 'Điểm',
  status: 'Trạng thái',

  // Candidate Detail
  finalScore: 'Điểm tổng',
  ruleScore: 'Điểm quy tắc',
  llmScore: 'Điểm AI',
  strengths: 'Điểm mạnh',
  weaknesses: 'Điểm yếu',
  recommendation: 'Đề xuất',
  education: 'Học vấn',
  languages: 'Ngôn ngữ',
  expectedSalary: 'Lương mong muốn',

  // Compare
  compareTitle: 'So sánh ứng viên',
  compareCandidatesSelected: '{count} ứng viên được chọn',
  selectAtLeast2: 'Chọn ít nhất 2 ứng viên để so sánh.',
  backToList: '← Quay lại danh sách',

  // Jobs
  jobsTitle: 'Tin tuyển dụng',
  newJob: 'Tạo job mới',
  jobTitle: 'Tiêu đề',
  jobDescription: 'Mô tả',
  requiredSkills: 'Kỹ năng yêu cầu',
  salaryRange: 'Mức lương',
  location: 'Địa điểm',

  // Kanban
  statusNew: 'Mới',
  statusReviewed: 'Đã xem',
  statusApproved: 'Đã duyệt',
  statusRejected: 'Từ chối',
  statusTalentPool: 'Talent Pool',

  // Interviews
  interviewsTitle: 'Phỏng vấn',
  scheduled: 'Đã lên lịch',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',

  // Outreach
  outreachTitle: 'Email',
  emailLogs: 'Lịch sử gửi email',
  outreachType: 'Mời ứng tuyển',
  rejectionType: 'Từ chối',
  reminderType: 'Nhắc nhở',

  // Settings
  settingsTitle: 'Cài đặt',
};
