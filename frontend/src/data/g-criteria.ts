export const G_CRITERIA: Record<string, Record<string, { vi: string; en: string }>> = {
  application_engineer: {
    G0: {
      vi: "Có thể xây dựng trang e-commerce cơ bản (không có thanh toán/bảo mật). SQL cơ bản (SELECT/JOIN). Có thể làm theo tài liệu test. Hiểu OOP cơ bản. Linux cơ bản. Hiểu tại sao bảo mật quan trọng. HTML/CSS/JS cơ bản.",
      en: "Can build basic e-commerce page (no payment/security). Basic SQL (SELECT/JOIN). Can follow test docs. Basic OOP. Basic Linux. Understands why security matters. Basic HTML/CSS/JS.",
    },
    G1: {
      vi: "Có thể code theo specs. Biết chuẩn hoá dữ liệu. Tạo được testcase thông thường. Hiểu mô hình MVC. Có thể giải thích cấu trúc server. Kiến thức mạng cơ bản. Xử lý validation/escape. Hoàn thành công việc với hướng dẫn lịch trình.",
      en: "Can code to specs. Knows data normalization. Creates testcases. Understands MVC. Can explain server structure. Basic networking. Handles validation/escape. Completes tasks with schedule guidance.",
    },
    G2: {
      vi: "Xem xét reusability, retry, xử lý lỗi. Sử dụng được nhiều loại data store. Viết unit test (C0/C1/C2). Áp dụng SOLID/DRY/KISS. Sử dụng middleware trên Linux. Biết troubleshoot mạng. Review code về bảo mật. Tự tạo lịch trình phù hợp team. Phân tích dữ liệu cho project của mình. Đề xuất cải tiến cho 1 trang/tính năng.",
      en: "Considers reusability, retry, error handling. Uses multiple data stores. Writes unit tests (C0/C1/C2). Applies SOLID/DRY/KISS. Uses middleware on Linux. Network troubleshooting. Reviews code for security. Creates own schedule aligned with team. Analyzes data for own projects. Proposes improvements.",
    },
    G3: {
      vi: "Tối ưu memory/API call, output logging để debug. Thiết kế data store (physical+logical). Review specs về bảo mật và yêu cầu phi chức năng. Kiến trúc loose coupling. Phân tích hiệu năng server/middleware. Đề xuất cải tiến hạ tầng. Thiết kế auth an toàn. Quản lý cross-browser, hiểu ES5+. Tạo requirements từ nhu cầu khách hàng. Lập lịch dự án có quản lý rủi ro.",
      en: "Optimizes memory/API calls, logging for debugging. Designs data store (physical+logical). Reviews specs for security & non-functional requirements. Loose coupling architecture. Analyzes server/middleware performance. Proposes infra improvements. Designs secure auth. Manages cross-browser, ES5+. Creates requirements from client needs. Project scheduling with risk management.",
    },
    G4: {
      vi: "Lập trình async/multi-thread. Mã hoá, tuning, backup, fault tolerance. Tạo test plan cho dự án lớn. Domain model + Cloud Native design. Đánh giá và tune hiệu năng server/middleware. Thiết kế hạ tầng đảm bảo availability/maintainability/cost. Hiểu OAuth/SAML, thiết kế bảo mật toàn hệ thống web. Xác định requirements trong budget. Lập lịch toàn dự án. Thiết kế data pipeline.",
      en: "Async/multi-thread programming. Encryption, tuning, backup, fault tolerance. Test plans for large projects. Domain model + Cloud Native. Tunes server/middleware performance. Designs infra for availability/cost. OAuth/SAML, full web security. Defines requirements within budget. Full project scheduling. Data pipeline design.",
    },
    G5: {
      vi: "Thiết kế kiến trúc bền vững đáp ứng cả yêu cầu kỹ thuật và kinh doanh. Quản lý toàn bộ lifecycle data store. Dẫn dắt chiến lược QA. Quyết định Serverless/Microservices/DDD/Clean architecture. Xây dựng hạ tầng tối ưu bền vững. Thiết kế recovery flow. Review và hướng dẫn người khác về bảo mật. Tuning hiệu năng cross-platform. Đề xuất chiến lược dài hạn.",
      en: "Future-proof architecture for technical and business needs. Full data store lifecycle management. Leads QA strategy. Serverless/Microservices/DDD/Clean architecture decisions. Sustainable optimization infra. Recovery flow design. Guides others on security. Cross-platform performance tuning. Long-term strategic proposals.",
    },
    G6: {
      vi: "Dẫn dắt đổi mới kinh doanh, tạo giá trị mới cho toàn công ty.",
      en: "Drives business innovation creating new value across the company.",
    },
  },
  bridge_se: {
    G0: { vi: "Hiểu cơ bản về quy trình phát triển phần mềm. Giao tiếp tiếng Nhật ở mức cơ bản (JLPT N4-N3). Có thể đọc hiểu email tiếng Nhật đơn giản.", en: "Basic understanding of software development process. Basic Japanese communication (JLPT N4-N3). Can read simple Japanese emails." },
    G1: { vi: "Dịch tài liệu kỹ thuật cơ bản Nhật-Việt. Hỗ trợ giao tiếp giữa team. JLPT N3. Hiểu các thuật ngữ IT tiếng Nhật. Có thể tham gia meeting đơn giản.", en: "Translates basic technical documents JP-VN. Supports team communication. JLPT N3. Understands Japanese IT terminology. Can participate in simple meetings." },
    G2: { vi: "JLPT N2. Quản lý schedule dự án nhỏ (3-5 người). Viết specs bằng tiếng Nhật. Hiểu và truyền đạt requirements giữa 2 bên. Sử dụng JIRA/Confluence. Báo cáo tiến độ cho khách hàng.", en: "JLPT N2. Manages small project schedules (3-5 people). Writes specs in Japanese. Understands and communicates requirements between both sides. Uses JIRA/Confluence. Reports progress to clients." },
    G3: { vi: "JLPT N2+. Điều phối dự án 5-10 người. Phân tích requirements phức tạp. Quản lý rủi ro và escalation. Review thiết kế hệ thống. Agile/Scrum facilitation. Tự resolve conflict giữa các bên.", en: "JLPT N2+. Coordinates projects of 5-10 people. Analyzes complex requirements. Manages risks and escalation. Reviews system design. Agile/Scrum facilitation. Self-resolves conflicts between parties." },
    G4: { vi: "JLPT N1. Dẫn dắt dự án lớn (10+ người). Đàm phán trực tiếp với khách hàng cấp cao. Đề xuất giải pháp kỹ thuật. Quản lý nhiều stakeholder. Xây dựng proposal cho dự án mới.", en: "JLPT N1. Leads large projects (10+ people). Directly negotiates with senior clients. Proposes technical solutions. Manages multiple stakeholders. Builds proposals for new projects." },
    G5: { vi: "Quản lý đồng thời nhiều dự án. Xây dựng quy trình offshore chuẩn. Mentoring BrSE junior. Định hình chiến lược hợp tác với đối tác Nhật.", en: "Manages multiple projects simultaneously. Builds standard offshore processes. Mentors junior BrSEs. Shapes cooperation strategy with Japanese partners." },
    G6: { vi: "Xây dựng chiến lược offshore dài hạn cho công ty. Phát triển mối quan hệ kinh doanh mới với đối tác Nhật. Tạo mô hình hợp tác đổi mới.", en: "Builds long-term offshore strategy for the company. Develops new business relationships with Japanese partners. Creates innovative cooperation models." },
  },
  qa_engineer: {
    G0: { vi: "Thực hiện test case theo tài liệu có sẵn. Báo cáo bug với thông tin cơ bản (steps to reproduce). Sử dụng bug tracking tool.", en: "Executes test cases from existing documentation. Reports bugs with basic info (steps to reproduce). Uses bug tracking tools." },
    G1: { vi: "Tạo test case từ specs (equivalence partitioning, boundary value). Hiểu các loại test: functional, regression, smoke. Viết bug report chi tiết. Test trên nhiều môi trường.", en: "Creates test cases from specs (equivalence partitioning, boundary value). Understands test types: functional, regression, smoke. Writes detailed bug reports. Tests across environments." },
    G2: { vi: "Thiết kế test plan có estimation. Viết automation test cơ bản (Selenium/Playwright). Review specs cho quality gate. Phân tích test coverage (C0/C1). Tham gia API testing.", en: "Designs test plans with estimation. Writes basic automation tests (Selenium/Playwright). Reviews specs for quality gate. Analyzes test coverage (C0/C1). Participates in API testing." },
    G3: { vi: "Xây dựng test automation framework. Performance testing (JMeter/k6). Security testing cơ bản. Tích hợp test vào CI/CD pipeline. Đề xuất cải tiến quy trình QA. Hướng dẫn junior.", en: "Builds test automation framework. Performance testing (JMeter/k6). Basic security testing. Integrates tests into CI/CD pipeline. Proposes QA process improvements. Guides juniors." },
    G4: { vi: "Chiến lược QA cho dự án lớn. Thiết kế test architecture. Security testing nâng cao (OWASP). Đánh giá và chọn tools/framework. Quản lý QA team. Xây dựng quality metrics.", en: "QA strategy for large projects. Designs test architecture. Advanced security testing (OWASP). Evaluates and selects tools/frameworks. Manages QA team. Builds quality metrics." },
    G5: { vi: "Xây dựng QA process cho toàn tổ chức. Đánh giá và cải tiến chất lượng liên tục. Shift-left testing strategy. Test trong môi trường cloud-native/microservices.", en: "Builds QA processes for the organization. Continuous quality evaluation and improvement. Shift-left testing strategy. Testing in cloud-native/microservices environments." },
    G6: { vi: "Dẫn dắt văn hoá chất lượng toàn công ty. Đổi mới phương pháp đảm bảo chất lượng.", en: "Leads company-wide quality culture. Innovates quality assurance methodologies." },
  },
  admin: {
    G0: { vi: "Xử lý công việc hành chính cơ bản theo hướng dẫn: photo, scan, sắp xếp tài liệu. Sử dụng MS Office cơ bản.", en: "Handles basic administrative tasks with guidance: copying, scanning, organizing documents. Basic MS Office usage." },
    G1: { vi: "Tự thực hiện quy trình onboarding/offboarding. Quản lý tài sản công ty cơ bản. Đặt phòng họp, vé máy bay, khách sạn. Xử lý courier/bưu phẩm.", en: "Independently handles onboarding/offboarding. Basic company asset management. Books meeting rooms, flights, hotels. Handles courier/mail." },
    G2: { vi: "Điều phối vendor và nhà cung cấp. Hiểu Luật Lao động cơ bản. Quản lý mua sắm và so sánh giá. Xử lý bảo hiểm bắt buộc. Quản lý hợp đồng đơn giản.", en: "Coordinates vendors and suppliers. Understands basic Labor Law. Manages procurement and price comparison. Handles mandatory insurance. Manages simple contracts." },
    G3: { vi: "Soạn thảo văn bản pháp lý (ERC, IRC). Quản lý ngân sách hành chính. Cải tiến quy trình nội bộ. Xử lý quan hệ với cơ quan nhà nước. Payroll accounting.", en: "Drafts legal documents (ERC, IRC). Manages administrative budget. Improves internal processes. Handles government agency relations. Payroll accounting." },
    G4: { vi: "Xây dựng chính sách nội bộ và quy chế công ty. Quản lý compliance toàn diện. Đề xuất tối ưu chi phí vận hành. Quản lý nhiều office/chi nhánh.", en: "Builds internal policies and company regulations. Comprehensive compliance management. Proposes operational cost optimization. Manages multiple offices/branches." },
    G5: { vi: "Chiến lược hành chính dài hạn. Tối ưu chi phí tổ chức ở mức chiến lược. Xây dựng hệ thống ERP. Digital transformation cho quy trình hành chính.", en: "Long-term administrative strategy. Strategic organizational cost optimization. Builds ERP systems. Digital transformation for administrative processes." },
    G6: { vi: "Dẫn dắt chuyển đổi hành chính số hoá toàn công ty. Tạo mô hình vận hành mới.", en: "Leads company-wide digital administrative transformation. Creates new operational models." },
  },
  hr: {
    G0: { vi: "Hỗ trợ quy trình tuyển dụng: đăng tin, sàng lọc CV cơ bản, sắp xếp lịch phỏng vấn. Quản lý hồ sơ nhân sự.", en: "Supports recruitment: posting jobs, basic CV screening, scheduling interviews. Manages HR records." },
    G1: { vi: "Tuyển dụng end-to-end cho vị trí cơ bản. Xử lý thủ tục lao động (hợp đồng, BHXH). Onboarding nhân viên mới. Sử dụng HRIS cơ bản.", en: "End-to-end recruitment for basic positions. Handles labor procedures (contracts, social insurance). Onboards new employees. Basic HRIS usage." },
    G2: { vi: "Tuyển dụng vị trí chuyên môn (IT, kỹ sư). Xây dựng JD chuyên nghiệp. Đánh giá performance cơ bản. Tổ chức training nội bộ. Quản lý employee relations.", en: "Recruits specialized positions (IT, engineers). Builds professional JDs. Basic performance evaluation. Organizes internal training. Manages employee relations." },
    G3: { vi: "Xây dựng chương trình đào tạo có hệ thống. Quản lý quan hệ lao động phức tạp. Phân tích HR data và reporting. Thiết kế chính sách phúc lợi. Employer branding.", en: "Builds systematic training programs. Manages complex labor relations. HR data analysis and reporting. Designs benefits policies. Employer branding." },
    G4: { vi: "Chiến lược tuyển dụng cho công ty. Thiết kế hệ thống đánh giá KPI/OKR. Quản lý C&B (compensation & benefits). Succession planning. Xây dựng career path.", en: "Company recruitment strategy. Designs KPI/OKR evaluation systems. Manages C&B. Succession planning. Builds career paths." },
    G5: { vi: "Chiến lược nhân sự dài hạn (3-5 năm). Xây dựng văn hoá doanh nghiệp. Organizational development. Talent management ở cấp leadership.", en: "Long-term HR strategy (3-5 years). Builds corporate culture. Organizational development. Leadership-level talent management." },
    G6: { vi: "Dẫn dắt chuyển đổi tổ chức toàn diện. Phát triển con người là động lực tăng trưởng công ty. Tạo giá trị kinh doanh thông qua chiến lược nhân sự.", en: "Leads comprehensive organizational transformation. People development as company growth driver. Creates business value through HR strategy." },
  },
};

export const CATEGORY_TITLES: Record<string, { vi: string; en: string; ja: string }> = {
  application_engineer: { vi: "Nhân viên phát triển phần mềm", en: "Application Engineer", ja: "アプリケーションエンジニア" },
  bridge_se: { vi: "Kỹ sư cầu nối", en: "Bridge SE", ja: "ブリッジSE" },
  qa_engineer: { vi: "Nhân viên kiểm soát chất lượng", en: "QA Engineer", ja: "QAエンジニア" },
  admin: { vi: "Nhân viên hành chính", en: "Admin Staff", ja: "管理スタッフ" },
  hr: { vi: "Nhân viên nhân sự", en: "HR Staff", ja: "人事スタッフ" },
};
