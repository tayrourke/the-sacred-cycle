// ═══════════════════════════════════════════
// PHASE CALCULATIONS
// ═══════════════════════════════════════════
var PHASES = {
  menstrual: { name: 'menstrual', moon: '🌑', color: '#b05a52', bg: '#fdf0ee', days: [1,5], arch: '🔮 The Oracle', arch_sub: 'she channels the vision. receive, don\'t produce.', season: '❄️ inner winter' },
  follicular: { name: 'follicular', moon: '🌒', color: '#5a8a6a', bg: '#f0f5f0', days: [6,13], arch: '🎨 The Artist', arch_sub: 'she creates the vision. let ideas flow freely.', season: '🌱 inner spring' },
  ovulatory: { name: 'ovulatory', moon: '🌕', color: '#b8832a', bg: '#fdf6ec', days: [14,17], arch: '✨ The Muse', arch_sub: 'she shares the vision. step forward and be seen.', season: '☀️ inner summer' },
  luteal: { name: 'luteal', moon: '🌖', color: '#6a5a9a', bg: '#f3f0f8', days: [18,99], arch: '🏹 The Huntress', arch_sub: 'she refines the vision. edit, complete, sharpen.', season: '🍂 inner autumn' }
};

function getCycleDay() {
  if (!appState.cycleStarts || !appState.cycleStarts.length) return 1;
  var starts = appState.cycleStarts.map(function(s) { return s.start_date; }).sort();
  var latest = starts[starts.length - 1];
  var start = new Date(latest + 'T00:00:00');
  var today = new Date();
  today.setHours(0,0,0,0);
  var diff = Math.floor((today - start) / 86400000);
  return Math.max(1, diff + 1);
}

function getPhase(cycleDay, cycleLen) {
  cycleLen = cycleLen || appState.profile.cycle_len || 28;
  // Phase boundaries scaled to cycle length
  // Menstrual: days 1–5 (always ~5 days)
  // Follicular: days 6 to ovulation-3
  // Ovulatory: ovulation-2 to ovulation (3 days around ovulation)
  // Luteal: rest (typically ~12-14 days)
  var ovDay = Math.round(cycleLen * 0.5); // ovulation midpoint (day 14 in 28-day)
  if (cycleDay <= 5) return PHASES.menstrual;
  if (cycleDay < ovDay - 1) return PHASES.follicular;
  if (cycleDay <= ovDay + 1) return PHASES.ovulatory;
  return PHASES.luteal;
}

function getPhaseForDay(day, cycleLen) {
  return getPhase(day, cycleLen);
}

function isInFertileWindow(cycleDay, cycleLen) {
  cycleLen = cycleLen || 28;
  var ovDay = Math.round(cycleLen * 0.5);
  return cycleDay >= (ovDay - 6) && cycleDay <= ovDay;
}

function dateToString(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + dd;
}

function todayStr() {
  return dateToString(new Date());
}
