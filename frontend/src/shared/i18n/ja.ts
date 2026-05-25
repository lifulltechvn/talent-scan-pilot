import type { TranslationKey } from './en';

export const ja: Record<TranslationKey, string> = {
  // Common
  search: '検索',
  save: '保存',
  cancel: 'キャンセル',
  delete: '削除',
  edit: '編集',
  create: '作成',
  back: '戻る',
  viewAll: 'すべて表示',
  loading: '読み込み中...',
  noData: 'データなし',

  // Auth
  login: 'ログイン',
  logout: 'ログアウト',
  email: 'メール',
  password: 'パスワード',
  loginFailed: 'ログインに失敗しました。認証情報を確認してください。',

  // Sidebar
  navDashboard: 'ダッシュボード',
  navCandidates: '候補者',
  navJobs: '求人',
  navInterviews: '面接',
  navTalentPool: 'タレントプール',
  navOutreach: 'メール送信',
  navSettings: '設定',

  // Dashboard
  dashboardTitle: 'ダッシュボード',
  dashboardSubtitle: '採用パイプラインの概要',
  todayTasks: '📋 今日やるべきこと',
  tasksCount: '{count}件の対応が必要',
  allCaughtUp: 'すべて完了！🎉',
  noTasksDescription: '今すぐ対応が必要なタスクはありません。',
  totalCVs: '総CV数',
  goldCandidates: 'Gold候補者',
  activeJobs: '募集中の求人',
  avgScore: '平均スコア',
  classification: '分類',
  candidateDistribution: '候補者の分布',
  scoreDistribution: 'スコア分布',
  candidatesByScoreRange: 'スコア範囲別の候補者',
  weeklyTrend: '週間トレンド',
  cvsScannedThisWeek: '今週スキャンしたCV',
  recentCandidates: '最近の候補者',
  latestScannedCVs: '最新のスキャンCV',

  // Action Items
  unreviewedCVs: '{count}件のCVが未レビュー',
  staleWarning: '{count}件が3日以上待機中',
  needsReview: 'レビューと分類が必要',
  quizSubmitted: '{count}件のクイズ提出済み — 評価が必要',
  quizExpiring: '{count}件のクイズが期限間近',
  upcomingInterviews: '{count}件の面接予定',
  pendingBookings: '{count}名の候補者が面接枠を未選択',
  pendingBookingsDesc: 'リンク送信済みだが未回答',
  expiringJobs: '{count}件の求人が締切間近',
  urgent: '緊急',
  expiring: '期限間近',
  deadline: '締切',

  // Candidates
  candidatesTitle: '候補者',
  candidatesTotal: '合計{total}名 · Gold {gold}名 · Silver {silver}名',
  searchByNameOrSkill: '名前またはスキルで検索...',
  all: 'すべて',
  gold: 'Gold',
  silver: 'Silver',
  pool: 'プール',
  list: 'リスト',
  pipeline: 'パイプライン',
  compare: '比較',
  selectMoreToCompare: 'あと{count}名選択して比較',
  noCandidatesFound: '候補者が見つかりません',
  adjustFilters: '検索条件やフィルターを調整してください',
  experience: '経験',
  skills: 'スキル',
  score: 'スコア',
  status: 'ステータス',

  // Candidate Detail
  finalScore: '最終スコア',
  ruleScore: 'ルールスコア',
  llmScore: 'AIスコア',
  strengths: '強み',
  weaknesses: '弱み',
  recommendation: '推薦',
  education: '学歴',
  languages: '言語',
  expectedSalary: '希望年収',

  // Compare
  compareTitle: '候補者比較',
  compareCandidatesSelected: '{count}名の候補者を選択中',
  selectAtLeast2: '比較するには2名以上選択してください。',
  backToList: '← リストに戻る',

  // Jobs
  jobsTitle: '求人',
  newJob: '新規求人',
  jobTitle: 'タイトル',
  jobDescription: '説明',
  requiredSkills: '必須スキル',
  salaryRange: '給与範囲',
  location: '勤務地',

  // Kanban
  statusNew: '新規',
  statusReviewed: 'レビュー済み',
  statusApproved: '承認',
  statusRejected: '不採用',
  statusTalentPool: 'タレントプール',

  // Interviews
  interviewsTitle: '面接',
  scheduled: '予定済み',
  completed: '完了',
  cancelled: 'キャンセル済み',

  // Outreach
  outreachTitle: 'メール送信',
  emailLogs: '送信履歴',
  outreachType: 'スカウト',
  rejectionType: '不採用通知',
  reminderType: 'リマインダー',

  // Settings
  settingsTitle: '設定',
};
