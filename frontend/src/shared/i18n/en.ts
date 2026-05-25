export const en = {
  // Common
  search: 'Search',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  create: 'Create',
  back: 'Back',
  viewAll: 'View all',
  loading: 'Loading...',
  noData: 'No data',

  // Auth
  login: 'Login',
  logout: 'Logout',
  email: 'Email',
  password: 'Password',
  loginFailed: 'Login failed. Please check your credentials.',

  // Sidebar
  navDashboard: 'Dashboard',
  navCandidates: 'Candidates',
  navJobs: 'Jobs',
  navInterviews: 'Interviews',
  navTalentPool: 'Talent Pool',
  navOutreach: 'Outreach',
  navSettings: 'Settings',

  // Dashboard
  dashboardTitle: 'Dashboard',
  dashboardSubtitle: 'Overview of your recruitment pipeline',
  todayTasks: "📋 What needs to be done today?",
  tasksCount: '{count} tasks to handle',
  allCaughtUp: 'All caught up! 🎉',
  noTasksDescription: 'No tasks need immediate attention.',
  totalCVs: 'Total CVs',
  goldCandidates: 'Gold Candidates',
  activeJobs: 'Active Jobs',
  avgScore: 'Avg Score',
  classification: 'Classification',
  candidateDistribution: 'Candidate distribution',
  scoreDistribution: 'Score Distribution',
  candidatesByScoreRange: 'Candidates by score range',
  weeklyTrend: 'Weekly Trend',
  cvsScannedThisWeek: 'CVs scanned this week',
  recentCandidates: 'Recent Candidates',
  latestScannedCVs: 'Latest scanned CVs',

  // Action Items
  unreviewedCVs: '{count} CVs not reviewed',
  staleWarning: '{count} waiting over 3 days',
  needsReview: 'Needs review and classification',
  quizSubmitted: '{count} quizzes submitted — needs evaluation',
  quizExpiring: '{count} quizzes expiring soon',
  upcomingInterviews: '{count} upcoming interviews',
  pendingBookings: '{count} candidates haven\'t picked interview slot',
  pendingBookingsDesc: 'Link sent but no response yet',
  expiringJobs: '{count} jobs deadline approaching',
  urgent: 'Urgent',
  expiring: 'Expiring',
  deadline: 'Deadline',

  // Candidates
  candidatesTitle: 'Candidates',
  candidatesTotal: '{total} total · {gold} gold · {silver} silver',
  searchByNameOrSkill: 'Search by name or skill...',
  all: 'All',
  gold: 'Gold',
  silver: 'Silver',
  pool: 'Pool',
  list: 'List',
  pipeline: 'Pipeline',
  compare: 'Compare',
  selectMoreToCompare: 'Select {count} more to compare',
  noCandidatesFound: 'No candidates found',
  adjustFilters: 'Try adjusting your search or filters',
  experience: 'Experience',
  skills: 'Skills',
  score: 'Score',
  status: 'Status',

  // Candidate Detail
  finalScore: 'Final Score',
  ruleScore: 'Rule Score',
  llmScore: 'LLM Score',
  strengths: 'Strengths',
  weaknesses: 'Weaknesses',
  recommendation: 'Recommendation',
  education: 'Education',
  languages: 'Languages',
  expectedSalary: 'Expected Salary',

  // Compare
  compareTitle: 'Compare Candidates',
  compareCandidatesSelected: '{count} candidates selected',
  selectAtLeast2: 'Select at least 2 candidates to compare.',
  backToList: '← Back to list',

  // Jobs
  jobsTitle: 'Jobs',
  newJob: 'New Job',
  jobTitle: 'Title',
  jobDescription: 'Description',
  requiredSkills: 'Required Skills',
  salaryRange: 'Salary Range',
  location: 'Location',

  // Kanban
  statusNew: 'New',
  statusReviewed: 'Reviewed',
  statusApproved: 'Approved',
  statusRejected: 'Rejected',
  statusTalentPool: 'Talent Pool',

  // Interviews
  interviewsTitle: 'Interviews',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',

  // Outreach
  outreachTitle: 'Outreach',
  emailLogs: 'Email Logs',
  outreachType: 'Outreach',
  rejectionType: 'Rejection',
  reminderType: 'Reminder',

  // Settings
  settingsTitle: 'Settings',
} as const;

export type TranslationKey = keyof typeof en;
