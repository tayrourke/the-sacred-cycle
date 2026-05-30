// ═══════════════════════════════════════════
// APP VERSION
// ═══════════════════════════════════════════
var APP_VERSION = '202604100304'; // auto-updated on each deploy

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
var appState = {
  profile: { app_name: 'The Sacred Cycle', greeting: 'my rhythm', cycle_len: 28, period_len: 5, cycle_goal: 'body literacy', fertility_tracking: true, pregnant: false, pregnancy_due_date: '', pms_notice_days: 3, onboarded: false, first_week_checklist: null, first_week_dismissed: false, block_order: null, hidden_blocks: null, task_set: 'general / everyday life' },
  cycleStarts: [],
  dayLogs: {},
  ritualLogs: {},
  customSettings: { custom_tasks: null, custom_affirmations: null, custom_symptoms: null, custom_mood_emojis: null, custom_mood_words: null, custom_habits: null },
  habitLogs: {}
};
var activeTab = 'today';
var logViewDate = null;
var calendarViewDate = new Date();
var saveTimers = {};
var editMode = false;
var settingsPhaseTab = 'menstrual';
var settingsSymptomTab = 'general';
