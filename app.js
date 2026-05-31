function getTodayLog() {
  var t = todayStr();
  if (!appState.dayLogs) appState.dayLogs = {};
  if (!appState.dayLogs[t]) {
    appState.dayLogs[t] = {
      log_date: t, tasks: [], symptoms: [], intimate: false,
      mood_emoji: [], mood_words: [], flow: '', water: 0,
      sleep: '', note: '', fertility: { mucus: '', lh: '', bbt: '', ovulation_pain: false }
    };
    var yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    var yd = dateToString(yesterday);
    if (appState.dayLogs[yd] && appState.dayLogs[yd].tasks) {
      var yTasks = appState.dayLogs[yd].tasks;
      if (typeof yTasks === 'string') { try { yTasks = JSON.parse(yTasks); } catch(e){ yTasks=[]; } }
      var incomplete = yTasks.filter(function(tk){ return !tk.done; });
      if (incomplete.length) {
        appState.dayLogs[t].tasks = incomplete.map(function(tk){
          return { text: tk.text, done: false, rolledOver: true, energy: tk.energy || inferTaskEnergy(tk.text), phaseFit: tk.phaseFit || null };
        });
      }
    }
  }
  return appState.dayLogs[t];
}

function createEmptyDayLog(dateStr) {
  return {
    log_date: dateStr, tasks: [], symptoms: [], intimate: false,
    mood_emoji: [], mood_words: [], flow: '', water: 0,
    sleep: '', note: '', fertility: { mucus: '', lh: '', bbt: '', ovulation_pain: false }
  };
}

function hasRecordedDayLog(log) {
  if (!log) return false;
  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch(e) { return []; }
  }
  return !!(
    log.intimate ||
    log.flow ||
    Number(log.water || 0) > 0 ||
    log.sleep ||
    (log.note && log.note.trim()) ||
    asArray(log.tasks).length ||
    asArray(log.symptoms).length ||
    asArray(log.mood_emoji).length ||
    asArray(log.mood_words).length ||
    hasFertilitySigns(log.fertility)
  );
}

function getLoggedDayCount() {
  return Object.keys(appState.dayLogs || {}).filter(function(d) {
    return hasRecordedDayLog(appState.dayLogs[d]);
  }).length;
}

function getFertility(log) {
  if (!log.fertility || typeof log.fertility !== 'object') {
    log.fertility = { mucus: '', lh: '', bbt: '', ovulation_pain: false };
  }
  return log.fertility;
}

function getSymptomDetails(log) {
  if (!log.symptom_details || typeof log.symptom_details !== 'object') {
    log.symptom_details = {};
  }
  return log.symptom_details;
}

function getSymptomDetailLabel(log, name) {
  var detail = getSymptomDetails(log)[name] || {};
  var bits = [];
  if (detail.severity) bits.push(detail.severity);
  if (detail.duration) bits.push(detail.duration);
  return bits.length ? bits.join(' · ') : 'tap details';
}

function formatSymptomForDisplay(log, name) {
  var label = getSymptomDetailLabel(log, name);
  return label === 'tap details' ? name : name + ' (' + label + ')';
}

function hasFertilitySigns(fertility) {
  return !!(
    fertility &&
    (fertility.mucus || fertility.lh || fertility.bbt || fertility.ovulation_pain)
  );
}

function isPregnancyMode() {
  return !!(appState.profile && appState.profile.pregnant);
}

function getPregnancyWeek() {
  var due = appState.profile && appState.profile.pregnancy_due_date;
  if (!due) return null;
  var dueDate = new Date(due + 'T00:00:00');
  var today = new Date(); today.setHours(0,0,0,0);
  var daysUntilDue = Math.floor((dueDate - today) / 86400000);
  var week = Math.floor((280 - daysUntilDue) / 7);
  if (week < 1 || week > 43) return null;
  return week;
}

// ═══════════════════════════════════════════
// PROFILE MENU
// ═══════════════════════════════════════════
function toggleProfileMenu() {
  var menu = document.getElementById('profile-menu');
  var overlay = document.getElementById('profile-overlay');
  var open = menu.classList.contains('open');
  if (open) {
    menu.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    menu.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeProfileMenu() {
  document.getElementById('profile-menu').classList.remove('open');
  document.getElementById('profile-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════
// LOAD + LAUNCH
// ═══════════════════════════════════════════
function init() {
  loadAndLaunch();
  setTimeout(checkForAppUpdate, 3000);
}

function loadFromCache() {
  var profile = lsGet('appSettings');
  if (profile) Object.assign(appState.profile, profile);
  repairHiddenBlocks();
  var cycles = lsGet('pastCycles');
  if (cycles) appState.cycleStarts = cycles;
  var days = lsGet('dayData');
  if (days) appState.dayLogs = days;
  var rituals = lsGet('rituals');
  if (rituals) appState.ritualLogs = rituals;
  var custom = lsGet('customSettings');
  if (custom) appState.customSettings = custom;
  var hl = lsGet('habitLogs');
  if (hl) appState.habitLogs = hl;
  // Restore task_sets from dedicated key (more reliable than appSettings merge)
  var ts = lsGet('taskSets');
  if (ts && Array.isArray(ts) && ts.length) {
    appState.profile.task_sets = JSON.stringify(ts);
    appState.profile.task_set  = ts[0];
  }
  applyDarkMode();
  if (lsGet('onboarded')) appState.profile.onboarded = true;
}

function loadAndLaunch() {
  loadFromCache();
  document.getElementById('app').classList.remove('hidden');
  if (typeof window.hideBootStatus === 'function') window.hideBootStatus();
  updatePhaseDisplay();
  renderAllTabs();
  checkOnboarding();
}

// ═══════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════
var obStep = 0;
var obData = { appName: 'The Sacred Cycle', greeting: 'welcome back', cycleStart: '', cycleLen: 28, periodLen: 5, cycleGoal: 'body literacy', fertilityTracking: true, pmsNoticeDays: 3, taskSet: 'general / everyday life' };

function checkOnboarding() {
  if (!appState.profile.onboarded && !lsGet('onboarded')) {
    obStep = 0;
    document.getElementById('ob-overlay').classList.remove('hidden');
    renderObStep();
  }
}

function renderObStep() {
  var html = '';
  html += '<div style="display:flex;justify-content:center;margin-bottom:24px;">';
  [0,1,2,3,4,5].forEach(function(i) {
    html += '<div class="ob-dot' + (i===obStep?' active':'') + '" style="margin:0 3px;"></div>';
  });
  html += '</div>';

  if (obStep === 0) {
    html += '<div class="ob-step">';
    html += '<div class="ob-title">welcome to your<br>cycle sanctuary 🌙</div>';
    html += '<div class="ob-sub">This app is a sacred space to track your cycle, honor your rhythms, and work with your body — not against it. Let\'s set things up just for you.</div>';
    html += '<button class="btn-ob" onclick="obNext()">let\'s begin →</button>';
    html += '</div>';
  } else if (obStep === 1) {
    html += '<div class="ob-step">';
    html += '<div class="ob-step-num">step 1 of 3</div>';
    html += '<div class="ob-title">name your sanctuary</div>';
    html += '<div class="ob-sub">What would you like to call this space? And how should it greet you each day?</div>';
    html += '<label class="ob-label">app name</label>';
    html += '<input id="ob-name" class="ob-input" type="text" value="' + obData.appName + '" placeholder="The Sacred Cycle">';
    html += '<label class="ob-label">daily greeting</label>';
    html += '<input id="ob-greeting" class="ob-input" type="text" value="' + obData.greeting + '" placeholder="welcome back">';
    html += '<button class="btn-ob" onclick="obNext()">continue →</button>';
    html += '</div>';
  } else if (obStep === 2) {
    html += '<div class="ob-step">';
    html += '<div class="ob-step-num">step 2 of 3</div>';
    html += '<div class="ob-title">anchor your cycle</div>';
    html += '<div class="ob-sub">When did your most recent period begin? And how long is your typical cycle?</div>';
    html += '<label class="ob-label">cycle start date (day 1 of last period)</label>';
    html += '<input id="ob-start" class="ob-input" type="date" value="' + obData.cycleStart + '">';
    html += '<label class="ob-label">average cycle length (days)</label>';
    html += '<input id="ob-len" class="ob-input" type="number" min="21" max="35" value="' + obData.cycleLen + '">';
    html += '<button class="btn-ob" onclick="obNext()">continue \u2192</button>';
    html += '</div>';
  } else if (obStep === 3) {
    html += '<div class="ob-step">';
    html += '<div class="ob-step-num">step 3 of 4</div>';
    html += '<div class="ob-title">choose your rhythm</div>';
    html += '<div class="ob-sub" style="margin-bottom:20px;">What best describes your day-to-day life? This personalizes your daily focus suggestions for each phase.</div>';
    var taskSets = Object.keys(TASK_SETS);
    var selSets = obData.taskSets && obData.taskSets.length ? obData.taskSets : [obData.taskSet||'general / everyday life'];
    html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);margin-bottom:10px;">select all that apply</div>';
    taskSets.forEach(function(s) {
      var active = selSets.indexOf(s) > -1;
      html += '<div data-ts="' + s + '" onclick="obSelectTaskSet(this.dataset.ts)" style="padding:13px 16px;border-radius:var(--radius-sm);border:1.5px solid ' + (active ? 'var(--brand)' : 'var(--bg2)') + ';background:' + (active ? 'rgba(176,90,82,0.06)' : 'var(--white)') + ';margin-bottom:10px;cursor:pointer;">';
      html += '<div style="font-size:.88rem;color:var(--text);font-weight:400;">' + s + '</div>';
      html += '</div>';
    });
    html += '<button class="btn-ob" onclick="obNext()">continue \u2192</button>';
    html += '</div>';
  } else if (obStep === 4) {
    html += '<div class="ob-step">';
    html += '<div class="ob-step-num">optional</div>';
    html += '<div class="ob-title">fine-tune your cycle support</div>';
    html += '<div class="ob-sub" style="margin-bottom:18px;">These help personalize predictions and insights. You can skip them and change them later.</div>';
    html += '<label class="ob-label">what are you mostly tracking for?</label>';
    html += '<select id="ob-cycle-goal" class="ob-input">';
    ['body literacy','cycle support','symptom patterns','fertility awareness','trying to conceive'].forEach(function(g) {
      html += '<option value="' + g + '"' + (obData.cycleGoal===g?' selected':'') + '>' + g + '</option>';
    });
    html += '</select>';
    html += '<label class="ob-label">typical bleed length</label>';
    html += '<input id="ob-period-len" class="ob-input" type="number" min="2" max="10" value="' + obData.periodLen + '">';
    html += '<label class="ob-label">PMS support reminder</label>';
    html += '<select id="ob-pms-days" class="ob-input">';
    [1,2,3,4,5,7].forEach(function(n) {
      html += '<option value="' + n + '"' + (obData.pmsNoticeDays===n?' selected':'') + '>' + n + ' day' + (n===1?'':'s') + ' before predicted period</option>';
    });
    html += '</select>';
    html += '<label class="ob-label">fertility signs tracker</label>';
    html += '<select id="ob-fertility-tracking" class="ob-input">';
    html += '<option value="yes"' + (obData.fertilityTracking?' selected':'') + '>show LH, mucus, BBT + ovulation pain tracker</option>';
    html += '<option value="no"' + (!obData.fertilityTracking?' selected':'') + '>hide for now</option>';
    html += '</select>';
    html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">';
    html += '<button class="btn-ob" onclick="obNext()">continue \u2192</button>';
    html += '<button class="btn-ob-secondary" onclick="obSkipCycleQuestions()">skip</button>';
    html += '</div>';
    html += '</div>';
  } else if (obStep === 5) {
    html += '<div class="ob-step" style="text-align:center;">';
    html += '<div style="font-size:3rem;margin-bottom:16px;">🌙</div>';
    html += '<div class="ob-title">you\'re all set</div>';
    html += '<div class="ob-sub">Your sanctuary is ready. Come here each day to check in, receive support, and honor the sacred rhythm of your body.</div>';
    html += '<button class="btn-ob" onclick="obFinish()">enter my cycle →</button>';
    html += '</div>';
  }
  document.getElementById('ob-content').innerHTML = html;
}

function obNext() {
  if (obStep === 1) {
    var nameEl = document.getElementById('ob-name');
    var greetEl = document.getElementById('ob-greeting');
    if (nameEl) obData.appName = nameEl.value || 'The Sacred Cycle';
    if (greetEl) obData.greeting = greetEl.value || 'welcome back';
  }
  if (obStep === 2) {
    var startEl = document.getElementById('ob-start');
    var lenEl = document.getElementById('ob-len');
    if (startEl) obData.cycleStart = startEl.value;
    if (lenEl) obData.cycleLen = parseInt(lenEl.value) || 28;
    if (!obData.cycleStart) { alert('please enter a cycle start date'); return; }
  }
  if (obStep === 3) {
    appState.profile.task_set = obData.taskSet || 'general / everyday life';
    lsSet('appSettings', appState.profile);
  }
  if (obStep === 4) {
    var goalEl = document.getElementById('ob-cycle-goal');
    var periodEl = document.getElementById('ob-period-len');
    var pmsEl = document.getElementById('ob-pms-days');
    var fertilityEl = document.getElementById('ob-fertility-tracking');
    if (goalEl) obData.cycleGoal = goalEl.value || 'body literacy';
    if (periodEl) obData.periodLen = parseInt(periodEl.value) || 5;
    if (pmsEl) obData.pmsNoticeDays = parseInt(pmsEl.value) || 3;
    if (fertilityEl) obData.fertilityTracking = fertilityEl.value !== 'no';
  }
  obStep++;
  if (obStep > 5) obStep = 5;
  renderObStep();
}

function obSkipCycleQuestions() {
  obData.periodLen = 5;
  obData.cycleGoal = 'body literacy';
  obData.fertilityTracking = true;
  obData.pmsNoticeDays = 3;
  obStep = 5;
  renderObStep();
}

function obSelectTaskSet(set) {
  if (!obData.taskSets) obData.taskSets = [];
  var idx = obData.taskSets.indexOf(set);
  if (idx > -1) { obData.taskSets.splice(idx, 1); }
  else { obData.taskSets.push(set); }
  obData.taskSet = obData.taskSets[0] || 'general / everyday life';
  renderObStep();
}

async function obFinish() {
  appState.profile.app_name  = obData.appName;
  appState.profile.greeting  = obData.greeting;
  appState.profile.cycle_len = obData.cycleLen;
  appState.profile.period_len = obData.periodLen || 5;
  appState.profile.cycle_goal = obData.cycleGoal || 'body literacy';
  appState.profile.fertility_tracking = obData.fertilityTracking !== false;
  appState.profile.pms_notice_days = obData.pmsNoticeDays || 3;
  appState.profile.onboarded = true;
  // Save task sets to profile AND dedicated localStorage key
  var chosenSets = obData.taskSets && obData.taskSets.length ? obData.taskSets : [obData.taskSet || 'general / everyday life'];
  appState.profile.task_set  = chosenSets[0];
  appState.profile.task_sets = JSON.stringify(chosenSets);
  lsSet('taskSets', chosenSets);
  lsSet('appSettings', appState.profile);
  lsSet('onboarded', true);

  // Always save cycle start locally first
  if (obData.cycleStart) {
    var entry = { user_id: 'local', start_date: obData.cycleStart, is_current: true };
    appState.cycleStarts = [entry];
    lsSet('pastCycles', appState.cycleStarts);
  }
  document.getElementById('ob-overlay').classList.add('hidden');
  updatePhaseDisplay();
  renderAllTabs();
}

// ═══════════════════════════════════════════
// HEADER + PHASE DISPLAY
// ═══════════════════════════════════════════
function updatePhaseDisplay() {
  var cycleDay = getCycleDay();
  var cycleLen = appState.profile.cycle_len || 28;
  var phase = getPhase(cycleDay, cycleLen);

  if (isPregnancyMode()) {
    var week = getPregnancyWeek();
    document.getElementById('header-greeting').textContent = appState.profile.greeting || 'my rhythm';
    document.getElementById('header-appname').textContent = appState.profile.app_name || 'The Sacred Cycle';
    var pregPill = document.getElementById('phase-pill');
    pregPill.textContent = week ? '🤍  week ' + week : '🤍  pregnancy';
    pregPill.style.background = '#8a6a9a';
    pregPill.style.color = '#fff';
    document.getElementById('season-badge').textContent = 'support mode';
    var pregFertile = document.getElementById('fertile-banner');
    if (pregFertile) pregFertile.style.display = 'none';
    var pregCycleBar = document.getElementById('cycle-bar-wrap');
    if (pregCycleBar) pregCycleBar.style.display = 'none';
    if (typeof applyDarkMode === 'function') applyDarkMode();
    return;
  }

  var cycleBarWrap = document.getElementById('cycle-bar-wrap');
  if (cycleBarWrap) cycleBarWrap.style.display = '';

  document.getElementById('header-greeting').textContent = (appState.profile.greeting || 'my rhythm') + '  ·  day ' + cycleDay;
  document.getElementById('header-appname').textContent = appState.profile.app_name || 'The Sacred Cycle';

  // Big centered phase pill
  var pill = document.getElementById('phase-pill');
  pill.textContent = phase.moon + '  ' + phase.name;
  pill.style.background = phase.color;
  pill.style.color = '#fff';

  // Season pill
  var seasonNames = { menstrual:'❄️  Inner Winter', follicular:'🌱  Inner Spring', ovulatory:'☀️  Inner Summer', luteal:'🍂  Inner Autumn' };
  document.getElementById('season-badge').textContent = seasonNames[phase.name] || phase.season;

  // Fertile banner
  var fertile = document.getElementById('fertile-banner');
  if (isInFertileWindow(cycleDay, cycleLen)) {
    fertile.style.display = '';
    var _ov = Math.round(cycleLen * 0.5); fertile.textContent = '🌸 fertile window — days ' + (_ov - 6) + '–' + _ov;
  } else {
    fertile.style.display = 'none';
  }

  // Segmented cycle bar — proportional segments
  // Phase day boundaries (consistent with getPhase)
  var ovDay2   = Math.round(cycleLen * 0.5);
  var mensEnd  = 5;
  var follEnd  = ovDay2 - 2;
  var ovulEnd  = ovDay2 + 1;
  var lutEnd   = cycleLen;

  var bar = document.getElementById('cycle-seg-bar');
  if (bar) {
    document.getElementById('cseg-mens').style.width = (mensEnd / cycleLen * 100) + '%';
    document.getElementById('cseg-foll').style.width = (Math.max(0, follEnd - mensEnd) / cycleLen * 100) + '%';
    document.getElementById('cseg-ovul').style.width = (Math.max(0, ovulEnd - follEnd) / cycleLen * 100) + '%';
    document.getElementById('cseg-lut').style.width  = (Math.max(0, lutEnd - ovulEnd) / cycleLen * 100) + '%';

    // Dot position — clamp between 0 and 100%
    var pct = Math.min(99, Math.max(1, ((cycleDay - 1) / (cycleLen - 1)) * 100));
    var dot = document.getElementById('cycle-dot');
    dot.style.left = pct + '%';

    // Dot border color = current phase color
    dot.style.borderColor = phase.color;
  }

  // Update day labels
  var labelRight = document.getElementById('cycle-len-label');
  if (labelRight) labelRight.textContent = cycleLen;
  if (typeof applyDarkMode === 'function') applyDarkMode();
}

// ═══════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════
function switchTab(tab) {
  flushPendingTextInputs();
  activeTab = tab;
  document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var pane = document.getElementById(tab + '-pane');
  var btn  = document.getElementById('tab-' + tab);
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  document.getElementById('tab-content').scrollTop = 0;
  if (tab === 'support') renderSupport();
  if (tab === 'insights') renderInsights();
  if (tab === 'today') renderToday();
  if (tab === 'tasks') renderTasksTab();
  if (tab === 'habits') renderHabits();
  if (tab === 'library') renderLibrary();
  if (tab === 'log') renderLog();
}

function renderAllTabs() {
  var fns = [renderToday, renderSupport, renderLog, renderTasksTab, renderInsights, renderHabits, renderLibrary];
  fns.forEach(function(fn) {
    try { fn(); } catch(e) { console.warn('render error:', fn.name, e); }
  });
}

// ═══════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════
var DEFAULT_BLOCK_ORDER = ['affirmation','calendar','why','intimacy','mood','fertility','symptoms','relief','note','ritual'];
var calendarEditDate = null;
var insightsView = 'overview';
var habitViewOptions = ['today','month','year'];

function getBlockOrder() {
  var saved = null;
  if (appState.profile.block_order) {
    try { saved = JSON.parse(appState.profile.block_order); } catch(e) {}
  }
  if (!saved || !Array.isArray(saved)) return DEFAULT_BLOCK_ORDER.slice();
  // Merge: keep saved order, but append any blocks from default that are missing
  var merged = saved.filter(function(b) { return DEFAULT_BLOCK_ORDER.indexOf(b) > -1; });
  DEFAULT_BLOCK_ORDER.forEach(function(b) {
    if (merged.indexOf(b) === -1) merged.push(b);
  });
  // Rituals should always close the Today page, even if an older saved layout had them higher up.
  merged = merged.filter(function(b) { return b !== 'ritual'; });
  merged.push('ritual');
  return merged;
}

function getHiddenBlocks() {
  if (appState.profile.hidden_blocks) {
    try {
      var h = JSON.parse(appState.profile.hidden_blocks);
      if (Array.isArray(h)) return h;
    } catch(e) {}
  }
  return [];
}

// Call this once on load to repair any blocks incorrectly hidden
function repairHiddenBlocks() {
  var hidden = getHiddenBlocks();
  // If too many blocks hidden, reset entirely
  if (hidden.length >= DEFAULT_BLOCK_ORDER.length - 3) {
    appState.profile.hidden_blocks = null;
    lsSet('appSettings', appState.profile);
    return;
  }
  // Also ensure core blocks are never silently hidden.
  var core = ['mood'];
  var needsRepair = core.some(function(b){ return hidden.indexOf(b) > -1; });
  if (needsRepair) {
    var filtered = hidden.filter(function(b){ return core.indexOf(b) === -1; });
    appState.profile.hidden_blocks = JSON.stringify(filtered);
    lsSet('appSettings', appState.profile);
  }
}

function getMoodEmojis() {
  if (appState.customSettings && appState.customSettings.custom_mood_emojis) {
    try {
      var v = appState.customSettings.custom_mood_emojis;
      var parsed = typeof v === 'string' ? JSON.parse(v) : v;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e) {}
  }
  return DEFAULT_MOOD_EMOJIS.slice();
}

function getMoodWords() {
  if (appState.customSettings && appState.customSettings.custom_mood_words) {
    try {
      var v = appState.customSettings.custom_mood_words;
      var parsed = typeof v === 'string' ? JSON.parse(v) : v;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e) {}
  }
  return DEFAULT_MOOD_WORDS.slice();
}

function getSymptoms() {
  function defaultSymptoms(key, fallbackKey) {
    var symptoms = DEFAULT_SYMPTOMS[key] || (fallbackKey ? DEFAULT_SYMPTOMS[fallbackKey] : null) || [];
    return symptoms.slice();
  }
  var base = {
    general: defaultSymptoms('general'),
    menstrual: defaultSymptoms('menstrual'),
    follicular: defaultSymptoms('follicular'),
    ovulatory: defaultSymptoms('ovulatory', 'ovulation'),
    luteal: defaultSymptoms('luteal')
  };
  if (appState.customSettings && appState.customSettings.custom_symptoms) {
    try {
      var v = appState.customSettings.custom_symptoms;
      var cs = typeof v === 'string' ? JSON.parse(v) : v;
      if (cs && cs.general) cs.general.forEach(function(s) { base.general.push(s); });
      if (cs && cs.menstrual) cs.menstrual.forEach(function(s) { base.menstrual.push(s); });
      if (cs && cs.follicular) cs.follicular.forEach(function(s) { base.follicular.push(s); });
      if (cs && cs.ovulation) cs.ovulation.forEach(function(s) { base.ovulatory.push(s); });
      if (cs && cs.ovulatory) cs.ovulatory.forEach(function(s) { base.ovulatory.push(s); });
      if (cs && cs.luteal) cs.luteal.forEach(function(s) { base.luteal.push(s); });
    } catch(e) {}
  }
  return base;
}

function renderToday() {
  var pane = document.getElementById('today-pane');
  if (!pane) return;
  var log = getTodayLog();
  var cycleDay = getCycleDay();
  var cycleLen = appState.profile.cycle_len || 28;
  var phase = getPhase(cycleDay, cycleLen);
  var blockOrder = getBlockOrder();
  if (!isPregnancyMode()) blockOrder = blockOrder.filter(function(b) { return b !== 'flow'; });
  blockOrder = blockOrder.filter(function(b) { return b !== 'ritual'; });
  blockOrder.push('ritual');
  var hiddenBlocks = getHiddenBlocks();
  var html = '';

  if (isPregnancyMode()) {
    html += renderPregnancyTodayCard();
  }
  html += renderFirstWeekGuide();

  blockOrder.forEach(function(blockId) {
    if (hiddenBlocks.indexOf(blockId) > -1) return;
    if (isPregnancyMode() && (blockId === 'fertility' || blockId === 'calendar' || blockId === 'ritual')) return;
    if (blockId === 'fertility' && appState.profile.fertility_tracking === false) return;
    html += '<div class="block-wrapper" id="block-' + blockId + '" data-block="' + blockId + '">';
    if (editMode) {
      html += '<div class="drag-handle">☰</div>';
      html += '<button class="block-hide-btn" onclick="hideBlock(\'' + blockId + '\')">✕</button>';
    }
    try {
      html += renderBlock(blockId, log, phase, cycleDay);
    } catch(e) {
      console.warn('block render error:', blockId, e);
      html += '<div class="card"><div class="card-body" style="color:var(--text3);font-size:.8rem;">could not load ' + blockId + '</div></div>';
    }
    html += '</div>';
  });

  // Hidden block restore chips in edit mode
  if (editMode && hiddenBlocks.length > 0) {
    html += '<div style="margin-bottom:14px;">';
    html += '<div class="section-label">hidden blocks</div>';
    hiddenBlocks.forEach(function(b) {
      html += '<span class="chip chip-sm" onclick="showBlock(\'' + b + '\')" style="margin:3px;">+ ' + b + '</span>';
    });
    html += '</div>';
  }

  if (editMode) {
    html += '<button class="done-editing-btn" style="display:block;" onclick="doneEditing()">done editing</button>';
  } else {
    html += '<button class="edit-layout-btn" onclick="startEditing()">⠿ edit layout</button>';
  }

  pane.innerHTML = html;
  pane.className = 'tab-pane active';
  if (editMode) pane.classList.add('edit-mode');
  attachTodayEvents(log, phase);
}

function isClosingRitualDay(cycleDay, cycleLen) {
  cycleLen = cycleLen || appState.profile.cycle_len || 28;
  return cycleDay >= cycleLen - 2;
}

function renderBlock(blockId, log, phase, cycleDay) {
  if (blockId === 'affirmation') return renderAffirmationBlock(phase, cycleDay);
  if (blockId === 'why') return renderDailyWhyBlock(log, phase, cycleDay);
  if (blockId === 'ritual') return renderRitualBlock(phase, cycleDay);
  if (blockId === 'calendar') return renderCalendarBlock();
  if (blockId === 'intimacy') return renderIntimacyBlock(log);
  if (blockId === 'mood') return renderMoodBlock(log);
  if (blockId === 'flow') return renderFlowBlock(log);
  if (blockId === 'fertility') return renderFertilityBlock(log);
  if (blockId === 'fluids') return renderFluidsBlock(log);
  if (blockId === 'sleep') return renderSleepBlock(log);
  if (blockId === 'symptoms') return renderSymptomsBlock(log);
  if (blockId === 'relief') return renderSymptomReliefBlock(log, phase);
  if (blockId === 'note') return renderNoteBlock(log);
  return '';
}

function renderAffirmationBlock(phase, cycleDay) {
  if (isPregnancyMode()) {
    var week = getPregnancyWeek();
    var htmlP = '<div class="hero-card card">';
    htmlP += '<div class="hero-moon">🤍</div>';
    htmlP += '<div class="hero-phase">' + (week ? 'week ' + week : 'pregnancy') + '</div>';
    htmlP += '<div class="hero-quote">I can listen closely to my body and ask for support when I need it.</div>';
    htmlP += '<div class="hero-season">A softer tracking mode for pregnancy, symptoms, and care notes.</div>';
    htmlP += '</div>';
    return htmlP;
  }
  var affs = AFFIRMATIONS[phase.name] || AFFIRMATIONS.menstrual;
  if (appState.customSettings && appState.customSettings.custom_affirmations) {
    try {
      var ca = appState.customSettings.custom_affirmations;
      var caObj = typeof ca === 'string' ? JSON.parse(ca) : ca;
      if (caObj && caObj[phase.name] && caObj[phase.name].length) affs = caObj[phase.name];
    } catch(e) {}
  }
  var idx = (cycleDay - 1) % affs.length;
  var aff = affs[idx];

  var seasonData = {
    menstrual:  { emoji: '❄️', name: 'Inner Winter', desc: 'A time to rest, reflect, and restore. Like winter, this phase invites you inward — to be still, to release, and to let the ground lie fallow before new growth begins.' },
    follicular: { emoji: '🌱', name: 'Inner Spring',  desc: 'Energy stirs and possibilities open. Like spring, this phase asks you to plant seeds — to imagine, begin, and say yes to what wants to grow.' },
    ovulatory:  { emoji: '☀️', name: 'Inner Summer',  desc: 'Full bloom. Your radiance is at its peak. Like summer, this phase invites you to be seen, to connect, and to let your light move outward into the world.' },
    luteal:     { emoji: '🍂', name: 'Inner Autumn',  desc: 'The harvest and the turning. Like autumn, this phase calls you to complete, to release what no longer serves, and to prepare the ground for rest.' }
  };
  var sd = seasonData[phase.name] || seasonData.menstrual;

  var archColors = { menstrual:'#c9998f', follicular:'#5a8a6a', ovulatory:'#b8832a', luteal:'#6a5a9a' };
  var archBgs   = { menstrual:'#fdf0ee', follicular:'#f0f5f0', ovulatory:'#fdf6ec', luteal:'#f3f0f8' };
  var seasonBg  = '#edf0f5';
  var seasonColor = '#4a5a7a';

  var archEmoji = { menstrual:'🔮', follicular:'🎨', ovulatory:'✨', luteal:'🏹' };
  var archName  = { menstrual:'The Oracle', follicular:'The Artist', ovulatory:'The Muse', luteal:'The Huntress' };

  var html = '<div class="card" id="aff-card">';
  html += '<div style="padding:14px 16px 6px;"><span style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.14em;text-transform:uppercase;color:var(--text3);">today\'s affirmation</span></div>';
  html += '<div style="padding:4px 16px 16px;">';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.22rem,5.2vw,1.5rem);font-style:italic;font-weight:300;line-height:1.5;color:var(--text);margin-bottom:14px;">\u201c' + aff + '\u201d</div>';
  // Arch card
  html += '<div style="display:flex;align-items:center;gap:11px;background:' + archBgs[phase.name] + ';border-radius:12px;padding:11px 13px;margin-bottom:8px;">';
  html += '<span style="font-size:1.8rem;flex-shrink:0;">' + archEmoji[phase.name] + '</span>';
  html += '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(.9rem,3.6vw,1.05rem);font-weight:500;color:' + archColors[phase.name] + ';margin-bottom:1px;">' + archName[phase.name] + '</div>';
  html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);line-height:1.45;">' + phase.arch_sub + '</div></div>';
  html += '</div>';
  // Season card
  html += '<div style="display:flex;align-items:center;gap:11px;background:' + seasonBg + ';border-radius:12px;padding:11px 13px;">';
  html += '<span style="font-size:1.8rem;flex-shrink:0;">' + sd.emoji + '</span>';
  html += '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(.9rem,3.6vw,1.05rem);font-weight:500;color:' + seasonColor + ';margin-bottom:1px;">' + sd.name + '</div>';
  html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);line-height:1.5;">' + sd.desc + '</div></div>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderDailyWhyBlock(log, phase, cycleDay) {
  if (isPregnancyMode()) {
    var htmlP = '<div class="insight-mini-card">';
    htmlP += '<div class="insight-mini-kicker">why this matters</div>';
    htmlP += '<div class="insight-mini-title">pregnancy support mode</div>';
    htmlP += '<div class="insight-mini-body">Cycle predictions are paused. Use this space to track symptoms, sleep, hydration, mood, notes, habits, and anything you want to bring to your provider.</div>';
    htmlP += '</div>';
    return htmlP;
  }
  var fertility = getFertility(log);
  var messages = {
    menstrual: 'Today is about conserving resources. Rest, warmth, iron, and hydration support the work your body is already doing.',
    follicular: 'Rising estrogen can make learning, planning, and starting feel easier. Capture ideas while your brain is naturally opening.',
    ovulatory: 'Communication and visibility often peak near ovulation. Fertility signs like LH and cervical mucus can make timing more personal.',
    luteal: 'Progesterone asks for completion, steadier blood sugar, and softer evenings. Your sensitivity can be useful data.'
  };
  var dataNotes = [];
  if (log.sleep) dataNotes.push('sleep: ' + log.sleep);
  if (log.flow) dataNotes.push('flow: ' + log.flow);
  if (fertility.mucus) dataNotes.push('mucus: ' + fertility.mucus);
  if (fertility.lh) dataNotes.push('LH: ' + fertility.lh);
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">why this matters</div>';
  html += '<div class="insight-mini-title">day ' + cycleDay + ' · ' + phase.name + '</div>';
  html += '<div class="insight-mini-body">' + (messages[phase.name] || messages.menstrual) + '</div>';
  if (dataNotes.length) html += '<div class="insight-mini-meta">' + dataNotes.slice(0,3).join(' · ') + '</div>';
  html += '<div class="insight-mini-meta">consistent tiny logs are what make the app\'s pattern reads more accurate.</div>';
  html += '</div>';
  return html;
}

function renderPregnancyTodayCard() {
  var week = getPregnancyWeek();
  var html = '<div class="card pregnancy-card">';
  html += '<div class="card-header"><span class="card-title">pregnancy mode</span></div>';
  html += '<div class="card-body">';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.15rem,4.8vw,1.35rem);color:var(--brand);margin-bottom:6px;">' + (week ? 'week ' + week : 'support without cycle predictions') + '</div>';
  html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text2);line-height:1.65;">Period, ovulation, fertile-window, and fertility prediction cards are paused. Keep logging how you feel, and check with a qualified provider before using herbs, supplements, castor oil, steaming, detox protocols, or intense new routines.</div>';
  html += '<div class="flag-row" style="margin-top:10px;border-left-color:#8a6a9a;">provider note idea: track questions, new symptoms, bleeding/spotting, sleep, hydration, nausea, movement, and mood shifts.</div>';
  html += '</div></div>';
  return html;
}

function renderFirstWeekGuide() {
  if (appState.profile && appState.profile.first_week_dismissed) return '';
  var checked = getFirstWeekChecklist();
  var steps = [
    { id:'maximize', text: 'read how to maximize this app', action:'showMaximizeGuideFromChecklist' },
    { id:'cycle', text: 'set your current cycle start in the Log tab' },
    { id:'daily', text: 'log one full day of mood, symptoms, sleep, and notes' },
    { id:'customize', text: 'customize symptoms, habits, or focus prompts' },
    { id:'fertility', text: 'track fertility signs if they matter to your goal' },
    { id:'backup', text: 'export a local backup when your setup feels right' }
  ];
  if (steps.every(function(s) { return checked[s.id]; })) return '';
  var html = '<div class="insight-mini-card">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:3px;">';
  html += '<div class="insight-mini-kicker" style="margin-bottom:0;">first-week guide</div>';
  html += '<button onclick="dismissFirstWeekGuide()" style="border:none;background:transparent;color:var(--text3);font-size:.72rem;cursor:pointer;">dismiss</button>';
  html += '</div>';
  html += '<div class="insight-mini-title">make the app smarter gently</div>';
  html += '<div class="insight-mini-body">Use this as a soft setup list. A few honest early logs help the app give you more grounded, useful insights.</div>';
  steps.forEach(function(step) {
    var done = !!checked[step.id];
    var action = step.action ? step.action + '()' : 'toggleFirstWeekStep(\'' + step.id + '\')';
    var stepText = step.id === 'maximize'
      ? 'read <span style="text-decoration:underline;text-underline-offset:3px;">how to maximize this app</span>'
      : step.text;
    html += '<button onclick="' + action + '" style="width:100%;text-align:left;border:none;background:transparent;padding:0;margin:0;cursor:pointer;">';
    html += '<div class="flag-row" style="border-left-color:' + (done ? '#5a8a6a' : 'var(--brand)') + ';display:flex;align-items:center;gap:9px;">';
    html += '<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid ' + (done ? '#5a8a6a' : 'var(--bg2)') + ';background:' + (done ? '#5a8a6a' : 'transparent') + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;flex-shrink:0;">' + (done ? '&#10003;' : '') + '</span>';
    html += '<span style="' + (done ? 'text-decoration:line-through;color:var(--text3);' : '') + '">' + stepText + '</span>';
    html += '</div></button>';
  });
  html += '</div>';
  return html;
}

function getFirstWeekChecklist() {
  var raw = appState.profile && appState.profile.first_week_checklist;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch(e) { return {}; }
  }
  return raw || {};
}

function saveFirstWeekChecklist(checked) {
  appState.profile.first_week_checklist = checked || {};
  lsSet('appSettings', appState.profile);
  showSync('saved');
}

function toggleFirstWeekStep(stepId) {
  var checked = getFirstWeekChecklist();
  checked[stepId] = !checked[stepId];
  saveFirstWeekChecklist(checked);
  renderToday();
}

function dismissFirstWeekGuide() {
  appState.profile.first_week_dismissed = true;
  lsSet('appSettings', appState.profile);
  showSync('saved');
  renderToday();
}

function showMaximizeGuideFromChecklist() {
  var checked = getFirstWeekChecklist();
  checked.maximize = true;
  saveFirstWeekChecklist(checked);
  renderToday();
  showMaximizeGuide();
}

function renderSymptomReliefBlock(log, phase) {
  var symptoms = log.symptoms || [];
  if (typeof symptoms === 'string') { try { symptoms = JSON.parse(symptoms); } catch(e) { symptoms = []; } }
  if (!symptoms.length) return '';
  var html = '<div class="card"><div class="card-header"><span class="card-title">support now</span></div><div class="card-body">';
  html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text3);line-height:1.55;margin-bottom:10px;">based on what you logged today</div>';
  symptoms.slice(0,3).forEach(function(sym) {
    var play = getSymptomPlaybook(sym, phase.name);
    html += '<div class="relief-row">';
    html += '<div class="relief-symptom">' + sym + '</div>';
    html += '<div class="relief-body"><strong>try now:</strong> ' + play.now + '<br><strong>support today:</strong> ' + play.today + '</div>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function getSymptomPlaybook(symptom, phaseName) {
  var key = String(symptom || '').toLowerCase();
  var map = {
    cramps: { now:'heat on the low belly + slow breathing', today:'magnesium, ginger tea, and a lighter schedule' },
    bloating: { now:'warm peppermint or fennel tea', today:'gentle walk, minerals, and less salty packaged food' },
    headache: { now:'water + electrolytes, dim light if possible', today:'magnesium, protein, and screen breaks' },
    cravings: { now:'add protein/fat before sweets', today:'complex carbs and dark chocolate without guilt' },
    'pms mood swings': { now:'pause before responding', today:'magnesium + B6 foods and an earlier bedtime' },
    'anxiety/irritability': { now:'long exhale breathing for 2 minutes', today:'reduce caffeine and protect quiet time' },
    'lower back pain': { now:'heat + gentle pelvic tilts', today:'magnesium and a slow walk' },
    'breast tenderness': { now:'supportive bra + reduce pressure', today:'hydration and easing caffeine may help' },
    'ovulation pain/mittelschmerz': { now:'warm compress and soften your schedule', today:'note the side/date; this can refine ovulation timing' },
    diarrhea: { now:'electrolytes and bland warm foods', today:'avoid raw/cold foods until settled' },
    constipated: { now:'water + gentle movement', today:'fiber, magnesium, and warm meals' }
  };
  return map[key] || { now:'pause and listen to the signal', today:'nourish, hydrate, and notice if it repeats in ' + phaseName };
}

function renderRitualBlock(phase, cycleDay) {
  var cycleLen = appState.profile.cycle_len || 28;
  var ritualType = 'opening';
  var isClosing = cycleDay >= cycleLen - 2;
  var isOvulation = cycleDay === 15;

  // Check if ovulation symptoms logged
  var log = getTodayLog();
  var ovSyms = ['ovulation pain/mittelschmerz','increased libido','egg white cervical mucus (ewcm)'];
  var hasOvSym = log.symptoms && log.symptoms.some(function(s) {
    return ovSyms.some(function(os) { return s.toLowerCase().indexOf(os.split('/')[0]) > -1; });
  });

  if (isClosing) ritualType = 'closing';
  else if (isOvulation || hasOvSym) ritualType = 'ovulation';

  var ritualData = getRitualContent(ritualType, phase, cycleDay);
  var savedRitual = appState.ritualLogs[todayStr()] || {};

  var html = '<div class="ritual-card" id="ritual-card">';
  html += '<div class="ritual-title">' + ritualData.title + '</div>';
  html += '<div class="ritual-subtitle">' + ritualData.subtitle + '</div>';

  ritualData.prompts.forEach(function(p, i) {
    html += '<div class="ritual-prompt">' + p + '</div>';
    var savedVal = savedRitual['q' + i] || '';
    html += '<textarea class="ritual-input" id="ritual-q' + i + '" rows="2" placeholder="your response..." onchange="saveRitualResponse(' + i + ')">' + savedVal + '</textarea>';
  });

  html += '</div>';
  return html;
}

function getRitualContent(type, phase, cycleDay) {
  var openingPrompts = [
    ['🌬️ take 3 deep breaths. how does your body feel today — physically, emotionally, energetically?',
     '🌙 what intention will you carry through this day?',
     '🔮 ' + phase.arch_sub],
    ['🌬️ breathe in for 4 counts, hold for 4, release for 4. what are you letting go of today?',
     '✨ what is your body asking for right now?',
     '🌿 ' + phase.season + ' — what does this season call you to honor?'],
    ['🌬️ place your hands on your belly. breathe. what do you notice?',
     '🌹 name one thing you are grateful for in your body today.',
     '💫 ' + phase.arch_sub],
    ['🌬️ three slow breaths. on each exhale, release one tension. what did you release?',
     '🍵 how will you nourish yourself today?',
     '🌙 what does your cycle want you to know right now?']
  ];

  if (type === 'ovulation') {
    return {
      title: '✨ ovulation ritual',
      subtitle: 'your peak energy ceremony',
      prompts: [
        '🌹 body check-in: how does your body feel at its peak? what sensations are alive in you right now?',
        '🎨 what creative vision or idea is most alive and wanting to be expressed?',
        '💫 set an intimacy or connection intention — with yourself, your work, or someone you love.',
        '⚡ what bold action will you take today to match your peak energy?'
      ]
    };
  }

  if (type === 'closing') {
    return {
      title: '🌑 closing ritual',
      subtitle: 'completing this cycle with grace',
      prompts: [
        '📖 reflect on this cycle — what was your highest moment? your hardest?',
        '🌊 what are you releasing as this cycle closes? name it so you can let it go.',
        '🌱 what intention do you want to carry into the next cycle?',
        '🙏 one thing you are proud of yourself for this cycle:'
      ]
    };
  }

  // Opening ritual — rotate
  var idx = cycleDay % openingPrompts.length;
  return {
    title: '🌙 opening ritual',
    subtitle: 'breathwork + body check-in',
    prompts: openingPrompts[idx]
  };
}

function renderCalendarBlock() {
  var html = '<div class="card" id="cal-card">';
  html += '<div class="card-body" style="padding:14px 12px;">';
  html += '<div class="cal-header">';
  html += '<button class="cal-nav" onclick="calPrev()">&#8249;</button>';
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  html += '<div class="cal-month">' + months[calendarViewDate.getMonth()] + ' ' + calendarViewDate.getFullYear() + '</div>';
  html += '<button class="cal-nav" onclick="calNext()">&#8250;</button>';
  html += '</div>';
  html += '<div class="cal-grid">';
  var days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  days.forEach(function(d) { html += '<div class="cal-dow">' + d + '</div>'; });

  var yr = calendarViewDate.getFullYear();
  var mo = calendarViewDate.getMonth();
  var first = new Date(yr, mo, 1);
  var last  = new Date(yr, mo+1, 0);
  var startDow = first.getDay();
  var todayDate = new Date(); todayDate.setHours(0,0,0,0);
  var todayTime = todayDate.getTime();
  var cycleLen = appState.profile.cycle_len || 28;

  var periodStarts = [];
  var sortedStarts = [];
  var avgCycleLen = cycleLen;
  if (appState.cycleStarts && appState.cycleStarts.length) {
    sortedStarts = appState.cycleStarts.map(function(s){ return s.start_date; }).sort();
    appState.cycleStarts.forEach(function(s) {
      if (s.start_date) periodStarts.push(new Date(s.start_date + 'T00:00:00'));
    });
    // Compute average cycle length from history
    var lens = [];
    for (var si=1; si<sortedStarts.length; si++) {
      var dl = Math.round((new Date(sortedStarts[si]+'T00:00:00') - new Date(sortedStarts[si-1]+'T00:00:00')) / 86400000);
      if (dl>15&&dl<65) lens.push(dl);
    }
    if (lens.length) avgCycleLen = Math.round(lens.reduce(function(a,b){return a+b;},0)/lens.length);
  }

  for (var i = 0; i < startDow; i++) {
    var pd = new Date(yr, mo, i - startDow + 1);
    html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:clamp(.7rem,2.7vw,.8rem);color:var(--text3);opacity:.3;">' + pd.getDate() + '</div>';
  }

  for (var d = 1; d <= last.getDate(); d++) {
    var thisDate = new Date(yr, mo, d);
    var thisTime = thisDate.getTime();
    var dateStr = dateToString(thisDate);
    var isToday = thisTime === todayTime;
    var isPeriod = false;
    var isFertile = false;
    var isOvulation = false;

    periodStarts.forEach(function(pstart) {
      var diff = Math.floor((thisTime - pstart.getTime()) / 86400000);
      if (diff >= 0 && diff < (appState.profile.period_len || 5)) isPeriod = true;
      var ovDay = Math.round(cycleLen * 0.5);
      if (diff >= (ovDay - 6) && diff < ovDay) isFertile = true;
      if (diff === ovDay) isOvulation = true;
    });

    // Mark predicted next period (from most recent cycle start)
    var isPredicted = false;
    if (sortedStarts && sortedStarts.length) {
      var lastS = sortedStarts[sortedStarts.length-1];
      var predictedNext = new Date(lastS + 'T00:00:00');
      predictedNext.setDate(predictedNext.getDate() + avgCycleLen);
      var predictedEnd = new Date(predictedNext); predictedEnd.setDate(predictedEnd.getDate() + (appState.profile.period_len || 5) - 1);
      if (thisTime >= predictedNext.getTime() && thisTime <= predictedEnd.getTime()) {
        // Only show prediction if not already logged as a period
        if (!isPeriod) isPredicted = true;
      }
    }

    var dl = appState.dayLogs && appState.dayLogs[dateStr];
    var isIntimate = dl && dl.intimate;
    var loggedFlow = dl && dl.flow;
    var isLoggedBleeding = ['spotting','light','medium','heavy'].indexOf(loggedFlow) > -1;
    var isCycleStart = appState.cycleStarts && appState.cycleStarts.some(function(s){ return s.start_date === dateStr; });
    if (isLoggedBleeding) isPeriod = true;

    var cellStyle = 'aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:clamp(.7rem,2.7vw,.8rem);border-radius:50%;position:relative;cursor:pointer;';

    if (isPredicted && isToday) {
      cellStyle += 'background:rgba(176,90,82,.10);box-shadow:0 0 0 2px rgba(176,90,82,.4);font-weight:600;';
    } else if (isPredicted) {
      cellStyle += 'background:rgba(176,90,82,.08);box-shadow:0 0 0 1.5px rgba(176,90,82,.25);';
    }
    if (isPeriod && isToday) {
      cellStyle += 'background:rgba(176,90,82,.28);box-shadow:0 0 0 2.5px #7a3a34;font-weight:600;';
    } else if (isPeriod) {
      cellStyle += 'background:rgba(176,90,82,.25);';
    } else if (isOvulation && isToday) {
      cellStyle += 'box-shadow:0 0 0 2.5px #c89a3a, 0 0 0 4.5px rgba(200,154,58,.25);font-weight:600;';
    } else if (isOvulation) {
      cellStyle += 'box-shadow:0 0 0 2px #c89a3a;';
    } else if (isFertile && isToday) {
      cellStyle += 'background:rgba(90,138,106,.2);box-shadow:0 0 0 2.5px #5a6a50;font-weight:600;';
    } else if (isFertile) {
      cellStyle += 'background:rgba(90,138,106,.18);';
    } else if (isToday) {
      cellStyle += 'box-shadow:0 0 0 2.5px var(--text2);font-weight:600;';
    }
    if (calendarEditDate === dateStr) {
      cellStyle += 'outline:2px solid var(--brand);outline-offset:2px;';
    }

    html += '<div style="' + cellStyle + '" onclick="selectCalendarDay(\'' + dateStr + '\')" title="edit ' + dateStr + '">';
    html += '<span>' + d + '</span>';
    if (isCycleStart) {
      html += '<span style="position:absolute;top:0;right:1px;font-size:.46rem;color:var(--brand);line-height:1;">●</span>';
    }
    if (isLoggedBleeding) {
      html += '<span style="position:absolute;bottom:1px;left:1px;font-size:.42rem;color:#b05a52;line-height:1;">' + (loggedFlow === 'spotting' ? 's' : loggedFlow.charAt(0)) + '</span>';
    }
    if (isIntimate) {
      html += '<span style="position:absolute;bottom:1px;right:1px;font-size:.42rem;color:#c05a52;line-height:1;">&#9829;</span>';
    }
    html += '</div>';
  }

  html += '</div>';
  html += '<div style="display:flex;gap:clamp(8px,3vw,14px);flex-wrap:wrap;margin-top:12px;align-items:center;">';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,2.5vw,.72rem);color:var(--text2);"><div style="width:11px;height:11px;border-radius:50%;background:rgba(176,90,82,.3);flex-shrink:0;"></div>Period</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,2.5vw,.72rem);color:var(--text2);"><div style="width:11px;height:11px;border-radius:50%;background:rgba(90,138,106,.25);flex-shrink:0;"></div>Fertile</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,2.5vw,.72rem);color:var(--text2);"><div style="width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 2px #c89a3a;flex-shrink:0;"></div>Ovulation</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,2.5vw,.72rem);color:var(--text2);"><span style="color:#c05a52;font-size:.9rem;">&#9829;</span>Intimate</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,2.5vw,.72rem);color:var(--text2);"><div style="width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(176,90,82,.4);background:rgba(176,90,82,.1);flex-shrink:0;"></div>Predicted</div>';
  html += '</div>';
  html += renderCalendarDayEditor();
  html += '</div></div>';
  return html;
}

function calPrev() {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth()-1, 1);
  reRenderBlock('calendar');
}

function calNext() {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth()+1, 1);
  reRenderBlock('calendar');
}

function selectCalendarDay(dateStr) {
  haptic('light');
  calendarEditDate = calendarEditDate === dateStr ? null : dateStr;
  reRenderBlock('calendar');
}

function renderCalendarDayEditor() {
  if (!calendarEditDate) {
    return '<div class="insight-mini-meta" style="margin-top:12px;">Tap any calendar day to edit bleeding, flow, or period start.</div>';
  }
  var log = (appState.dayLogs && appState.dayLogs[calendarEditDate]) || createEmptyDayLog(calendarEditDate);
  var isFuture = calendarEditDate > todayStr();
  var isStart = appState.cycleStarts && appState.cycleStarts.some(function(s) { return s.start_date === calendarEditDate; });
  var html = '<div class="insight-mini-card" style="margin-top:12px;margin-bottom:0;">';
  html += '<div class="insight-mini-kicker">edit period day</div>';
  html += '<div class="insight-mini-title">' + formatCycleRangeDate(calendarEditDate) + '</div>';
  html += '<div class="insight-mini-body">' + (isFuture ? 'Future days cannot be logged as bleeding yet.' : 'Set the flow for this date, or make it the start of a new period.') + '</div>';
  if (!isFuture) {
    html += '<div class="flow-opts" style="margin-top:10px;">';
    ['spotting','light','medium','heavy'].forEach(function(flow) {
      html += '<div class="flow-opt' + (log.flow===flow?' selected':'') + '" onclick="setCalendarFlow(\'' + calendarEditDate + '\',\'' + flow + '\')">' + flow + '</div>';
    });
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:11px;">';
    html += '<button class="btn-sm" onclick="' + (isStart ? 'removeCalendarPeriodStart' : 'setCalendarPeriodStart') + '(\'' + calendarEditDate + '\')" style="padding:8px 11px;font-size:.68rem;">' + (isStart ? 'remove period start' : 'set as period start') + '</button>';
    html += '<button class="btn-sm" onclick="clearCalendarBleeding(\'' + calendarEditDate + '\')" style="padding:8px 11px;font-size:.68rem;background:transparent;color:var(--text3);border:1px solid var(--bg2);">clear bleeding</button>';
    html += '<button class="btn-sm" onclick="openCalendarDayLog(\'' + calendarEditDate + '\')" style="padding:8px 11px;font-size:.68rem;background:#8a6a9a;">open full log</button>';
    html += '</div>';
    html += '<div class="insight-mini-meta">Tip: setting a period start near an existing one will move that start date instead of creating a duplicate.</div>';
  }
  html += '</div>';
  return html;
}

function saveCalendarPeriodEdits() {
  lsSet('dayData', appState.dayLogs);
  lsSet('pastCycles', appState.cycleStarts);
  showSync('saved');
  updatePhaseDisplay();
  renderAllTabs();
}

function setCalendarFlow(dateStr, flow) {
  if (dateStr > todayStr()) return;
  var log = logGetLog(dateStr);
  log.flow = log.flow === flow ? '' : flow;
  if (appState.dayLogs && appState.dayLogs[dateStr] && !hasRecordedDayLog(appState.dayLogs[dateStr])) {
    delete appState.dayLogs[dateStr];
  }
  saveCalendarPeriodEdits();
}

function setCalendarPeriodStart(dateStr) {
  if (dateStr > todayStr()) return;
  if (!appState.cycleStarts) appState.cycleStarts = [];
  var targetTime = new Date(dateStr + 'T00:00:00').getTime();
  appState.cycleStarts = appState.cycleStarts.filter(function(s) {
    if (!s.start_date) return false;
    var diff = Math.abs((new Date(s.start_date + 'T00:00:00').getTime() - targetTime) / 86400000);
    return diff > 10;
  });
  appState.cycleStarts.push({ user_id: 'local', start_date: dateStr, is_current: true });
  var log = logGetLog(dateStr);
  if (!log.flow) log.flow = 'medium';
  saveCalendarPeriodEdits();
}

function removeCalendarPeriodStart(dateStr) {
  appState.cycleStarts = (appState.cycleStarts || []).filter(function(s) { return s.start_date !== dateStr; });
  saveCalendarPeriodEdits();
}

function clearCalendarBleeding(dateStr) {
  if (appState.dayLogs && appState.dayLogs[dateStr]) {
    appState.dayLogs[dateStr].flow = '';
    if (!hasRecordedDayLog(appState.dayLogs[dateStr])) delete appState.dayLogs[dateStr];
  }
  appState.cycleStarts = (appState.cycleStarts || []).filter(function(s) { return s.start_date !== dateStr; });
  saveCalendarPeriodEdits();
}

function openCalendarDayLog(dateStr) {
  logViewDate = dateStr;
  switchTab('log');
}

function reRenderBlock(blockId) {
  var el = document.getElementById('block-' + blockId);
  if (!el) return;
  var log = getTodayLog();
  var cycleDay = getCycleDay();
  var phase = getPhase(cycleDay, appState.profile.cycle_len);
  el.innerHTML = renderBlock(blockId, log, phase, cycleDay);
  attachTodayEvents(log, phase);
}

function renderIntimacyBlock(log) {
  var heart = log.intimate ? '♥' : '♡';
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">intimacy</span></div>';
  html += '<div class="card-body" style="display:flex;align-items:center;gap:12px;">';
  html += '<button class="heart-btn" id="heart-btn" onclick="toggleIntimacy()" style="color:#c05a52;">' + heart + '</button>';
  html += '<span style="font-size:.82rem;color:var(--text3);">' + (log.intimate ? 'logged for today' : 'tap to log') + '</span>';
  html += '</div></div>';
  return html;
}

function renderMoodBlock(log) {
  var emojis = getMoodEmojis();
  var words = getMoodWords();
  var selectedEmojis = log.mood_emoji || [];
  var selectedWords = log.mood_words || [];

  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">mood</span></div>';
  html += '<div class="card-body">';
  html += '<div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:10px;">';
  emojis.forEach(function(e) {
    var sel = selectedEmojis.indexOf(e.emoji) > -1;
    html += '<span class="chip chip-sm' + (sel?' selected':'') + '" onclick="toggleMoodEmoji(\'' + e.emoji.replace(/'/g,"\\'") + '\')">' + e.emoji + ' ' + e.label + '</span>';
  });
  html += '</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:0;">';
  words.forEach(function(w) {
    var sel = selectedWords.indexOf(w) > -1;
    html += '<span class="chip chip-sm' + (sel?' selected':'') + '" onclick="toggleMoodWord(\'' + w.replace(/'/g,"\\'") + '\')">' + w + '</span>';
  });
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderFlowBlock(log) {
  var opts = ['spotting','light','medium','heavy'];
  if (isPregnancyMode()) {
    var htmlP = '<div class="card">';
    htmlP += '<div class="card-header"><span class="card-title">bleeding / spotting</span></div>';
    htmlP += '<div class="card-body">';
    htmlP += '<div class="flow-opts">';
    opts.forEach(function(o) {
      htmlP += '<div class="flow-opt' + (log.flow===o?' selected':'') + '" onclick="setFlow(\'' + o + '\')">' + o + '</div>';
    });
    htmlP += '</div><div class="fertility-note">If bleeding is heavy, painful, or concerning during pregnancy, contact your provider promptly.</div></div></div>';
    return htmlP;
  }
  // Check if today is already logged as a cycle start
  var today = todayStr();
  var alreadyLogged = appState.cycleStarts.some(function(s){ return s.start_date === today; });
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">flow</span></div>';
  html += '<div class="card-body">';
  // Period start button
  html += '<button onclick="logPeriodStartToday()" style="width:100%;padding:10px 14px;margin-bottom:12px;border-radius:var(--radius-sm);border:1.5px solid ' + (alreadyLogged ? 'var(--brand)' : 'var(--bg2)') + ';background:' + (alreadyLogged ? 'rgba(176,90,82,0.08)' : 'transparent') + ';color:' + (alreadyLogged ? 'var(--brand)' : 'var(--text2)') + ';font-family:Jost,sans-serif;font-size:clamp(.78rem,3vw,.84rem);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">';
  html += '<span style="font-size:1rem;">🩸</span>';
  html += '<span>' + (alreadyLogged ? '\u2713 period started today  ·  tap to undo' : 'my period started today') + '</span>';
  html += '</button>';
  html += '<div class="flow-opts">';
  opts.forEach(function(o) {
    html += '<div class="flow-opt' + (log.flow===o?' selected':'') + '" onclick="setFlow(\'' + o + '\')">' + o + '</div>';
  });
  html += '</div></div></div>';
  return html;
}

function renderFertilityBlock(log) {
  if (isPregnancyMode()) return '';
  if (appState.profile.fertility_tracking === false) return '';
  var fertility = getFertility(log);
  var mucusOpts = [
    { value:'dry', label:'dry' },
    { value:'sticky', label:'sticky' },
    { value:'creamy', label:'creamy' },
    { value:'watery', label:'watery' },
    { value:'egg white', label:'egg white' }
  ];
  var lhOpts = [
    { value:'negative', label:'LH -' },
    { value:'high', label:'LH high' },
    { value:'peak', label:'LH peak' }
  ];
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">fertility signs</span><span style="font-size:.72rem;color:var(--text3);">optional</span></div>';
  html += '<div class="card-body">';
  html += '<div class="symp-section-label">cervical mucus</div><div class="fertility-opts">';
  mucusOpts.forEach(function(o) {
    html += '<span class="fertility-opt' + (fertility.mucus===o.value?' selected':'') + '" onclick="setFertilitySign(\'mucus\',\'' + o.value + '\')">' + o.label + '</span>';
  });
  html += '</div>';
  html += '<div class="symp-section-label" style="margin-top:11px;">LH test</div><div class="fertility-opts">';
  lhOpts.forEach(function(o) {
    html += '<span class="fertility-opt' + (fertility.lh===o.value?' selected':'') + '" onclick="setFertilitySign(\'lh\',\'' + o.value + '\')">' + o.label + '</span>';
  });
  html += '</div>';
  html += '<div class="fertility-row">';
  html += '<label class="fertility-bbt-label">BBT <input class="fertility-bbt-input" inputmode="decimal" type="number" step="0.01" min="95" max="100" value="' + (fertility.bbt || '') + '" placeholder="97.45" onchange="setFertilityBBT(this.value)"></label>';
  html += '<button class="fertility-pain-btn' + (fertility.ovulation_pain ? ' selected' : '') + '" onclick="toggleFertilityPain()">ovulation pain</button>';
  html += '</div>';
  html += '<div class="fertility-note">These signs can refine timing, but this app is not contraception.</div>';
  html += '</div></div>';
  return html;
}

function renderFluidsBlock(log) {
  var water = log.water || 0;
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">water</span><span style="font-size:.78rem;color:var(--text3);">' + water + '/8</span></div>';
  html += '<div class="card-body"><div class="water-btns">';
  for (var i = 1; i <= 8; i++) {
    html += '<span class="water-drop' + (i<=water?' filled':'') + '" onclick="setWater(' + i + ')">💧</span>';
  }
  html += '</div></div></div>';
  return html;
}

function renderSleepBlock(log) {
  var opts = ['poor','okay','good','great','amazing'];
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">sleep</span></div>';
  html += '<div class="card-body"><div class="sleep-opts">';
  opts.forEach(function(o) {
    html += '<div class="sleep-opt' + (log.sleep===o?' selected':'') + '" onclick="setSleep(\'' + o + '\')">' + o + '</div>';
  });
  html += '</div></div></div>';
  return html;
}

function renderSymptomsBlock(log) {
  var syms = getSymptoms();
  var selected = log.symptoms || [];
  var details = getSymptomDetails(log);
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">symptoms</span></div>';
  html += '<div class="card-body">';

  ['general','menstrual','follicular','ovulatory','luteal'].forEach(function(sec) {
    html += '<div class="symp-section">';
    var label = sec === 'luteal' ? 'luteal / pms' : sec;
    html += '<div class="symp-section-label">' + label + '</div>';
    html += '<div class="symp-chips">';
    syms[sec].forEach(function(s) {
      var sel = selected.indexOf(s.name) > -1;
      html += '<span class="chip chip-sm' + (sel?' selected':'') + '" onclick="toggleSymptom(\'' + s.name.replace(/'/g,"\\'") + '\')">' + s.emoji + ' ' + s.name + '</span>';
    });
    html += '</div></div>';
  });

  if (selected.length) {
    html += '<div style="margin-top:12px;"><span class="section-label">symptom details</span>';
    selected.forEach(function(name) {
      var detail = details[name] || {};
      var safeName = name.replace(/'/g,"\\'");
      html += '<div class="flag-row" style="margin-bottom:8px;">';
      html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text);margin-bottom:7px;">' + escapeHabitText(name) + '</div>';
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;">';
      ['mild','medium','intense'].forEach(function(level) {
        html += '<button onclick="setSymptomDetail(\'' + safeName + '\',\'severity\',\'' + level + '\')" style="border:1px solid ' + (detail.severity===level?'var(--brand)':'var(--bg2)') + ';background:' + (detail.severity===level?'var(--brand)':'transparent') + ';color:' + (detail.severity===level?'#fff':'var(--text3)') + ';border-radius:20px;padding:5px 9px;font-size:.66rem;font-family:Jost,sans-serif;cursor:pointer;">' + level + '</button>';
      });
      html += '</div><div style="display:flex;gap:5px;flex-wrap:wrap;">';
      ['part of day','all day','comes and goes'].forEach(function(duration) {
        html += '<button onclick="setSymptomDetail(\'' + safeName + '\',\'duration\',\'' + duration + '\')" style="border:1px solid ' + (detail.duration===duration?'var(--brand)':'var(--bg2)') + ';background:' + (detail.duration===duration?'var(--brand)':'transparent') + ';color:' + (detail.duration===duration?'#fff':'var(--text3)') + ';border-radius:20px;padding:5px 9px;font-size:.66rem;font-family:Jost,sans-serif;cursor:pointer;">' + duration + '</button>';
      });
      html += '</div></div>';
    });
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function renderTasksBlock(log, phase) {
  var tasks = log.tasks || [];
  tasks.forEach(normalizeTask);
  var phaseSuggestions = getTaskSet()[phase.name] || [];
  if (appState.customSettings && appState.customSettings.custom_tasks) {
    try {
      var ct = appState.customSettings.custom_tasks;
      var ctObj = typeof ct === 'string' ? JSON.parse(ct) : ct;
      if (ctObj && ctObj[phase.name] && ctObj[phase.name].length > 0) {
        phaseSuggestions = ctObj[phase.name];
      }
    } catch(e) {}
  }

  var doneCt = tasks.filter(function(t) { return t.done; }).length;
  var budget = getEnergyBudget(log, phase);
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">today\'s focus</span><span style="font-size:.78rem;color:var(--text3);">' + doneCt + '/' + tasks.length + '</span></div>';
  html += '<div class="card-body">';
  html += renderEnergyBudgetCard(log, phase, budget);
  html += renderTaskLoadWarning(tasks, phase, budget);

  tasks.forEach(function(t, i) {
    html += '<div class="task-item">';
    html += '<div class="task-check' + (t.done?' done':'') + '" onclick="toggleTask(' + i + ')">' + (t.done?'✓':'') + '</div>';
    html += '<span class="task-text' + (t.done?' done':'') + '">' + escapeHabitText(t.text) + (t.rolledOver ? ' <span style="font-size:.6rem;color:var(--text3);">&#8629;</span>' : '') + '<br><span style="font-size:.62rem;color:var(--text3);">' + getTaskEnergyLabel(t.energy) + (isTaskGoodFit(t, phase, budget) ? ' · good fit today' : ' · consider later') + '</span></span>';
    html += '<select data-i="'+i+'" onchange="setTaskEnergy(this.dataset.i,this.value)" style="border:1px solid var(--bg2);border-radius:18px;padding:5px 7px;background:var(--bg);color:var(--text3);font-size:.66rem;max-width:88px;">' + getTaskEnergyOptions(t.energy) + '</select>';
    html += '<button class="task-del" onclick="deleteTask(' + i + ')">✕</button>';
    html += '</div>';
    if (t.rolledOver && !t.done) {
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:-4px 0 9px 46px;">';
      html += '<button class="btn-sm" onclick="keepRolledTask(' + i + ')" style="padding:5px 9px;font-size:.66rem;">keep</button>';
      html += '<button class="btn-sm" onclick="softenTask(' + i + ')" style="padding:5px 9px;font-size:.66rem;background:#8a6a9a;">soften</button>';
      html += '<button class="btn-sm" onclick="saveTaskForLater(' + i + ')" style="padding:5px 9px;font-size:.66rem;background:#5a8a6a;">later</button>';
      html += '<button class="btn-sm" onclick="releaseTask(' + i + ')" style="padding:5px 9px;font-size:.66rem;background:var(--text3);">release</button>';
      html += '</div>';
    }
  });

  html += '<div class="task-add">';
  html += '<input class="task-input" id="task-input" type="text" placeholder="add a task...">';
  html += '<select id="task-energy-input" style="border:1px solid var(--bg2);border-radius:var(--radius-sm);padding:0 8px;background:var(--bg);color:var(--text3);font-size:.7rem;max-width:96px;">' + getTaskEnergyOptions('low') + '</select>';
  html += '<button class="btn-add" onclick="addTask()">+</button>';
  html += '</div>';

  if (phaseSuggestions.length) {
    html += renderMinimumViableTasks(phase, budget);
    html += '<div style="margin-top:10px;"><span class="section-label">best fit today</span>';
    html += '<div style="display:flex;flex-wrap:wrap;">';
    phaseSuggestions.slice(0,8).forEach(function(s) {
      html += '<span class="chip chip-sm" onclick="addTaskFromSuggestion(\'' + s.replace(/'/g,"\\'") + '\')" style="margin:2px;">+ ' + escapeHabitText(s) + '</span>';
    });
    html += '</div></div>';
  }

  html += renderSavedTasksForPhase(phase.name);

  html += '</div></div>';
  return html;
}

function renderTasksTab() {
  var pane = document.getElementById('tasks-pane');
  if (!pane) return;
  var log = getTodayLog();
  var cycleDay = getCycleDay();
  var phase = getPhase(cycleDay, appState.profile.cycle_len || 28);
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">cycle-aligned work</div>';
  html += '<div class="insight-mini-title">today + this week</div>';
  html += '<div class="insight-mini-body">Keep daily tasks and weekly planning here so Today can stay focused on body check-in.</div>';
  html += '</div>';
  html += renderTasksBlock(log, phase);
  html += renderWeekPlanCard();
  html += renderTaskCompletionInsightsCard();
  pane.innerHTML = html;
}

function refreshTasksUI() {
  var taskBlock = document.getElementById('block-tasks');
  if (taskBlock) reRenderBlock('tasks');
  renderTasksTab();
}

function normalizeTask(task) {
  if (!task) return task;
  if (!task.energy) task.energy = inferTaskEnergy(task.text);
  return task;
}

function inferTaskEnergy(text) {
  text = String(text || '').toLowerCase();
  if (/call|meeting|pitch|film|live|present|conversation|social|network|record/.test(text)) return 'social';
  if (/write|draft|deep|strategy|learn|focus|proposal|create|brainstorm/.test(text)) return 'deep';
  if (/clean|organize|admin|email|reply|review|schedule|file|budget/.test(text)) return 'admin';
  if (/walk|rest|meal|water|bath|sleep|stretch|body|care|gentle/.test(text)) return 'body';
  return 'low';
}

function getTaskEnergyLabel(energy) {
  var labels = { low:'low energy', deep:'deep work', social:'social', admin:'admin', creative:'creative', body:'body care', home:'home' };
  return labels[energy || 'low'] || 'low energy';
}

function getTaskEnergyOptions(selected) {
  var opts = [
    ['low','low'], ['deep','deep'], ['social','social'], ['admin','admin'], ['creative','creative'], ['body','body'], ['home','home']
  ];
  return opts.map(function(o) { return '<option value="'+o[0]+'"'+((selected||'low')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('');
}

function getEnergyBudget(log, phase) {
  var score = 2;
  if (phase.name === 'follicular' || phase.name === 'ovulatory') score++;
  if (phase.name === 'menstrual') score--;
  if (phase.name === 'luteal' && getCycleDay() >= (appState.profile.cycle_len || 28) - 4) score--;
  if (log.sleep === 'poor') score--;
  if (log.sleep === 'great' || log.sleep === 'amazing') score++;
  if (log.flow === 'heavy') score--;
  var syms = []; try { syms = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : (log.symptoms || []); } catch(e) {}
  if (syms.length >= 3) score--;
  if (isPregnancyMode()) score = Math.min(score, 2);
  var level = score <= 1 ? 'low' : score >= 3 ? 'high' : 'medium';
  var copy = {
    low: 'minimum viable day: protect energy and choose tiny, essential tasks.',
    medium: 'steady capacity: choose a realistic mix of care, admin, and one priority.',
    high: 'higher capacity: a good day for deeper, social, or creative work.'
  };
  return { level: level, score: score, copy: copy[level] };
}

function renderEnergyBudgetCard(log, phase, budget) {
  return '<div class="insight-mini-card" style="margin-bottom:12px;"><div class="insight-mini-kicker">energy budget</div><div class="insight-mini-title">' + budget.level + ' capacity</div><div class="insight-mini-body">' + budget.copy + '</div><div class="insight-mini-meta">' + phase.name + (log.sleep ? ' · sleep: ' + log.sleep : '') + (log.flow ? ' · flow: ' + log.flow : '') + '</div></div>';
}

function isTaskGoodFit(task, phase, budget) {
  var energy = task.energy || 'low';
  if (budget.level === 'low') return ['low','body','admin'].indexOf(energy) > -1;
  if (phase.name === 'menstrual') return ['low','body','admin'].indexOf(energy) > -1;
  if (phase.name === 'follicular') return ['creative','deep','admin','home','low'].indexOf(energy) > -1;
  if (phase.name === 'ovulatory') return ['social','creative','deep','low'].indexOf(energy) > -1;
  if (phase.name === 'luteal') return ['admin','home','body','low'].indexOf(energy) > -1;
  return true;
}

function renderTaskLoadWarning(tasks, phase, budget) {
  var open = tasks.filter(function(t) { return !t.done; }).length;
  if (budget.level !== 'low' && !(phase.name === 'luteal' && open >= 6)) return '';
  if (open < 4) return '';
  return '<div class="flag-row" style="margin-bottom:10px;">load check: ' + open + ' open tasks may be a lot for ' + phase.name + '. Keep the essentials, soften one, or save one for later.</div>';
}

function renderMinimumViableTasks(phase, budget) {
  if (budget.level !== 'low' && phase.name !== 'menstrual') return '';
  var suggestions = isPregnancyMode()
    ? ['hydrate', 'eat something nourishing', 'write one provider question']
    : ['choose one essential task', 'drink water', 'rest without guilt'];
  var html = '<div style="margin-top:10px;"><span class="section-label">minimum viable day</span><div style="display:flex;flex-wrap:wrap;">';
  suggestions.forEach(function(s) {
    html += '<span class="chip chip-sm" onclick="addTaskFromSuggestion(\'' + s.replace(/'/g,"\\'") + '\')" style="margin:2px;">+ ' + s + '</span>';
  });
  html += '</div></div>';
  return html;
}

function renderNoteBlock(log) {
  var html = '<div class="card">';
  html += '<div class="card-header"><span class="card-title">daily note</span></div>';
  html += '<div class="card-body">';
  html += '<textarea class="note-area" id="daily-note" placeholder="how are you feeling today? anything to capture..." rows="4" oninput="debounceSaveNote()">' + (log.note||'') + '</textarea>';
  html += '</div></div>';
  return html;
}

function attachTodayEvents(log, phase) {
  // Nothing extra needed — all handled via onclick in HTML
}

function flushPendingTextInputs() {
  var dailyNote = document.getElementById('daily-note');
  if (dailyNote) {
    var todayLog = getTodayLog();
    todayLog.note = dailyNote.value;
  }

  var logNote = document.getElementById('log-note-area');
  if (logNote && logNote.dataset && logNote.dataset.d) {
    var viewedLog = logGetLog(logNote.dataset.d);
    viewedLog.note = logNote.value;
    if (!hasRecordedDayLog(viewedLog)) delete appState.dayLogs[logNote.dataset.d];
  }

  document.querySelectorAll('.ritual-input').forEach(function(el) {
    var match = el.id && el.id.match(/^ritual-q(\d+)$/);
    if (!match) return;
    var today = todayStr();
    if (!appState.ritualLogs[today]) appState.ritualLogs[today] = {};
    appState.ritualLogs[today]['q' + match[1]] = el.value;
  });

  lsSet('dayData', appState.dayLogs);
  lsSet('rituals', appState.ritualLogs);
}

// ═══════════════════════════════════════════
// TODAY INTERACTIONS
// ═══════════════════════════════════════════
function toggleIntimacy() {
  haptic('medium');
  var log = getTodayLog();
  log.intimate = !log.intimate;
  saveTodayLog();
  reRenderBlock('intimacy');
}

function toggleMoodEmoji(emoji) {
  haptic('light');
  var log = getTodayLog();
  if (!log.mood_emoji) log.mood_emoji = [];
  var idx = log.mood_emoji.indexOf(emoji);
  if (idx > -1) log.mood_emoji.splice(idx,1); else log.mood_emoji.push(emoji);
  saveTodayLog();
  reRenderBlock('mood');
}

function toggleMoodWord(word) {
  var log = getTodayLog();
  if (!log.mood_words) log.mood_words = [];
  var idx = log.mood_words.indexOf(word);
  if (idx > -1) log.mood_words.splice(idx,1); else log.mood_words.push(word);
  saveTodayLog();
  reRenderBlock('mood');
}

function setFlow(val) {
  haptic('light');
  var log = getTodayLog();
  log.flow = log.flow === val ? '' : val;
  saveTodayLog();
  reRenderBlock('flow');
}

function setFertilitySign(key, val) {
  haptic('light');
  var log = getTodayLog();
  var fertility = getFertility(log);
  fertility[key] = fertility[key] === val ? '' : val;
  saveTodayLog();
  reRenderBlock('fertility');
  renderInsights();
}

function setFertilityBBT(value) {
  var log = getTodayLog();
  var fertility = getFertility(log);
  fertility.bbt = value ? String(value) : '';
  saveTodayLog();
  renderInsights();
}

function toggleFertilityPain() {
  haptic('light');
  var log = getTodayLog();
  var fertility = getFertility(log);
  fertility.ovulation_pain = !fertility.ovulation_pain;
  saveTodayLog();
  reRenderBlock('fertility');
  renderInsights();
}

function setWater(n) {
  var log = getTodayLog();
  log.water = log.water === n ? n-1 : n;
  saveTodayLog();
  renderHabits();
}

function setSleep(val) {
  haptic('light');
  var log = getTodayLog();
  log.sleep = log.sleep === val ? '' : val;
  saveTodayLog();
  renderHabits();
}

function toggleSymptom(name) {
  var log = getTodayLog();
  if (!log.symptoms) log.symptoms = [];
  var idx = log.symptoms.indexOf(name);
  if (idx > -1) {
    log.symptoms.splice(idx,1);
    if (log.symptom_details) delete log.symptom_details[name];
  } else {
    log.symptoms.push(name);
    var details = getSymptomDetails(log);
    if (!details[name]) details[name] = { severity: '', duration: '' };
  }
  saveTodayLog();
  reRenderBlock('symptoms');
  reRenderBlock('relief');
  renderInsights();
}

function setSymptomDetail(name, key, value) {
  var log = getTodayLog();
  if (!log.symptoms) log.symptoms = [];
  if (log.symptoms.indexOf(name) === -1) log.symptoms.push(name);
  var details = getSymptomDetails(log);
  if (!details[name]) details[name] = { severity: '', duration: '' };
  details[name][key] = details[name][key] === value ? '' : value;
  saveTodayLog();
  reRenderBlock('symptoms');
  renderInsights();
}

function toggleTask(i) {
  haptic('medium');
  var log = getTodayLog();
  normalizeTask(log.tasks[i]);
  log.tasks[i].done = !log.tasks[i].done;
  saveTodayLog();
  refreshTasksUI();
}

function deleteTask(i) {
  var log = getTodayLog();
  log.tasks.splice(i,1);
  saveTodayLog();
  refreshTasksUI();
}

function setTaskEnergy(i, energy) {
  var log = getTodayLog();
  if (!log.tasks || !log.tasks[i]) return;
  normalizeTask(log.tasks[i]);
  log.tasks[i].energy = energy || 'low';
  saveTodayLog();
  refreshTasksUI();
}

function addTask() {
  var inp = document.getElementById('task-input');
  if (!inp || !inp.value.trim()) return;
  var energyEl = document.getElementById('task-energy-input');
  var log = getTodayLog();
  if (!log.tasks) log.tasks = [];
  var text = inp.value.trim().toLowerCase();
  log.tasks.push({ text: text, done: false, energy: energyEl ? energyEl.value : inferTaskEnergy(text) });
  saveTodayLog();
  refreshTasksUI();
}

function addTaskFromSuggestion(text) {
  var log = getTodayLog();
  if (!log.tasks) log.tasks = [];
  if (log.tasks.some(function(t) { return t.text === text; })) return;
  log.tasks.push({ text: text, done: false, energy: inferTaskEnergy(text), phaseFit: getPhase(getCycleDay(), appState.profile.cycle_len || 28).name });
  saveTodayLog();
  refreshTasksUI();
}

function keepRolledTask(i) {
  var log = getTodayLog();
  if (!log.tasks || !log.tasks[i]) return;
  log.tasks[i].rolledOver = false;
  saveTodayLog();
  refreshTasksUI();
}

function softenTask(i) {
  var log = getTodayLog();
  if (!log.tasks || !log.tasks[i]) return;
  normalizeTask(log.tasks[i]);
  log.tasks[i].text = 'soft version: ' + log.tasks[i].text.replace(/^soft version:\s*/,'');
  log.tasks[i].energy = 'low';
  log.tasks[i].rolledOver = false;
  saveTodayLog();
  refreshTasksUI();
}

function releaseTask(i) {
  deleteTask(i);
}

function getSavedTasks() {
  var cs = appState.customSettings || {};
  if (!cs.saved_tasks) return {};
  try { return typeof cs.saved_tasks === 'string' ? JSON.parse(cs.saved_tasks) : cs.saved_tasks; } catch(e) { return {}; }
}

function saveSavedTasks(saved) {
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.saved_tasks = saved || {};
  lsSet('customSettings', appState.customSettings);
  showSync('saved');
}

function saveSuggestionForLater(text, phaseName) {
  var saved = getSavedTasks();
  var phase = phaseName || getPhase(getCycleDay(), appState.profile.cycle_len || 28).name;
  if (!saved[phase]) saved[phase] = [];
  if (saved[phase].indexOf(text) === -1) saved[phase].push(text);
  saveSavedTasks(saved);
  refreshTasksUI();
}

function saveTaskForLater(i) {
  var log = getTodayLog();
  if (!log.tasks || !log.tasks[i]) return;
  var task = log.tasks[i];
  var phase = task.phaseFit || getPhase(getCycleDay(), appState.profile.cycle_len || 28).name;
  saveSuggestionForLater(task.text, phase);
  log.tasks.splice(i, 1);
  saveTodayLog();
  refreshTasksUI();
}

function addSavedTaskToToday(phaseName, index) {
  var saved = getSavedTasks();
  if (!saved[phaseName] || !saved[phaseName][index]) return;
  var text = saved[phaseName][index];
  addTaskFromSuggestion(text);
  saved[phaseName].splice(index, 1);
  saveSavedTasks(saved);
  refreshTasksUI();
}

function removeSavedTask(phaseName, index) {
  var saved = getSavedTasks();
  if (!saved[phaseName]) return;
  saved[phaseName].splice(index, 1);
  saveSavedTasks(saved);
  refreshTasksUI();
}

function renderSavedTasksForPhase(phaseName) {
  var saved = getSavedTasks();
  var items = saved[phaseName] || [];
  if (!items.length) return '';
  var html = '<div style="margin-top:12px;"><span class="section-label">saved for ' + phaseName + '</span><div style="display:flex;flex-wrap:wrap;">';
  items.forEach(function(item, i) {
    html += '<span class="chip chip-sm" onclick="addSavedTaskToToday(\'' + phaseName + '\',' + i + ')" style="margin:2px;">+ ' + escapeHabitText(item) + '</span>';
    html += '<span class="chip chip-sm" onclick="removeSavedTask(\'' + phaseName + '\',' + i + ')" style="margin:2px;background:transparent;color:var(--text3);border:1px dashed var(--bg2);">release</span>';
  });
  html += '</div></div>';
  return html;
}

var noteDebounce = null;
function debounceSaveNote() {
  clearTimeout(noteDebounce);
  noteDebounce = setTimeout(function() {
    var el = document.getElementById('daily-note');
    if (!el) return;
    var log = getTodayLog();
    log.note = el.value;
    saveTodayLog();
  }, 1200);
}

function saveRitualResponse(qIdx) {
  var el = document.getElementById('ritual-q' + qIdx);
  if (!el) return;
  var today = todayStr();
  if (!appState.ritualLogs[today]) appState.ritualLogs[today] = {};
  appState.ritualLogs[today]['q' + qIdx] = el.value;
  lsSet('rituals', appState.ritualLogs);
  showSync('saved');
}


// ═══════════════════════════════════════════
// SAVE TODAY LOG
// ═══════════════════════════════════════════
var saveTodayTimer = null;
function saveTodayLog() {
  getTodayLog();
  lsSet('dayData', appState.dayLogs);
  showSync('saved');
}

function saveTodayLogDebounced() {
  getTodayLog();
  lsSet('dayData', appState.dayLogs);
  clearTimeout(saveTodayTimer);
  saveTodayTimer = setTimeout(function() { showSync('saved'); }, 300);
}

// ═══════════════════════════════════════════
// EDIT LAYOUT
// ═══════════════════════════════════════════
function startEditing() {
  editMode = true;
  renderToday();
  setTimeout(attachDragHandlers, 50);
}

function doneEditing() {
  editMode = false;
  renderToday();
  saveBlockPrefs();
}

// ── DRAG AND DROP (mouse + touch) ──
var dragSrc = null;
var dragClone = null;
var dragOffsetY = 0;

function attachDragHandlers() {
  var handles = document.querySelectorAll('.drag-handle');
  handles.forEach(function(handle) {
    var wrapper = handle.closest('.block-wrapper');
    if (!wrapper) return;

    // Mouse drag
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startDrag(wrapper, e.clientY);
    });

    // Touch drag
    handle.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var touch = e.touches[0];
      startDrag(wrapper, touch.clientY);
    }, { passive: false });
  });
}

function startDrag(wrapper, startY) {
  dragSrc = wrapper;
  dragSrc.style.opacity = '0.4';
  var rect = dragSrc.getBoundingClientRect();
  dragOffsetY = startY - rect.top;

  // Create clone
  dragClone = dragSrc.cloneNode(true);
  dragClone.style.cssText = 'position:fixed;left:' + rect.left + 'px;width:' + rect.width + 'px;z-index:1000;pointer-events:none;opacity:.9;box-shadow:0 8px 32px rgba(176,90,82,.25);border-radius:12px;background:white;';
  dragClone.style.top = rect.top + 'px';
  document.body.appendChild(dragClone);

  function onMove(clientY) {
    dragClone.style.top = (clientY - dragOffsetY) + 'px';
    // Find element under cursor
    dragClone.style.display = 'none';
    var el = document.elementFromPoint(rect.left + rect.width/2, clientY);
    dragClone.style.display = '';
    if (!el) return;
    var target = el.closest('.block-wrapper');
    if (target && target !== dragSrc) {
      var pane = document.getElementById('today-pane');
      var wrappers = Array.from(pane.querySelectorAll('.block-wrapper'));
      var srcIdx = wrappers.indexOf(dragSrc);
      var tgtIdx = wrappers.indexOf(target);
      if (srcIdx > -1 && tgtIdx > -1) {
        if (srcIdx < tgtIdx) {
          target.parentNode.insertBefore(dragSrc, target.nextSibling);
        } else {
          target.parentNode.insertBefore(dragSrc, target);
        }
      }
    }
  }

  function onEnd() {
    dragSrc.style.opacity = '';
    if (dragClone) { dragClone.remove(); dragClone = null; }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    // Save new order
    var pane = document.getElementById('today-pane');
    if (pane) {
      var newOrder = Array.from(pane.querySelectorAll('.block-wrapper')).map(function(w) { return w.dataset.block; });
      appState.profile.block_order = JSON.stringify(newOrder);
      lsSet('appSettings', appState.profile);
    }
    dragSrc = null;
  }

  function onMouseMove(e) { onMove(e.clientY); }
  function onMouseUp() { onEnd(); }
  function onTouchMove(e) { e.preventDefault(); onMove(e.touches[0].clientY); }
  function onTouchEnd() { onEnd(); }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function hideBlock(blockId) {
  var hidden = getHiddenBlocks();
  if (hidden.indexOf(blockId) === -1) hidden.push(blockId);
  appState.profile.hidden_blocks = JSON.stringify(hidden);
  lsSet('appSettings', appState.profile);
  renderToday();
  saveBlockPrefs();
}

function showBlock(blockId) {
  var hidden = getHiddenBlocks();
  var idx = hidden.indexOf(blockId);
  if (idx > -1) hidden.splice(idx,1);
  appState.profile.hidden_blocks = JSON.stringify(hidden);
  lsSet('appSettings', appState.profile);
  renderToday();
}

function saveBlockPrefs() {
  var core = ['mood'];
  var hidden = getHiddenBlocks().filter(function(b){ return core.indexOf(b) === -1; });
  appState.profile.hidden_blocks = hidden.length ? JSON.stringify(hidden) : null;
  lsSet('appSettings', appState.profile);
  showSync('saved');
}

// ═══════════════════════════════════════════
// SUPPORT TAB
// ═══════════════════════════════════════════
function renderSupport() {
  var cycleDay = getCycleDay();
  var phase = getPhase(cycleDay, appState.profile.cycle_len);
  var data = SUPPORT_DATA[phase.name];
  var pane = document.getElementById('support-pane');
  if (!pane) return;
  var html = '';

  if (isPregnancyMode()) {
    html += '<div style="background:#f4eff7;border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.6rem;">🤍</span>';
    html += '<div><div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:#8a6a9a;margin-bottom:2px;">pregnancy support mode</div>';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(.95rem,3.8vw,1.1rem);font-weight:500;color:#8a6a9a;">gentle tracking, not cycle syncing</div>';
    html += '<div style="font-size:clamp(.75rem,3vw,.82rem);color:var(--text3);">Use this space for symptom notes, body cues, and provider talking points.</div></div></div>';
    html += renderPregnancySupportCard();
    html += '<div class="insight-mini-card" style="border-left-color:#8a6a9a;">';
    html += '<div class="insight-mini-kicker">what to track</div>';
    html += '<div class="insight-mini-title">patterns worth bringing up</div>';
    html += '<div class="insight-mini-body">Mood, sleep, hydration, nausea, cramps, bleeding or spotting, headaches, food aversions, movement, and questions for your provider.</div>';
    html += '</div>';
    html += renderPregnancyWatchlistCard();
    pane.innerHTML = html;
    return;
  }

  // Phase banner
  var bannerBg = { menstrual:'#fdf0ee', follicular:'#f0f5f0', ovulatory:'#fdf6ec', luteal:'#f3f0f8' };
  var bannerColor = { menstrual:'#b05a52', follicular:'#5a8a6a', ovulatory:'#b8832a', luteal:'#6a5a9a' };
  html += '<div style="background:'+bannerBg[phase.name]+';border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
  html += '<span style="font-size:1.6rem;">'+phase.moon+'</span>';
  html += '<div>';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:'+bannerColor[phase.name]+';margin-bottom:2px;">'+phase.name+' phase · day '+cycleDay+'</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(.95rem,3.8vw,1.1rem);font-weight:500;color:'+bannerColor[phase.name]+';">'+phase.arch+'</div>';
  html += '<div style="font-size:clamp(.75rem,3vw,.82rem);color:var(--text3);">'+phase.arch_sub+'</div>';
  html += '</div></div>';
  // Library shortcut button
  html += '<div data-tab="library" onclick="switchTab(this.dataset.tab)" style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:11px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">';
  html += '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.2rem;">&#128214;</span>';
  html += '<div><div style="font-size:clamp(.82rem,3.2vw,.88rem);color:var(--text);font-weight:400;">cycle library</div>';
  html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);">in-depth guides to phases, hormones + cycle syncing</div></div></div>';
  html += '<span style="color:var(--text3);">&#8250;</span></div>';

  // Personalized symptom recs
  var recent = getRecentSymptoms();
  if (recent.length > 0) {
    html += '<div class="symptom-recs">';
    html += '<div class="symptom-recs-title">🌿 personalized for your recent symptoms</div>';
    html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text2);line-height:1.8;">';
    recent.slice(0,4).forEach(function(s) {
      html += '· ' + getSymptomRec(s) + '<br>';
    });
    html += '</div></div>';
  }

  // Sections
  var sections = [
    { id: 'foods', label: '🌿 foods to eat', items: data.foods, type:'why' },
    { id: 'teas', label: '🍵 herbal teas + tonics', items: data.teas, type:'why' },
    { id: 'supps', label: '💊 supplements', items: data.supplements, type:'why', disclaimer:true },
    { id: 'body', label: '🧘 body care rituals', items: data.body, type:'simple' },
    { id: 'movement', label: '🏃 movement', items: data.movement, type:'simple' },
    { id: 'work', label: '💻 content + work alignment', items: data.work, type:'simple' },
    { id: 'avoid', label: '⚠️ foods to minimize', items: data.avoid_foods, type:'why' },
    { id: 'avoidlife', label: '🚫 lifestyle + energy boundaries', items: data.avoid_lifestyle, type:'simple' }
  ];
  if (!isPregnancyMode() && appState.profile.fertility_tracking !== false) {
    sections.splice(3, 0, {
      id: 'fertility',
      label: '🌸 fertility tracking',
      type: 'chapter',
      items: getFertilitySupportChapter(phase.name)
    });
  }

  sections.forEach(function(sec) {
    html += '<div style="margin-bottom:8px;background:var(--white);border-radius:var(--radius-sm);box-shadow:var(--shadow);overflow:hidden;">';
    html += '<button style="width:100%;text-align:left;padding:clamp(12px,3.5vw,15px) 16px;background:transparent;border:none;font-family:\'Jost\',sans-serif;font-size:clamp(.8rem,3.2vw,.88rem);letter-spacing:.04em;color:var(--text2);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSupport(\''+sec.id+'\')" id="sacc-'+sec.id+'">';
    html += '<span>'+sec.label+'</span><span style="transition:transform .25s;display:inline-block;font-size:.7rem;color:var(--text3);" id="sarr-'+sec.id+'">▼</span></button>';
    html += '<div style="overflow:hidden;max-height:0;transition:max-height .4s cubic-bezier(.4,0,.2,1);" id="sbody-'+sec.id+'">';
    html += '<div style="padding:0 16px 14px;border-top:1px solid var(--bg2);">';
    if (sec.disclaimer) {
      html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);font-style:italic;padding:10px 0 6px;line-height:1.55;border-bottom:1px solid var(--bg2);margin-bottom:4px;">⚠️ always consult your healthcare provider before starting any supplement protocol, especially if pregnant, breastfeeding, or managing a health condition.</div>';
    }
    if (sec.type === 'chapter') {
      sec.items.forEach(function(item, i) {
        html += '<div style="padding:clamp(9px,3vw,12px) 0;border-bottom:'+(i<sec.items.length-1?'1px solid var(--bg2)':'none')+';">';
        html += '<div style="font-size:clamp(.82rem,3.3vw,.9rem);font-weight:400;color:var(--text);margin-bottom:5px;line-height:1.45;">'+item.title+'</div>';
        html += '<div style="font-size:clamp(.74rem,2.9vw,.8rem);color:var(--text3);line-height:1.7;">'+item.body+'</div>';
        html += '</div>';
      });
    } else if (sec.type === 'simple') {
      sec.items.forEach(function(item, i) {
        html += '<div style="padding:clamp(7px,2.5vw,10px) 0;border-bottom:'+(i<sec.items.length-1?'1px solid var(--bg2)':'none')+';">';
        html += '<div style="font-size:clamp(.8rem,3.2vw,.86rem);color:var(--text);line-height:1.55;">'+item+'</div>';
        html += '</div>';
      });
    } else {
      sec.items.forEach(function(item, i) {
        html += '<div style="padding:clamp(8px,3vw,11px) 0;border-bottom:'+(i<sec.items.length-1?'1px solid var(--bg2)':'none')+';">';
        html += '<div style="font-size:clamp(.82rem,3.3vw,.88rem);font-weight:400;color:var(--text);margin-bottom:4px;line-height:1.45;">'+item.name+'</div>';
        if (item.why) html += '<div style="font-size:clamp(.74rem,2.9vw,.8rem);color:var(--text3);line-height:1.65;">'+item.why+'</div>';
        html += '</div>';
      });
    }
    html += '</div></div></div>';
  });

  // Disclaimer
  html += '<div style="padding:4px 4px 8px;"><p style="font-size:clamp(.66rem,2.5vw,.72rem);color:var(--text3);font-style:italic;line-height:1.6;">The information in this app is for educational and wellness purposes only. Always consult a qualified healthcare provider before starting supplements or making changes to your health routine.</p></div>';

  pane.innerHTML = html;
}

function getFertilitySupportChapter(phaseName) {
  var phaseNote = {
    menstrual: 'During menstruation, fertility signs are usually quiet. If you are tracking BBT, the win is consistency: take it at the same time before getting out of bed.',
    follicular: 'In follicular, cervical mucus often shifts from dry or sticky toward creamy, watery, or egg white as estrogen rises. This is the best time to begin watching signs.',
    ovulatory: 'Around ovulation, fertile mucus and LH data are most useful. LH peak suggests ovulation may happen soon, while egg white or watery mucus shows the body is creating a fertile environment.',
    luteal: 'After ovulation, BBT often stays higher because progesterone is warming. A sustained temperature shift can help confirm ovulation after the fact.'
  };
  return [
    {
      title: 'what fertility tracking means here',
      body: 'This app uses fertility signs for body literacy: understanding patterns, timing, and how your hormones show up. It is not designed for contraception and should not be relied on to prevent pregnancy.'
    },
    {
      title: 'cervical mucus',
      body: 'Mucus is one of the most useful daily signs. Dry or sticky usually means lower fertility. Creamy can mean estrogen is rising. Watery and egg white mucus are typically the most fertile-quality signs because they help sperm survive and move.'
    },
    {
      title: 'LH tests',
      body: 'LH strips detect the luteinizing hormone surge. A high or peak LH result often means ovulation may happen in the next 24-36 hours, but it does not prove ovulation happened. That is why combining LH with BBT or mucus gives a better picture.'
    },
    {
      title: 'basal body temperature',
      body: 'BBT is most powerful when logged daily before getting out of bed. It usually rises after ovulation because progesterone warms the body. BBT confirms ovulation after the fact rather than predicting it ahead of time.'
    },
    {
      title: 'ovulation pain',
      body: 'A one-sided twinge or ache can happen near ovulation for some people. Log it as a clue, not a certainty. If pain is severe, persistent, or unusual for you, it is worth checking in with a qualified clinician.'
    },
    {
      title: 'where you are now',
      body: phaseNote[phaseName] || phaseNote.follicular
    }
  ];
}

function renderPregnancySupportCard() {
  var html = '<div class="symptom-recs" style="border-left-color:#8a6a9a;">';
  html += '<div class="symptom-recs-title" style="color:#8a6a9a;">🤍 pregnancy safety note</div>';
  html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text2);line-height:1.75;">';
  html += '· cycle and fertile-window predictions are paused<br>';
  html += '· avoid yoni steaming, castor oil packs, detox protocols, and herbs/supplements unless your provider clears them<br>';
  html += '· use this app for mood, symptoms, sleep, hydration, notes, habits, and provider talking points<br>';
  html += '· seek medical guidance for bleeding, severe pain, persistent vomiting, fever, dizziness, or anything that feels concerning';
  html += '</div></div>';
  return html;
}

function renderPregnancyWatchlistCard() {
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:#8a6a9a;margin-bottom:8px;">provider question log</div>';
  html += '<div class="flag-row" style="border-left-color:#8a6a9a;">what symptoms feel new, intense, persistent, or concerning?</div>';
  html += '<div class="flag-row" style="border-left-color:#8a6a9a;">what foods, movement, rest, or routines are actually helping?</div>';
  html += '<div class="flag-row" style="border-left-color:#8a6a9a;">ask before herbs, supplements, castor oil, steaming, detoxes, or intense new exercise.</div>';
  html += '<div class="insight-mini-meta">Urgent symptoms like heavy bleeding, severe pain, fever, fainting, persistent vomiting, or reduced fetal movement later in pregnancy need prompt medical guidance.</div>';
  html += '</div></div>';
  return html;
}

function toggleSupport(id) {
  var body = document.getElementById('sbody-' + id);
  var arr = document.getElementById('sarr-' + id);
  if (!body) return;
  var isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px'; // set explicit before animating down
    requestAnimationFrame(function() {
      body.style.maxHeight = '0px';
    });
    if (arr) arr.style.transform = 'rotate(0deg)';
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    // After transition, set to 'none' so content can resize freely
    body.addEventListener('transitionend', function onEnd() {
      if (body.style.maxHeight !== '0px') body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    });
    if (arr) arr.style.transform = 'rotate(180deg)';
  }
}

function getRecentSymptoms() {
  var syms = [];
  var dates = Object.keys(appState.dayLogs).sort().reverse().slice(0,7);
  dates.forEach(function(d) {
    var log = appState.dayLogs[d];
    if (log && log.symptoms) {
      var arr = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : log.symptoms;
      arr.forEach(function(s) { if (syms.indexOf(s) === -1) syms.push(s); });
    }
  });
  return syms;
}

function getSymptomRec(symptom) {
  var recs = {
    'cramps': 'ginger tea + magnesium glycinate for cramping',
    'bloating': 'fennel tea + reduce salt + gentle movement',
    'headache': 'hydrate well + magnesium + peppermint oil on temples',
    'cravings': 'dark chocolate (85%+) satisfies cravings with benefits',
    'pms mood swings': 'magnesium + b6 + passionflower tea for mood',
    'anxiety/irritability': 'ashwagandha + passionflower + reduce caffeine',
    'brain fog': 'lion\'s mane tea + hydration + walk in nature',
    'breast tenderness': 'evening primrose oil + reduce caffeine',
    'lower back pain': 'castor oil pack + magnesium + gentle stretching',
    'constipated': 'increase water, fiber, gentle movement, magnesium',
    'bloating': 'fennel tea, reduce processed foods, gentle movement',
    'increased libido': 'this is your ovulatory energy — channel it creatively',
    'ovulation pain/mittelschmerz': 'warm compress + rest + anti-inflammatory foods',
    'diarrhea': 'bone broth, electrolytes, avoid raw foods temporarily'
  };
  return recs[symptom] || 'nourish and rest — your body is communicating';
}

function formatCycleRangeDate(dateStr) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = new Date(dateStr + 'T00:00:00');
  return months[d.getMonth()] + ' ' + d.getDate();
}

function addDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateToString(d);
}

function renderCycleDots(days, isCurrent) {
  var cycleLen = appState.profile.cycle_len || 28;
  var total = Math.max(21, Math.min(40, days || cycleLen));
  var filledThrough = isCurrent ? Math.min(days, total) : total;
  var ovDay = Math.round(cycleLen * 0.5);
  var html = '<div class="cycle-dot-row" aria-hidden="true">';
  for (var day = 1; day <= total; day++) {
    var cls = 'cycle-day-dot';
    if (day > filledThrough) {
      cls += ' future';
    } else if (day <= 5) {
      cls += ' bleed';
    } else if (day >= ovDay - 5 && day <= ovDay + 3) {
      cls += day === ovDay ? ' ovulation' : ' fertile';
    } else {
      cls += ' quiet';
    }
    html += '<span class="' + cls + '"></span>';
  }
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════
// LOG TAB
// ═══════════════════════════════════════════
function renderLog() {
  var pane = document.getElementById('log-pane');
  if (!pane) return;
  if (!logViewDate) logViewDate = todayStr();
  var viewDate = logViewDate;
  var today    = todayStr();
  var vd       = new Date(viewDate+'T00:00:00');
  var prevDate = new Date(vd); prevDate.setDate(prevDate.getDate()-1);
  var nextDate = new Date(vd); nextDate.setDate(nextDate.getDate()+1);
  var prevStr  = dateToString(prevDate);
  var nextStr  = dateToString(nextDate);
  var isToday  = viewDate === today;
  if (!appState.dayLogs) appState.dayLogs = {};
  var log = appState.dayLogs[viewDate] || createEmptyDayLog(viewDate);
  var viewCycleDay = 1;
  if (appState.cycleStarts && appState.cycleStarts.length) {
    var sortedS = appState.cycleStarts.map(function(s){return s.start_date;}).sort();
    var vdDate  = new Date(viewDate+'T00:00:00');
    var closestStart = null;
    sortedS.forEach(function(s){ var sd=new Date(s+'T00:00:00'); if(sd<=vdDate&&(!closestStart||sd>new Date(closestStart+'T00:00:00')))closestStart=s; });
    if (closestStart) viewCycleDay = Math.max(1,Math.floor((vdDate-new Date(closestStart+'T00:00:00'))/86400000)+1);
  }
  var viewPhase = getPhase(viewCycleDay, appState.profile.cycle_len||28);
  var months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var wdays  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var dateLabel = isToday ? 'today' : wdays[vd.getDay()]+', '+months[vd.getMonth()]+' '+vd.getDate();
  var html = '';

  // ── Day navigation ──
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">';
  html += '<button data-d="'+prevStr+'" onclick="logNavTo(this.dataset.d)" style="width:38px;height:38px;border-radius:50%;border:1px solid var(--bg2);background:var(--white);color:var(--brand);font-size:1.2rem;cursor:pointer;box-shadow:var(--shadow);">&#8249;</button>';
  html += '<div style="text-align:center;"><div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.1rem,4.5vw,1.3rem);color:var(--brand);">'+dateLabel+'</div>';
  html += '<div style="font-size:clamp(.66rem,2.5vw,.72rem);color:var(--text3);">' + (isPregnancyMode() ? 'pregnancy tracking' : viewPhase.moon+' '+viewPhase.name+' &#183; day '+viewCycleDay) + '</div></div>';
  var nextDisabled = nextStr > today;
  html += '<button data-d="'+nextStr+'" onclick="logNavTo(this.dataset.d)" style="width:38px;height:38px;border-radius:50%;border:1px solid var(--bg2);background:var(--white);color:'+(nextDisabled?'var(--bg2)':'var(--brand)')+';font-size:1.2rem;cursor:pointer;box-shadow:var(--shadow);" '+(nextDisabled?'disabled':'')+'>&#8250;</button>';
  html += '</div>';

  html += renderLogDateLookup(viewDate);

  if (!isToday) {
    html += renderLoggedDaySummary(viewDate, log, viewPhase, viewCycleDay);
    pane.innerHTML = html;
    return;
  }

  // ── Intimacy ──
  html += '<div class="card" style="margin-bottom:12px;"><div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;">';
  html += '<span style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text2);">intimacy</span>';
  html += '<button data-d="'+viewDate+'" onclick="logToggleIntimacy(this.dataset.d)" style="background:none;border:none;font-size:1.6rem;cursor:pointer;">'+(log.intimate?'&#9829;':'&#9825;')+'</button>';
  html += '</div></div>';

  // ── Flow ──
  var flowOpts = ['spotting','light','medium','heavy'];
  html += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">flow</span></div><div class="card-body"><div class="flow-opts">';
  flowOpts.forEach(function(o){
    html += '<div class="flow-opt'+(log.flow===o?' selected':'')+'" data-d="'+viewDate+'" data-v="'+o+'" onclick="logSetFlow(this.dataset.d,this.dataset.v)">'+o+'</div>';
  });
  html += '</div></div></div>';

  // ── Fertility signs ──
  if (!isPregnancyMode() && appState.profile.fertility_tracking !== false) {
    var logFertility = getFertility(log);
    var mucusOpts = ['dry','sticky','creamy','watery','egg white'];
    var lhOpts = [{v:'negative',l:'LH -'},{v:'high',l:'LH high'},{v:'peak',l:'LH peak'}];
    html += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">fertility signs</span><span style="font-size:.72rem;color:var(--text3);">optional</span></div><div class="card-body">';
    html += '<div class="symp-section-label">cervical mucus</div><div class="fertility-opts">';
    mucusOpts.forEach(function(o){
      html += '<span class="fertility-opt'+(logFertility.mucus===o?' selected':'')+'" data-d="'+viewDate+'" data-v="'+o+'" onclick="logSetFertilitySign(this.dataset.d,\'mucus\',this.dataset.v)">'+o+'</span>';
    });
    html += '</div><div class="symp-section-label" style="margin-top:11px;">LH test</div><div class="fertility-opts">';
    lhOpts.forEach(function(o){
      html += '<span class="fertility-opt'+(logFertility.lh===o.v?' selected':'')+'" data-d="'+viewDate+'" data-v="'+o.v+'" onclick="logSetFertilitySign(this.dataset.d,\'lh\',this.dataset.v)">'+o.l+'</span>';
    });
    html += '</div><div class="fertility-row">';
    html += '<label class="fertility-bbt-label">BBT <input class="fertility-bbt-input" inputmode="decimal" type="number" step="0.01" min="95" max="100" value="'+(logFertility.bbt||'')+'" placeholder="97.45" data-d="'+viewDate+'" onchange="logSetFertilityBBT(this.dataset.d,this.value)"></label>';
    html += '<button class="fertility-pain-btn'+(logFertility.ovulation_pain?' selected':'')+'" data-d="'+viewDate+'" onclick="logToggleFertilityPain(this.dataset.d)">ovulation pain</button>';
    html += '</div><div class="fertility-note">These signs help refine insights, not prevent pregnancy.</div></div></div>';
  }

  // ── Mood ──
  var emojis = getMoodEmojis(); var words = getMoodWords();
  var selE = log.mood_emoji||[]; var selW = log.mood_words||[];
  html += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">mood</span></div><div class="card-body">';
  html += '<div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:10px;">';
  emojis.forEach(function(e){
    var sel=selE.indexOf(e.emoji)>-1;
    html += '<span class="chip chip-sm'+(sel?' selected':'')+'" data-d="'+viewDate+'" data-v="'+encodeURIComponent(e.emoji)+'" onclick="logToggleMoodEmoji(this.dataset.d,decodeURIComponent(this.dataset.v))">'+e.emoji+' '+e.label+'</span>';
  });
  html += '</div><div style="display:flex;flex-wrap:wrap;gap:0;">';
  words.forEach(function(w){
    var sel=selW.indexOf(w)>-1;
    html += '<span class="chip chip-sm'+(sel?' selected':'')+'" data-d="'+viewDate+'" data-v="'+w+'" onclick="logToggleMoodWord(this.dataset.d,this.dataset.v)">'+w+'</span>';
  });
  html += '</div></div></div>';

  // ── Sleep ──
  var sleepOpts = ['poor','okay','great','amazing'];
  html += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">sleep</span></div><div class="card-body"><div class="sleep-opts">';
  sleepOpts.forEach(function(o){
    html += '<div class="sleep-opt'+(log.sleep===o?' selected':'')+'" data-d="'+viewDate+'" data-v="'+o+'" onclick="logSetSleep(this.dataset.d,this.dataset.v)">'+o+'</div>';
  });
  html += '</div></div></div>';

  html += renderLogSymptomsEditor(viewDate, log);

  // ── Note ──
  var safeNote = (log.note||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html += '<div class="card" style="margin-bottom:20px;"><div class="card-header"><span class="card-title">note</span></div>';
  html += '<div class="card-body"><textarea id="log-note-area" data-d="'+viewDate+'" class="note-area" placeholder="how was this day..." oninput="logSaveNote(this.dataset.d)" onblur="logSaveNote(this.dataset.d)">'+safeNote+'</textarea></div></div>';

  // symptoms history
  var logSyms = log.symptoms || [];
  if (typeof logSyms === 'string') { try { logSyms = JSON.parse(logSyms); } catch(e){ logSyms=[]; } }
  if (logSyms.length) {
    html += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">symptoms</span></div>';
    html += '<div class="card-body"><div style="display:flex;flex-wrap:wrap;gap:5px;">';
    logSyms.forEach(function(s){ html += '<span style="padding:4px 10px;border-radius:20px;background:var(--bg2);font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text2);">'+escapeHabitText(formatSymptomForDisplay(log, s))+'</span>'; });
    html += '</div></div></div>';
  }

  // tasks history
  var logTasks = log.tasks || [];
  if (typeof logTasks === 'string') { try { logTasks = JSON.parse(logTasks); } catch(e){ logTasks=[]; } }
  if (logTasks.length) {
    html += '<div class="card" style="margin-bottom:20px;"><div class="card-header"><span class="card-title">tasks</span></div>';
    html += '<div class="card-body" style="padding-bottom:6px;">';
    logTasks.forEach(function(tk){
      html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bg2);">';
      html += '<div style="width:16px;height:16px;border-radius:50%;background:'+(tk.done?'var(--brand)':'transparent')+';border:1.5px solid '+(tk.done?'var(--brand)':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
      if(tk.done) html += '<span style="color:#fff;font-size:.65rem;">&#10003;</span>';
      html += '</div><span style="font-size:clamp(.8rem,3.2vw,.86rem);color:'+(tk.done?'var(--text3)':'var(--text)')+';'+(tk.done?'text-decoration:line-through;':'')+'">'+tk.text+'</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // ── CYCLE SECTION ──
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--text3);margin:4px 0 12px;">cycle tracking</div>';

  html += '<div class="card">';
  html += '<div class="card-header"><span class="card-title">current cycle</span></div>';
  html += '<div class="card-body">';
  html += '<div style="font-size:.82rem;color:var(--text3);margin-bottom:8px;">cycle start date</div>';
  html += '<div class="cycle-input-row">';
  html += '<input class="cycle-input" type="date" id="current-cycle-input" value="' + getCurrentCycleStart() + '">';
  html += '<button class="btn-sm" onclick="setCurrentCycle()">set</button>';
  html += '</div></div></div>';

  html += '<div class="card">';
  html += '<div class="card-header"><span class="card-title">add past cycle</span></div>';
  html += '<div class="card-body">';
  html += '<div style="font-size:.82rem;color:var(--text3);margin-bottom:8px;">start date of past cycle</div>';
  html += '<div class="cycle-input-row">';
  html += '<input class="cycle-input" type="date" id="past-cycle-input">';
  html += '<button class="btn-sm" onclick="addPastCycle()">add</button>';
  html += '</div></div></div>';

  if (appState.cycleStarts.length > 0) {
    var sortedC = appState.cycleStarts.slice().sort(function(a,b){return b.start_date>a.start_date?1:-1;});
    html += '<div class="cycle-history-card">';
    html += '<div class="cycle-history-title">cycle history</div>';
    sortedC.forEach(function(cs,i){
      var nextStart = i > 0 ? sortedC[i-1].start_date : null;
      var isCurrentCycle = i === 0;
      var days = 0;
      var endLabel = 'today';
      if (nextStart) {
        var d1 = new Date(cs.start_date+'T00:00:00');
        var d2 = new Date(nextStart+'T00:00:00');
        days = Math.max(1, Math.round((d2-d1)/86400000));
        endLabel = formatCycleRangeDate(addDays(nextStart, -1));
      } else {
        var startDate = new Date(cs.start_date+'T00:00:00');
        var todayDate = new Date(todayStr()+'T00:00:00');
        days = Math.max(1, Math.floor((todayDate-startDate)/86400000)+1);
      }
      var startLabel = formatCycleRangeDate(cs.start_date);
      var durationLabel = isCurrentCycle ? days + ' days so far' : days + ' days';
      html += '<div class="cycle-history-row">';
      html += '<div class="cycle-history-head">';
      html += '<div><div class="cycle-history-days">'+durationLabel+'</div>';
      html += '<div class="cycle-history-range">'+startLabel+' – '+endLabel+'</div></div>';
      html += '<button class="cycle-history-remove" data-dt="'+cs.start_date+'" onclick="deleteCycle(this.dataset.dt)" aria-label="remove cycle starting '+startLabel+'">&#215;</button>';
      html += '</div>';
      html += renderCycleDots(days, isCurrentCycle);
      html += '</div>';
    });
    html += '</div>';
  }

  pane.innerHTML = html;
}

function renderCycle() { renderLog(); }

function renderLogSymptomsEditor(dateStr, log) {
  var syms = getSymptoms();
  var selected = log.symptoms || [];
  if (typeof selected === 'string') { try { selected = JSON.parse(selected); } catch(e) { selected = []; } }
  var details = getSymptomDetails(log);
  var html = '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">symptoms</span><span style="font-size:.72rem;color:var(--text3);">severity + duration</span></div><div class="card-body">';
  ['general','menstrual','follicular','ovulatory','luteal'].forEach(function(sec) {
    html += '<div class="symp-section">';
    html += '<div class="symp-section-label">' + (sec === 'luteal' ? 'luteal / pms' : sec) + '</div>';
    html += '<div class="symp-chips">';
    syms[sec].forEach(function(s) {
      var sel = selected.indexOf(s.name) > -1;
      html += '<span class="chip chip-sm' + (sel?' selected':'') + '" data-d="' + dateStr + '" data-v="' + encodeURIComponent(s.name) + '" onclick="logToggleSymptom(this.dataset.d,decodeURIComponent(this.dataset.v))">' + s.emoji + ' ' + s.name + '</span>';
    });
    html += '</div></div>';
  });
  if (selected.length) {
    html += '<div style="margin-top:12px;"><span class="section-label">details</span>';
    selected.forEach(function(name) {
      var detail = details[name] || {};
      var safe = encodeURIComponent(name);
      html += '<div class="flag-row" style="margin-bottom:8px;"><div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text);margin-bottom:7px;">' + escapeHabitText(name) + '</div>';
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;">';
      ['mild','medium','intense'].forEach(function(level) {
        html += '<button data-d="' + dateStr + '" data-v="' + safe + '" onclick="logSetSymptomDetail(this.dataset.d,decodeURIComponent(this.dataset.v),\'severity\',\'' + level + '\')" style="border:1px solid ' + (detail.severity===level?'var(--brand)':'var(--bg2)') + ';background:' + (detail.severity===level?'var(--brand)':'transparent') + ';color:' + (detail.severity===level?'#fff':'var(--text3)') + ';border-radius:20px;padding:5px 9px;font-size:.66rem;font-family:Jost,sans-serif;cursor:pointer;">' + level + '</button>';
      });
      html += '</div><div style="display:flex;gap:5px;flex-wrap:wrap;">';
      ['part of day','all day','comes and goes'].forEach(function(duration) {
        html += '<button data-d="' + dateStr + '" data-v="' + safe + '" onclick="logSetSymptomDetail(this.dataset.d,decodeURIComponent(this.dataset.v),\'duration\',\'' + duration + '\')" style="border:1px solid ' + (detail.duration===duration?'var(--brand)':'var(--bg2)') + ';background:' + (detail.duration===duration?'var(--brand)':'transparent') + ';color:' + (detail.duration===duration?'#fff':'var(--text3)') + ';border-radius:20px;padding:5px 9px;font-size:.66rem;font-family:Jost,sans-serif;cursor:pointer;">' + duration + '</button>';
      });
      html += '</div></div>';
    });
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderLogDateLookup(viewDate) {
  var html = '<div class="card" style="margin-bottom:12px;"><div style="padding:13px 16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:10px;">date lookup</div>';
  html += '<div class="cycle-input-row">';
  html += '<input class="cycle-input" type="date" id="log-lookup-date" max="' + todayStr() + '" value="' + (viewDate || todayStr()) + '">';
  html += '<button class="btn-sm" onclick="logLookupDate()">view</button>';
  html += '</div></div></div>';
  return html;
}

function renderLoggedDaySummary(dateStr, log, phase, cycleDay) {
  function arr(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch(e) { return []; }
  }
  function chipList(items) {
    var html = '<div style="display:flex;flex-wrap:wrap;gap:5px;">';
    items.forEach(function(item) {
      html += '<span style="padding:4px 10px;border-radius:20px;background:var(--bg2);font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text2);">' + escapeHabitText(item) + '</span>';
    });
    html += '</div>';
    return html;
  }

  var cards = '';
  var logged = log && hasRecordedDayLog(log);
  cards += '<div class="insight-mini-card">';
  cards += '<div class="insight-mini-kicker">day snapshot</div>';
  cards += '<div class="insight-mini-title">' + (isPregnancyMode() ? 'pregnancy tracking' : phase.moon + ' ' + phase.name + ' · day ' + cycleDay) + '</div>';
  cards += '<div class="insight-mini-body">' + (logged ? 'Only sections with something recorded are shown below.' : 'Nothing was recorded for this day yet.') + '</div>';
  cards += '</div>';
  if (!logged) return cards;

  if (log.flow || log.intimate) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">body</span></div><div class="card-body" style="font-size:clamp(.8rem,3.1vw,.86rem);color:var(--text2);line-height:1.7;">';
    if (log.flow) cards += 'flow: ' + escapeHabitText(log.flow) + '<br>';
    if (log.intimate) cards += 'intimacy logged<br>';
    cards += '</div></div>';
  }

  var fertility = getFertility(log);
  if (!isPregnancyMode() && hasFertilitySigns(fertility)) {
    var fBits = [];
    if (fertility.mucus) fBits.push('mucus: ' + fertility.mucus);
    if (fertility.lh) fBits.push('LH: ' + fertility.lh);
    if (fertility.bbt) fBits.push('BBT: ' + fertility.bbt);
    if (fertility.ovulation_pain) fBits.push('ovulation pain');
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">fertility signs</span></div><div class="card-body">' + chipList(fBits) + '</div></div>';
  }

  var moods = arr(log.mood_emoji).concat(arr(log.mood_words));
  if (moods.length) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">mood</span></div><div class="card-body">' + chipList(moods) + '</div></div>';
  }

  if (log.sleep || Number(log.water || 0) > 0) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">care</span></div><div class="card-body" style="font-size:clamp(.8rem,3.1vw,.86rem);color:var(--text2);line-height:1.7;">';
    if (log.sleep) cards += 'sleep: ' + escapeHabitText(log.sleep) + '<br>';
    if (Number(log.water || 0) > 0) cards += 'water: ' + Number(log.water || 0) + '/8<br>';
    cards += '</div></div>';
  }

  var syms = arr(log.symptoms);
  if (syms.length) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">symptoms</span></div><div class="card-body">' + chipList(syms.map(function(s) { return formatSymptomForDisplay(log, s); })) + '</div></div>';
  }

  var tasks = arr(log.tasks);
  if (tasks.length) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">tasks</span></div><div class="card-body" style="padding-bottom:6px;">';
    tasks.forEach(function(tk) {
      cards += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bg2);">';
      cards += '<div style="width:16px;height:16px;border-radius:50%;background:'+(tk.done?'var(--brand)':'transparent')+';border:1.5px solid '+(tk.done?'var(--brand)':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
      if (tk.done) cards += '<span style="color:#fff;font-size:.65rem;">&#10003;</span>';
      cards += '</div><span style="font-size:clamp(.8rem,3.2vw,.86rem);color:'+(tk.done?'var(--text3)':'var(--text)')+';'+(tk.done?'text-decoration:line-through;':'')+'">'+escapeHabitText(tk.text)+'</span></div>';
    });
    cards += '</div></div>';
  }

  if (log.note && log.note.trim()) {
    cards += '<div class="card" style="margin-bottom:12px;"><div class="card-header"><span class="card-title">note</span></div><div class="card-body" style="font-size:clamp(.8rem,3.1vw,.86rem);color:var(--text2);line-height:1.7;white-space:pre-wrap;">' + escapeHabitText(log.note.trim()) + '</div></div>';
  }

  return cards;
}

function getCurrentCycleStart() {
  if (!appState.cycleStarts || !appState.cycleStarts.length) return '';
  var sorted = appState.cycleStarts.map(function(s) { return s.start_date; }).sort();
  return sorted[sorted.length-1];
}

function setCurrentCycle() {
  var val = document.getElementById('current-cycle-input').value;
  if (!val) return;
  appState.cycleStarts = appState.cycleStarts.filter(function(s) { return s.start_date !== val; });
  var entry = { user_id: 'local', start_date: val, is_current: true };
  appState.cycleStarts.push(entry);
  lsSet('pastCycles', appState.cycleStarts);
  showSync('saved');
  updatePhaseDisplay();
  renderCycle();
  renderToday();
  renderLog();
  renderInsights();
  renderSupport();
}

function addPastCycle() {
  var val = document.getElementById('past-cycle-input').value;
  if (!val) return;
  if (appState.cycleStarts.some(function(s) { return s.start_date === val; })) return;
  var entry = { user_id: 'local', start_date: val, is_current: false };
  appState.cycleStarts.push(entry);
  lsSet('pastCycles', appState.cycleStarts);
  showSync('saved');
  updatePhaseDisplay();
  renderCycle();
  renderInsights();
}

function deleteCycle(startDate) {
  appState.cycleStarts = appState.cycleStarts.filter(function(s) { return s.start_date !== startDate; });
  lsSet('pastCycles', appState.cycleStarts);
  showSync('saved');
  updatePhaseDisplay();
  renderCycle();
  renderLog();
  renderInsights();
}

// ═══════════════════════════════════════════
// PERIOD START LOGGING
// ═══════════════════════════════════════════
function logPeriodStartToday() {
  if (isPregnancyMode()) {
    alert('Pregnancy mode is on, so period start logging is paused. Turn it off in Settings to resume cycle predictions.');
    return;
  }
  haptic('medium');
  var today = todayStr();
  if (appState.cycleStarts.some(function(s){ return s.start_date === today; })) {
    appState.cycleStarts = appState.cycleStarts.filter(function(s){ return s.start_date !== today; });
  } else {
    var entry = { user_id: 'local', start_date: today, is_current: true };
    appState.cycleStarts = appState.cycleStarts.filter(function(s){ return s.start_date !== today; });
    appState.cycleStarts.push(entry);
  }
  lsSet('pastCycles', appState.cycleStarts);
  showSync('saved');
  updatePhaseDisplay();
  renderAllTabs();
}

// ═══════════════════════════════════════════
// INSIGHTS TAB
// ═══════════════════════════════════════════
function renderInsights() {
  var pane = document.getElementById('insights-pane');
  if (!pane) return;
  var cycleDay = getCycleDay();
  var cycleLen = appState.profile.cycle_len || 28;
  var phase = getPhase(cycleDay, cycleLen);
  var html = '';

  if (isPregnancyMode()) {
    pane.innerHTML = renderPregnancyInsights();
    return;
  }

  html += renderInsightsViewToggle();

  // ─── Compute cycle history ───
  var sortedStarts = [];
  if (appState.cycleStarts && appState.cycleStarts.length) {
    sortedStarts = appState.cycleStarts.map(function(s){return s.start_date;}).sort();
  }
  var cycleLengths = [];
  for (var ci = 1; ci < sortedStarts.length; ci++) {
    var dl2 = Math.round((new Date(sortedStarts[ci]+'T00:00:00') - new Date(sortedStarts[ci-1]+'T00:00:00')) / 86400000);
    if (dl2 > 15 && dl2 < 65) cycleLengths.push(dl2);
  }
  var avgLen = cycleLen;
  var shortestCycle = cycleLen, longestCycle = cycleLen;
  var stdDev = 0;
  if (cycleLengths.length) {
    avgLen = Math.round(cycleLengths.reduce(function(a,b){return a+b;},0) / cycleLengths.length);
    shortestCycle = Math.min.apply(null, cycleLengths);
    longestCycle  = Math.max.apply(null, cycleLengths);
    var mean = avgLen;
    var variance = cycleLengths.reduce(function(a,b){return a+Math.pow(b-mean,2);},0) / cycleLengths.length;
    stdDev = Math.sqrt(variance);
  }
  var regularityScore = cycleLengths.length < 2 ? '—' : stdDev < 1 ? 'very regular' : stdDev < 2.5 ? 'regular' : stdDev < 5 ? 'somewhat variable' : 'variable';
  var regularityColor = cycleLengths.length < 2 ? 'var(--text3)' : stdDev < 1 ? '#5a8a6a' : stdDev < 2.5 ? '#6a9a7a' : stdDev < 5 ? '#b8832a' : '#b05a52';
  var totalDays = Object.keys(appState.dayLogs || {}).filter(function(d) {
    return hasRecordedDayLog(appState.dayLogs[d]);
  }).length;

  // ─── Next period prediction ───
  var todayD = new Date(); todayD.setHours(0,0,0,0);
  var mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var nextPeriodStr = '';
  var daysUntil = 0;
  var periodTimingText = '';
  var earlyDate = '', lateDate = '';
  var lastStart = sortedStarts.length ? sortedStarts[sortedStarts.length-1] : null;
  var fertilitySummary = getFertilitySignalSummary();
  if (lastStart) {
    var nextP = new Date(lastStart + 'T00:00:00');
    if (fertilitySummary.likelyDate) {
      nextP = new Date(fertilitySummary.likelyDate + 'T00:00:00');
      var lutealLen = Math.max(10, Math.min(16, avgLen - Math.round(avgLen * 0.5)));
      nextP.setDate(nextP.getDate() + lutealLen);
    } else {
      nextP.setDate(nextP.getDate() + avgLen);
    }
    var rawDaysUntil = Math.floor((nextP - todayD) / 86400000);
    daysUntil = Math.max(0, rawDaysUntil);
    periodTimingText = rawDaysUntil < 0
      ? '· expected ' + Math.abs(rawDaysUntil) + ' day' + (Math.abs(rawDaysUntil)===1?'':'s') + ' ago'
      : rawDaysUntil === 0
        ? '· expected today'
        : '· in ' + rawDaysUntil + ' day' + (rawDaysUntil===1?'':'s');
    nextPeriodStr = mNames[nextP.getMonth()] + ' ' + nextP.getDate();
    if (cycleLengths.length > 1) {
      var earlyP = new Date(lastStart + 'T00:00:00'); earlyP.setDate(earlyP.getDate() + shortestCycle);
      var lateP  = new Date(lastStart + 'T00:00:00'); lateP.setDate(lateP.getDate()  + longestCycle);
      earlyDate = mNames[earlyP.getMonth()] + ' ' + earlyP.getDate();
      lateDate  = mNames[lateP.getMonth()]  + ' ' + lateP.getDate();
    }
  }

  if (insightsView === 'reports') {
    html += '<button onclick="showReportCard()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 16px;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:none;cursor:pointer;margin-bottom:14px;">';
    html += '<span style="font-size:1.2rem;">&#128247;</span>';
    html += '<div style="text-align:left;"><div style="font-size:clamp(.84rem,3.3vw,.9rem);color:var(--text);font-weight:400;">create your cycle portrait</div>';
    html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);">a beautiful image of this moment in your cycle</div></div>';
    html += '<span style="color:var(--text3);margin-left:auto;">&#8250;</span></button>';
    html += '<button onclick="exportCycleReport()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 16px;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:none;cursor:pointer;margin-bottom:14px;">';
    html += '<span style="font-size:1.2rem;">&#128196;</span>';
    html += '<div style="text-align:left;"><div style="font-size:clamp(.84rem,3.3vw,.9rem);color:var(--text);font-weight:400;">export cycle report</div>';
    html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);">patterns, flags, signs + next steps</div></div>';
    html += '<span style="color:var(--text3);margin-left:auto;">&#8250;</span></button>';
  }

  if (insightsView === 'overview') {
    html += renderPredictionConfidenceCard(cycleLengths, totalDays, fertilitySummary);
    html += renderBackupReminderCard();
    html += renderFirstWeekInsightsCard(totalDays, sortedStarts.length);
    html += renderCycleComparisonCard();
    html += renderPMSCarePlanCard(daysUntil, nextPeriodStr);
    html += renderCycleRecapCard();
    html += renderCycleHealthFlags();
  }
  if (insightsView === 'patterns') {
    html += renderPatternLibraryCard();
    html += renderSmartPatternInsights();
    html += renderMonthlyBodyReportCard();
  }
  if (insightsView === 'reports') {
    html += renderPredictionConfidenceCard(cycleLengths, totalDays, fertilitySummary);
    html += renderMonthlyBodyReportCard();
  }

  if (insightsView === 'overview' && nextPeriodStr) {
    var confidence = fertilitySummary.likelyDate ? fertilitySummary.confidence + ' with signs' : cycleLengths.length >= 3 ? 'high' : cycleLengths.length >= 1 ? 'moderate' : 'estimated';
    var confColor = confidence.indexOf('high') === 0 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.75)';
    html += '<div style="background:#a05048;border-radius:var(--radius);padding:clamp(14px,4vw,18px) clamp(16px,5vw,20px);margin-bottom:14px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px;">next period predicted</div>';
    html += '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">';
    html += '<span style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.4rem,5.8vw,1.8rem);font-weight:400;color:#fff;">🌑  ' + nextPeriodStr + '</span>';
    html += '<span style="font-size:clamp(.78rem,3vw,.86rem);color:rgba(255,255,255,.82);">' + periodTimingText + '</span>';
    html += '</div>';
    if (earlyDate && lateDate && earlyDate !== lateDate) {
      var earlyP2 = new Date(lastStart + 'T00:00:00'); earlyP2.setDate(earlyP2.getDate() + shortestCycle);
      var showEarly = earlyP2 >= todayD ? earlyDate : 'now';
      html += '<div style="font-size:clamp(.7rem,2.7vw,.76rem);color:rgba(255,255,255,.65);margin-top:5px;">possible window: ' + showEarly + ' – ' + lateDate + '</div>';
    }
    html += '<div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;font-size:clamp(.62rem,2.4vw,.68rem);color:' + confColor + ';">confidence: ' + confidence + '</div>';
    if (fertilitySummary.likelyDate) {
      html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:rgba(255,255,255,.72);margin-top:6px;">based on ' + fertilitySummary.evidence + ' around cycle day ' + fertilitySummary.likelyDay + '</div>';
    }
    html += '</div>';
  } else if (insightsView === 'overview') {
    html += '<div style="background:var(--white);border-radius:var(--radius);padding:16px;margin-bottom:14px;text-align:center;border:1.5px dashed var(--bg2);">';
    html += '<div style="font-size:.82rem;color:var(--text3);line-height:1.6;">log your first period start in the Cycle tab<br>to unlock predictions & insights</div>';
    html += '</div>';
  }

  if (insightsView === 'overview') {
  html += '<div class="card"><div style="padding:16px 16px 4px;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.05rem,4.2vw,1.25rem);font-weight:400;color:var(--brand);">Your cycle at a glance</div></div>';
  html += '<div style="padding:4px 0 10px;">';
  var glanceRows = [
    ['Current day', 'Day ' + cycleDay],
    ['Current phase', phase.moon + '  ' + phase.name.charAt(0).toUpperCase() + phase.name.slice(1)],
    ['Average cycle length', avgLen + ' days'],
    ['Shortest cycle', cycleLengths.length >= 2 ? shortestCycle + ' days' : '—'],
    ['Longest cycle',  cycleLengths.length >= 2 ? longestCycle  + ' days' : '—'],
    ['Cycle regularity', '<span style="color:' + regularityColor + ';">' + regularityScore + '</span>'],
    ['Cycles logged', sortedStarts.length + ''],
    ['Days tracked so far', totalDays + ' day' + (totalDays===1?'':'s')]
  ];
  glanceRows.forEach(function(r,i){
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:'+(i<glanceRows.length-1?'1px solid var(--bg2)':'none')+';gap:12px;">';
    html += '<span style="font-size:clamp(.8rem,3.2vw,.86rem);color:var(--text);font-weight:400;flex-shrink:0;">'+r[0]+'</span>';
    html += '<span style="font-size:clamp(.8rem,3.2vw,.88rem);color:var(--brand);font-family:\'Cormorant Garamond\',serif;font-weight:500;text-align:right;">'+r[1]+'</span>';
    html += '</div>';
  });
  html += '</div></div>';
  }

  if (insightsView === 'overview') {
  var _ovDay   = Math.round(cycleLen * 0.5);
  var _mensD   = 5;
  var _follD   = Math.max(0, _ovDay - 2 - _mensD);
  var _ovulD   = 3;
  var _lutD    = Math.max(0, cycleLen - _mensD - _follD - _ovulD);
  var mens_pct = (_mensD / cycleLen * 100).toFixed(0);
  var foll_pct = (_follD / cycleLen * 100).toFixed(0);
  var ovul_pct = (_ovulD / cycleLen * 100).toFixed(0);
  var lut_pct  = (_lutD  / cycleLen * 100).toFixed(0);
  html += '<div class="card"><div style="padding:16px 16px 14px;">';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.05rem,4.2vw,1.25rem);font-weight:400;color:var(--brand);margin-bottom:14px;">Where you are in your cycle</div>';
  html += '<div style="display:flex;border-radius:6px;overflow:hidden;height:10px;margin-bottom:12px;gap:2px;">';
  html += '<div style="width:'+mens_pct+'%;background:#e8a09a;border-radius:6px 0 0 6px;"></div>';
  html += '<div style="width:'+foll_pct+'%;background:#a8d4b4;"></div>';
  html += '<div style="width:'+ovul_pct+'%;background:#f0d080;"></div>';
  html += '<div style="width:'+lut_pct+'%;background:#c0b4e0;border-radius:0 6px 6px 0;"></div>';
  html += '</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px clamp(8px,3vw,16px);">';
  [{dot:'#c08480',moon:'🌑',label:'Menstrual',active:phase.name==='menstrual'},
   {dot:'#5a9a7a',moon:'🌒',label:'Follicular',active:phase.name==='follicular'},
   {dot:'#d4a020',moon:'🌕',label:'Ovulatory',active:phase.name==='ovulatory'},
   {dot:'#8070b0',moon:'🌗',label:'Luteal',active:phase.name==='luteal'}
  ].forEach(function(l){
    html += '<div style="display:flex;align-items:center;gap:5px;">';
    html += '<div style="width:10px;height:10px;border-radius:50%;background:'+l.dot+';flex-shrink:0;"></div>';
    html += '<span style="font-size:.8rem;">'+l.moon+'</span>';
    html += '<span style="font-size:clamp(.72rem,2.8vw,.8rem);color:'+(l.active?'var(--text)':'var(--text3)')+';font-weight:'+(l.active?'500':'300')+';">'+l.label+(l.active?' ←':'')+'</span>';
    html += '</div>';
  });
  html += '</div></div></div>';
  }

  if (insightsView === 'reports') {
    html += renderPredictionCards();
  }

    // ─── Symptom patterns (real data) ───
  var patterns = getSymptomPatterns();
  if (insightsView === 'patterns' && patterns.length > 0) {
    html += '<div class="card"><div style="padding:16px 16px 14px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:4px;">your symptom patterns</div>';
    html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);margin-bottom:12px;">based on your logged days</div>';
    patterns.forEach(function(p,i){
      html += '<div style="padding:10px 0;border-bottom:'+(i<patterns.length-1?'1px solid var(--bg2)':'none')+';">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">';
      html += '<span style="font-size:clamp(.8rem,3.2vw,.86rem);color:var(--text);font-weight:400;">'+p.symptom+'</span>';
      html += '<span style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);text-align:right;flex-shrink:0;">'+p.count+'x logged</span>';
      html += '</div>';
      if (p.phases && p.phases.length) {
        html += '<div style="margin-top:4px;display:flex;gap:5px;flex-wrap:wrap;">';
        p.phases.forEach(function(ph){
          var phColors = {menstrual:'#f4d8d5',follicular:'#d5ead8',ovulatory:'#f5edcc',luteal:'#e8e0f0'};
          var phText   = {menstrual:'#9a4a42',follicular:'#3a6a4a',ovulatory:'#8a6010',luteal:'#4a3a7a'};
          html += '<span style="font-size:clamp(.62rem,2.4vw,.68rem);background:'+(phColors[ph]||'var(--bg2)')+';color:'+(phText[ph]||'var(--text3)')+';border-radius:20px;padding:2px 8px;">'+ph+'</span>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  } else if (insightsView === 'patterns') {
    html += '<div class="card"><div style="padding:16px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">symptom patterns</div>';
    html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text3);line-height:1.6;">Log symptoms in the Today tab to discover your personal patterns across phases.</div>';
    html += '</div></div>';
  }

  var moodPats = getMoodPatterns();
  if (insightsView === 'patterns' && moodPats.length > 0) {
    html += '<div class="card"><div style="padding:16px 16px 14px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:4px;">your mood patterns</div>';
    html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);margin-bottom:12px;">emotions logged across your cycle</div>';
    moodPats.forEach(function(m,i){
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:'+(i<moodPats.length-1?'1px solid var(--bg2)':'none')+';gap:8px;">';
      html += '<span style="font-size:1.1rem;">'+m.emoji+'</span>';
      html += '<span style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text);flex:1;margin-left:6px;">'+m.label+'</span>';
      html += '<div style="display:flex;gap:4px;">';
      m.phases.forEach(function(ph){
        var phShort = {menstrual:'mens',follicular:'foll',ovulatory:'ovul',luteal:'lut'};
        var phColors = {menstrual:'#f4d8d5',follicular:'#d5ead8',ovulatory:'#f5edcc',luteal:'#e8e0f0'};
        var phText   = {menstrual:'#9a4a42',follicular:'#3a6a4a',ovulatory:'#8a6010',luteal:'#4a3a7a'};
        html += '<span style="font-size:.6rem;background:'+(phColors[ph]||'var(--bg2)')+';color:'+(phText[ph]||'var(--text3)')+';border-radius:20px;padding:2px 7px;">'+(phShort[ph]||ph)+'</span>';
      });
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  if (insightsView === 'reports') {
  html += '<div class="card"><div style="padding:16px 16px 14px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:12px;">what\'s happening hormonally</div>';
  var hormones = getHormoneData(phase.name);
  hormones.forEach(function(h,i){
    html += '<div style="padding:10px 0;border-bottom:'+(i<hormones.length-1?'1px solid var(--bg2)':'none')+';\">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">';
    html += '<span style="font-size:1rem;">'+h.icon+'</span>';
    html += '<span style="font-size:clamp(.8rem,3.2vw,.88rem);font-weight:500;color:var(--text);">'+h.name+'</span>';
    html += '<span style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--brand);margin-left:auto;font-weight:400;">'+h.level+'</span>';
    html += '</div>';
    html += '<div style="font-size:clamp(.74rem,2.9vw,.8rem);color:var(--text3);line-height:1.6;padding-left:28px;">'+h.desc+'</div>';
    html += '</div>';
  });
  html += '</div></div>';
  }

  if (insightsView === 'reports' && cycleLengths.length >= 2) {
    html += '<div class="card"><div style="padding:16px 16px 14px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:12px;">cycle length history</div>';
    cycleLengths.forEach(function(len, i) {
      var barPct = Math.round((len / (longestCycle + 5)) * 100);
      var barColor = len < avgLen - 2 ? '#e8a09a' : len > avgLen + 2 ? '#c0b4e0' : '#a8d4b4';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
      html += '<span style="font-size:clamp(.66rem,2.5vw,.72rem);color:var(--text3);width:36px;flex-shrink:0;">cycle '+(i+1)+'</span>';
      html += '<div style="flex:1;background:var(--bg2);border-radius:4px;height:8px;overflow:hidden;">';
      html += '<div style="width:'+barPct+'%;height:100%;background:'+barColor+';border-radius:4px;transition:width .4s;"></div>';
      html += '</div>';
      html += '<span style="font-size:clamp(.7rem,2.7vw,.76rem);color:var(--text);width:28px;text-align:right;flex-shrink:0;">'+len+'d</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  pane.innerHTML = html;
}

function renderInsightsViewToggle() {
  var views = [
    { id:'overview', label:'overview' },
    { id:'patterns', label:'patterns' },
    { id:'reports', label:'reports' }
  ];
  if (insightsView === 'plan') insightsView = 'overview';
  var html = '<div class="card" style="margin-bottom:14px;"><div style="padding:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">';
  views.forEach(function(v) {
    var active = insightsView === v.id;
    html += '<button onclick="setInsightsView(\'' + v.id + '\')" style="border:1px solid ' + (active ? 'var(--brand)' : 'var(--bg2)') + ';background:' + (active ? 'var(--brand)' : 'transparent') + ';color:' + (active ? '#fff' : 'var(--text3)') + ';border-radius:18px;padding:8px 4px;font-family:Jost,sans-serif;font-size:clamp(.62rem,2.4vw,.7rem);letter-spacing:.04em;text-transform:lowercase;cursor:pointer;">' + v.label + '</button>';
  });
  html += '</div></div>';
  return html;
}

function setInsightsView(view) {
  insightsView = view || 'overview';
  renderInsights();
  var pane = document.getElementById('tab-content');
  if (pane) pane.scrollTop = 0;
}

function getMoodPatterns() {
  var moodCount = {};
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!log) return;
    var emojis = [];
    try { emojis = typeof log.mood_emoji === 'string' ? JSON.parse(log.mood_emoji) : (log.mood_emoji || []); } catch(e) {}
    if (!emojis.length) return;
    var dDate = new Date(d + 'T00:00:00');
    var dCycleDay = 1;
    if (appState.cycleStarts && appState.cycleStarts.length) {
      var starts = appState.cycleStarts.map(function(s){return s.start_date;}).sort();
      var closest = null;
      starts.forEach(function(s){
        var sd = new Date(s+'T00:00:00');
        if (sd <= dDate && (!closest || sd > new Date(closest+'T00:00:00'))) closest = s;
      });
      if (closest) dCycleDay = Math.floor((dDate - new Date(closest+'T00:00:00'))/86400000) + 1;
    }
    var pName = getPhase(dCycleDay, appState.profile.cycle_len || 28).name;
    emojis.forEach(function(e) {
      if (!moodCount[e]) moodCount[e] = { count: 0, phases: {} };
      moodCount[e].count++;
      moodCount[e].phases[pName] = (moodCount[e].phases[pName] || 0) + 1;
    });
  });
  var result = [];
  Object.keys(moodCount).forEach(function(e) {
    var phases = Object.keys(moodCount[e].phases).sort(function(a,b){ return moodCount[e].phases[b]-moodCount[e].phases[a]; });
    result.push({ emoji: e, label: e, count: moodCount[e].count, phases: phases });
  });
  result.sort(function(a,b){ return b.count - a.count; });
  return result.slice(0, 6);
}

function getCurrentCycleDateRange() {
  var start = getCurrentCycleStart();
  if (!start) return [];
  var dates = Object.keys(appState.dayLogs || {}).filter(function(d) { return d >= start && d <= todayStr() && hasRecordedDayLog(appState.dayLogs[d]); }).sort();
  return dates;
}

function getCycleWindows() {
  var starts = (appState.cycleStarts || []).map(function(s) { return s.start_date; }).filter(Boolean).sort();
  var windows = [];
  starts.forEach(function(start, i) {
    var end = starts[i + 1] ? addDays(starts[i + 1], -1) : todayStr();
    windows.push({ start:start, end:end });
  });
  return windows;
}

function summarizeWindow(start, end) {
  var dates = Object.keys(appState.dayLogs || {}).filter(function(d) {
    return d >= start && d <= end && hasRecordedDayLog(appState.dayLogs[d]);
  }).sort();
  var symptoms = 0, symptomCounts = {}, sleepGreat = 0, waterTotal = 0, waterDays = 0, moods = {};
  dates.forEach(function(d) {
    var log = appState.dayLogs[d] || {};
    var syms = []; try { syms = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : (log.symptoms || []); } catch(e) {}
    symptoms += syms.length;
    syms.forEach(function(s) { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
    if (log.sleep === 'great' || log.sleep === 'amazing') sleepGreat++;
    if (Number(log.water || 0) > 0) { waterTotal += Number(log.water || 0); waterDays++; }
    var words = []; try { words = typeof log.mood_words === 'string' ? JSON.parse(log.mood_words) : (log.mood_words || []); } catch(e) {}
    words.forEach(function(m) { moods[m] = (moods[m] || 0) + 1; });
  });
  function top(obj) {
    return Object.keys(obj).sort(function(a,b) { return obj[b] - obj[a]; })[0] || '';
  }
  return {
    start:start,
    end:end,
    loggedDays:dates.length,
    symptomCount:symptoms,
    topSymptom:top(symptomCounts),
    topMood:top(moods),
    sleepGreat:sleepGreat,
    avgWater:waterDays ? Math.round(waterTotal / waterDays) : 0
  };
}

function renderPredictionConfidenceCard(cycleLengths, totalDays, fertilitySummary) {
  var score = 20;
  if (cycleLengths.length >= 1) score += 20;
  if (cycleLengths.length >= 3) score += 20;
  if (totalDays >= 7) score += 15;
  if (totalDays >= 21) score += 10;
  if (fertilitySummary && fertilitySummary.likelyDate) score += fertilitySummary.confidence === 'high' ? 15 : 8;
  score = Math.min(95, score);
  var label = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'early';
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">prediction confidence</div>';
  html += '<div class="insight-mini-title">' + label + ' · ' + score + '%</div>';
  html += '<div style="background:var(--bg2);border-radius:6px;height:6px;overflow:hidden;margin:8px 0 10px;"><div style="width:'+score+'%;height:100%;background:var(--brand);border-radius:6px;"></div></div>';
  html += '<div class="insight-mini-body">' + (score < 50 ? 'Still learning. Add cycle starts and a few more daily logs before trusting timing closely.' : 'Based on cycle history, logged days, and fertility signs when available.') + '</div>';
  html += '</div>';
  return html;
}

function renderBackupReminderCard() {
  var last = appState.profile && appState.profile.last_backup_date;
  var shouldShow = false;
  if (!last) shouldShow = getLoggedDayCount() >= 3;
  else {
    var days = Math.floor((new Date(todayStr() + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000);
    shouldShow = days >= 30;
  }
  if (!shouldShow) return '';
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">local data safety</div>';
  html += '<div class="insight-mini-title">time for a private backup</div>';
  html += '<div class="insight-mini-body">This app stores data on this device. Exporting a backup protects your logs if browser storage is cleared.</div>';
  html += '<button class="btn-sm" onclick="exportData()" style="margin-top:10px;">export backup</button>';
  html += '</div>';
  return html;
}

function renderFirstWeekInsightsCard(totalDays, cyclesLogged) {
  if (totalDays >= 7 && cyclesLogged) return '';
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">getting started</div>';
  html += '<div class="insight-mini-title">your first week unlocks better reads</div>';
  html += '<div class="insight-mini-body">For now, insights stay conservative. Log cycle start, sleep, mood, symptoms, and notes for a few days to personalize patterns.</div>';
  html += '<div class="insight-mini-meta">' + totalDays + '/7 starter days logged · ' + cyclesLogged + ' cycle start' + (cyclesLogged===1?'':'s') + '</div>';
  html += '</div>';
  return html;
}

function renderCycleComparisonCard() {
  var windows = getCycleWindows();
  if (windows.length < 2) return '';
  var current = summarizeWindow(windows[windows.length - 1].start, windows[windows.length - 1].end);
  var previous = summarizeWindow(windows[windows.length - 2].start, windows[windows.length - 2].end);
  if (!current.loggedDays || !previous.loggedDays) return '';
  function diffLine(label, now, then, suffix) {
    var diff = now - then;
    var text = diff === 0 ? 'about the same' : (diff > 0 ? '+' + diff : String(diff)) + (suffix || '');
    return '<div class="insight-row"><span>' + label + '</span><strong>' + text + '</strong></div>';
  }
  var html = '<div class="card"><div style="padding:16px 16px 4px;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.05rem,4.2vw,1.25rem);font-weight:400;color:var(--brand);">What changed this cycle?</div></div><div style="padding:4px 0 10px;">';
  html += diffLine('logged days', current.loggedDays, previous.loggedDays);
  html += diffLine('symptom entries', current.symptomCount, previous.symptomCount);
  html += diffLine('good sleep days', current.sleepGreat, previous.sleepGreat);
  html += diffLine('avg water', current.avgWater, previous.avgWater, '/8');
  html += '</div>';
  if (current.topSymptom || current.topMood) html += '<div class="insight-mini-meta" style="padding:0 16px 14px;">this cycle: ' + (current.topSymptom ? 'top symptom ' + current.topSymptom : '') + (current.topSymptom && current.topMood ? ' · ' : '') + (current.topMood ? 'top mood ' + current.topMood : '') + '</div>';
  html += '</div>';
  return html;
}

function renderPMSCarePlanCard(daysUntil, nextPeriodStr) {
  var countdown = getPMSCountdown();
  var inWindow = countdown.inLuteal && countdown.daysUntilPeriod <= (appState.profile.pms_notice_days || 3) && countdown.daysUntilPeriod >= 0;
  if (!inWindow && daysUntil > (appState.profile.pms_notice_days || 3)) return '';
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">pre-period care plan</div>';
  html += '<div class="insight-mini-title">' + (nextPeriodStr ? 'support before ' + nextPeriodStr : 'support the luteal landing') + '</div>';
  html += '<div class="flag-row">today: stabilize blood sugar with protein, minerals, and enough food</div>';
  html += '<div class="flag-row">tomorrow: protect sleep, reduce overstimulation, and simplify commitments</div>';
  html += '<div class="flag-row">day before: warmth, magnesium-rich foods, gentle movement, and fewer open loops</div>';
  html += '<div class="insight-mini-meta">Educational support only. Persistent or severe PMS deserves qualified care.</div>';
  html += '</div>';
  return html;
}

function renderMonthlyBodyReportCard() {
  var now = new Date();
  var start = dateToString(new Date(now.getFullYear(), now.getMonth(), 1));
  var end = dateToString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  var summary = summarizeWindow(start, end);
  if (summary.loggedDays < 3) return '';
  var html = '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">monthly body report</div>';
  html += '<div class="insight-mini-title">' + summary.loggedDays + ' logged day' + (summary.loggedDays===1?'':'s') + ' this month</div>';
  html += '<div class="insight-mini-body">Your month is beginning to show a body pattern: ' + (summary.topSymptom ? summary.topSymptom + ' came up most often' : 'symptoms were quiet or not logged often') + (summary.topMood ? ', and ' + summary.topMood + ' was a common mood.' : '.') + '</div>';
  html += '<button class="btn-sm" onclick="exportCycleReport()" style="margin-top:10px;">export monthly report</button>';
  html += '</div>';
  return html;
}

function renderCycleRecapCard() {
  var dates = getCurrentCycleDateRange();
  var cycleDay = getCycleDay();
  var symptomCounts = {};
  var moodCounts = {};
  var done = 0, totalTasks = 0, habitDone = 0;
  dates.forEach(function(d) {
    var log = appState.dayLogs[d] || {};
    var syms = []; try { syms = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : (log.symptoms || []); } catch(e) {}
    syms.forEach(function(s) { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
    var moods = []; try { moods = typeof log.mood_words === 'string' ? JSON.parse(log.mood_words) : (log.mood_words || []); } catch(e) {}
    moods.forEach(function(m) { moodCounts[m] = (moodCounts[m] || 0) + 1; });
    var tasks = []; try { tasks = typeof log.tasks === 'string' ? JSON.parse(log.tasks) : (log.tasks || []); } catch(e) {}
    totalTasks += tasks.length;
    done += tasks.filter(function(t) { return t.done; }).length;
    var habits = appState.habitLogs && appState.habitLogs[d] ? appState.habitLogs[d] : {};
    habitDone += Object.keys(habits).filter(function(k) { return habits[k]; }).length;
  });
  function topKey(obj) {
    return Object.keys(obj).sort(function(a,b) { return obj[b] - obj[a]; })[0] || 'not enough data yet';
  }
  var fertility = getFertilitySignalSummary();
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:5px;">current cycle recap</div>';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.15rem,4.8vw,1.35rem);color:var(--text);margin-bottom:10px;">day ' + cycleDay + ' · ' + dates.length + ' logged day' + (dates.length===1?'':'s') + '</div>';
  html += '<div class="recap-grid">';
  html += '<div><span>top symptom</span><strong>' + topKey(symptomCounts) + '</strong></div>';
  html += '<div><span>top mood</span><strong>' + topKey(moodCounts) + '</strong></div>';
  html += '<div><span>tasks done</span><strong>' + done + '/' + totalTasks + '</strong></div>';
  html += '<div><span>habits checked</span><strong>' + habitDone + '</strong></div>';
  html += '</div>';
  if (fertility.likelyDate) html += '<div class="insight-mini-meta">likely ovulation: cycle day ' + fertility.likelyDay + ' · ' + fertility.evidence + '</div>';
  html += '</div></div>';
  return html;
}

function renderCycleHealthFlags() {
  var flags = [];
  var lengths = getCycleLengthHistory();
  lengths.forEach(function(len) {
    if (len < 21) flags.push('one cycle was shorter than 21 days');
    if (len > 35) flags.push('one cycle was longer than 35 days');
  });
  if (lengths.length >= 3) {
    var shortest = Math.min.apply(null, lengths);
    var longest = Math.max.apply(null, lengths);
    if (longest - shortest >= 9) flags.push('cycle length has varied by 9+ days');
  }
  var periodLen = appState.profile.period_len || 5;
  if (periodLen > 7) flags.push('typical bleeding is longer than 7 days');
  var heavyDays = 0;
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (log && log.flow === 'spotting') flags.push('spotting has been logged');
    if (log && log.flow === 'heavy') heavyDays++;
  });
  if (heavyDays >= 3) flags.push('heavy flow has been logged on multiple days');
  var pms = getSymptomPatterns().filter(function(p) {
    return ['pms mood swings','anxiety/irritability','breast tenderness','lower back pain'].indexOf(p.symptom) > -1 && p.count >= 2;
  });
  if (pms.length) flags.push('recurring luteal/PMS symptoms are worth watching');
  flags = flags.filter(function(f,i) { return flags.indexOf(f) === i; });
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">cycle health notes</div>';
  if (!flags.length) {
    html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text3);line-height:1.6;">No gentle flags yet. Keep logging cycle starts, flow, symptoms, and fertility signs to build a clearer picture.</div>';
  } else {
    flags.slice(0,4).forEach(function(f) {
      html += '<div class="flag-row">worth noticing: ' + f + '</div>';
    });
    html += '<div class="insight-mini-meta">This is educational, not diagnostic. Bring recurring concerns to a qualified clinician.</div>';
  }
  html += '</div></div>';
  return html;
}

function renderWeekPlanCard() {
  var planner = getWeeklyPlanner();
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">cycle-aware weekly planner</div>';
  html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text3);line-height:1.55;margin-bottom:10px;">Place work where your cycle is most likely to support it. This is guidance, not a rule.</div>';
  for (var i = 0; i < 7; i++) {
    var d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i);
    var ds = dateToString(d);
    var cday = getCycleDayForDate(ds);
    var ph = getPhase(cday, getPredictionCycleLength());
    var suggestions = getTaskSet()[ph.name] || [];
    var dayItems = planner[ds] || [];
    var tip = {
      menstrual: 'protect energy + simplify',
      follicular: 'start, learn, brainstorm',
      ovulatory: 'connect, pitch, be seen',
      luteal: 'finish, edit, prepare'
    }[ph.name];
    var heavy = ph.name === 'luteal' && dayItems.length >= 4;
    html += '<div style="padding:12px 0;border-bottom:1px solid var(--bg2);">';
    html += '<div style="display:grid;grid-template-columns:58px 82px 1fr;gap:8px;align-items:center;margin-bottom:8px;">';
    html += '<span style="font-size:.72rem;color:var(--text3);text-transform:lowercase;">' + (i===0?'today':formatCycleRangeDate(ds)) + '</span>';
    html += '<strong style="font-size:.78rem;color:var(--brand);font-weight:500;">' + ph.moon + ' day ' + cday + '</strong>';
    html += '<em style="font-size:.76rem;color:var(--text2);font-style:normal;line-height:1.35;">' + tip + '</em>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-bottom:7px;">';
    html += '<input id="week-plan-input-' + ds + '" placeholder="plan a task for this day..." style="min-width:0;width:100%;border:1px solid var(--bg2);border-radius:18px;padding:9px 11px;background:var(--bg);color:var(--text);font-size:.76rem;">';
    html += '<button class="btn-sm" onclick="addWeekPlanItem(\'' + ds + '\')" style="padding:8px 12px;font-size:.68rem;border-radius:18px;">add</button>';
    html += '</div>';
    if (suggestions.length) {
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:3px 0 2px;">';
      suggestions.slice(0,2).forEach(function(s) {
        html += '<button class="btn-sm" onclick="addWeekPlanSuggestion(\'' + ds + '\',\'' + s.replace(/'/g,"\\'") + '\')" style="padding:5px 8px;font-size:.62rem;background:transparent;color:var(--text3);border:1px dashed var(--bg2);">+ ' + escapeHabitText(s) + '</button>';
      });
      html += '</div>';
    }
    if (dayItems.length) {
      html += '<div style="margin-top:7px;">';
      dayItems.forEach(function(item, idx) {
        html += '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-top:1px solid var(--bg2);">';
        html += '<span style="flex:1;font-size:.74rem;color:var(--text2);">' + escapeHabitText(item.text) + '</span>';
        html += '<span style="font-size:.62rem;color:var(--text3);">' + getTaskEnergyLabel(item.energy) + '</span>';
        html += '<button onclick="removeWeekPlanItem(\'' + ds + '\',' + idx + ')" style="border:none;background:transparent;color:var(--text3);cursor:pointer;">&#215;</button>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (heavy) html += '<div class="flag-row" style="margin-top:6px;">load check: this may be a lot for luteal. Consider moving one item earlier or softening it.</div>';
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function getWeeklyPlanner() {
  var cs = appState.customSettings || {};
  if (!cs.week_plan) return {};
  try { return typeof cs.week_plan === 'string' ? JSON.parse(cs.week_plan) : cs.week_plan; } catch(e) { return {}; }
}

function saveWeeklyPlanner(planner) {
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.week_plan = planner || {};
  lsSet('customSettings', appState.customSettings);
  showSync('saved');
}

function addWeekPlanItem(dateStr) {
  var input = document.getElementById('week-plan-input-' + dateStr);
  if (!input || !input.value.trim()) return;
  var planner = getWeeklyPlanner();
  if (!planner[dateStr]) planner[dateStr] = [];
  var text = input.value.trim().toLowerCase();
  planner[dateStr].push({ text: text, energy: inferTaskEnergy(text) });
  saveWeeklyPlanner(planner);
  refreshTasksUI();
}

function addWeekPlanSuggestion(dateStr, text) {
  var planner = getWeeklyPlanner();
  if (!planner[dateStr]) planner[dateStr] = [];
  if (!planner[dateStr].some(function(item) { return item.text === text; })) {
    planner[dateStr].push({ text: text, energy: inferTaskEnergy(text) });
  }
  saveWeeklyPlanner(planner);
  refreshTasksUI();
}

function removeWeekPlanItem(dateStr, index) {
  var planner = getWeeklyPlanner();
  if (!planner[dateStr]) return;
  planner[dateStr].splice(index, 1);
  if (!planner[dateStr].length) delete planner[dateStr];
  saveWeeklyPlanner(planner);
  refreshTasksUI();
}

function renderTaskCompletionInsightsCard() {
  var stats = {};
  var totalDone = 0;
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!log || !log.tasks) return;
    var tasks = []; try { tasks = typeof log.tasks === 'string' ? JSON.parse(log.tasks) : (log.tasks || []); } catch(e) {}
    var phaseName = getPhase(getCycleDayForDate(d), appState.profile.cycle_len || 28).name;
    tasks.forEach(function(t) {
      if (!t.done) return;
      normalizeTask(t);
      totalDone++;
      var key = phaseName + '|' + (t.energy || 'low');
      if (!stats[key]) stats[key] = { phase: phaseName, energy: t.energy || 'low', count: 0 };
      stats[key].count++;
    });
  });
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">cycle-aligned work reads</div>';
  if (totalDone < 3) {
    html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text3);line-height:1.6;">Complete a few tagged tasks to learn which kinds of work fit each phase best.</div>';
  } else {
    var rows = Object.keys(stats).map(function(k) { return stats[k]; }).sort(function(a,b) { return b.count - a.count; });
    rows.slice(0,3).forEach(function(row) {
      html += '<div class="pattern-read">You complete ' + getTaskEnergyLabel(row.energy) + ' tasks most often in ' + row.phase + ' (' + row.count + ' done).</div>';
    });
    html += '<div class="insight-mini-meta">Use this as planning context, not a productivity rule. Capacity still changes with sleep, symptoms, life, and pregnancy.</div>';
  }
  html += '</div></div>';
  return html;
}

function simpleHash(text) {
  var hash = 0;
  text = String(text || '');
  for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
  return 'p_' + Math.abs(hash);
}

function getSavedPatternLibrary() {
  var raw = appState.profile && appState.profile.pattern_library;
  if (!raw) return [];
  if (typeof raw === 'string') { try { return JSON.parse(raw) || []; } catch(e) { return []; } }
  return Array.isArray(raw) ? raw : [];
}

function savePatternLibrary(patterns) {
  appState.profile.pattern_library = patterns || [];
  lsSet('appSettings', appState.profile);
  showSync('saved');
}

function getPatternCandidates() {
  return getAdvancedPatternInsights().concat(getTaskPatternInsights()).map(function(text) {
    return { id: simpleHash(text), text: text, type: text.indexOf('tasks') > -1 ? 'work' : 'body' };
  });
}

function getTaskPatternInsights() {
  var phaseEnergy = {};
  var phaseTotals = {};
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!log || !log.tasks) return;
    var tasks = []; try { tasks = typeof log.tasks === 'string' ? JSON.parse(log.tasks) : (log.tasks || []); } catch(e) {}
    var phaseName = getPhase(getCycleDayForDate(d), appState.profile.cycle_len || 28).name;
    tasks.forEach(function(t) {
      if (!t.done) return;
      normalizeTask(t);
      phaseTotals[phaseName] = (phaseTotals[phaseName] || 0) + 1;
      var key = phaseName + '|' + (t.energy || 'low');
      phaseEnergy[key] = (phaseEnergy[key] || 0) + 1;
    });
  });
  var result = [];
  Object.keys(phaseEnergy).forEach(function(key) {
    if (phaseEnergy[key] < 2) return;
    var parts = key.split('|');
    result.push('Pattern: ' + getTaskEnergyLabel(parts[1]) + ' tasks are getting completed most often in ' + parts[0] + ' (' + phaseEnergy[key] + ' done).');
  });
  Object.keys(phaseTotals).forEach(function(phaseName) {
    if (phaseTotals[phaseName] >= 4) result.push('Pattern: your completed task volume is strongest in ' + phaseName + ' (' + phaseTotals[phaseName] + ' tasks done).');
  });
  return result.slice(0, 5);
}

function savePatternCandidate(patternId) {
  var candidates = getPatternCandidates();
  var match = candidates.filter(function(p) { return p.id === patternId; })[0];
  if (!match) return;
  var saved = getSavedPatternLibrary();
  if (!saved.some(function(p) { return p.id === match.id; })) {
    saved.push({ id: match.id, text: match.text, type: match.type, saved_at: todayStr() });
    savePatternLibrary(saved);
  }
  renderInsights();
}

function removeSavedPattern(patternId) {
  savePatternLibrary(getSavedPatternLibrary().filter(function(p) { return p.id !== patternId; }));
  renderInsights();
}

function renderPatternLibraryCard() {
  var saved = getSavedPatternLibrary();
  var candidates = getPatternCandidates().filter(function(c) {
    return !saved.some(function(s) { return s.id === c.id; });
  });
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">pattern library</div>';
  if (!saved.length && !candidates.length) {
    html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text3);line-height:1.6;">As patterns become clearer, you can save them here as your personal “rules of me.”</div>';
  }
  saved.forEach(function(p) {
    html += '<div class="pattern-read" style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between;">';
    html += '<span>' + escapeHabitText(p.text) + '</span>';
    html += '<button onclick="removeSavedPattern(\'' + p.id + '\')" style="border:none;background:transparent;color:var(--text3);cursor:pointer;">&#215;</button>';
    html += '</div>';
  });
  if (candidates.length) {
    html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);margin:10px 0 6px;">new patterns to save</div>';
    candidates.slice(0,3).forEach(function(p) {
      html += '<div class="flag-row" style="margin-bottom:8px;">';
      html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text2);line-height:1.55;margin-bottom:7px;">' + escapeHabitText(p.text) + '</div>';
      html += '<button class="btn-sm" onclick="savePatternCandidate(\'' + p.id + '\')" style="padding:6px 10px;font-size:.66rem;">save pattern</button>';
      html += '</div>';
    });
  }
  html += '</div></div>';
  return html;
}

function renderSmartPatternInsights() {
  var insights = getAdvancedPatternInsights();
  var html = '<div class="card"><div style="padding:16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">smarter pattern reads</div>';
  if (!insights.length) {
    html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text3);line-height:1.6;">Log across a few more days to reveal timing patterns like “headaches before period” or “anxiety in late luteal.”</div>';
  } else {
    insights.slice(0,5).forEach(function(txt) { html += '<div class="pattern-read">' + txt + '</div>'; });
  }
  html += '</div></div>';
  return html;
}

function getAdvancedPatternInsights() {
  var rows = [];
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!hasRecordedDayLog(log)) return;
    var cday = getCycleDayForDate(d);
    var daysToPeriod = (getPredictionCycleLength() || 28) - cday;
    var syms = []; try { syms = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : (log.symptoms || []); } catch(e) {}
    var moods = []; try { moods = typeof log.mood_words === 'string' ? JSON.parse(log.mood_words) : (log.mood_words || []); } catch(e) {}
    var details = getSymptomDetails(log);
    syms.forEach(function(item) { rows.push({ item:item, cday:cday, daysToPeriod:daysToPeriod, phase:getPhase(cday, getPredictionCycleLength()).name, severity:(details[item] && details[item].severity) || '', duration:(details[item] && details[item].duration) || '' }); });
    moods.forEach(function(item) { rows.push({ item:item, cday:cday, daysToPeriod:daysToPeriod, phase:getPhase(cday, getPredictionCycleLength()).name, severity:'', duration:'' }); });
  });
  var grouped = {};
  rows.forEach(function(r) {
    if (!grouped[r.item]) grouped[r.item] = [];
    grouped[r.item].push(r);
  });
  var result = [];
  Object.keys(grouped).forEach(function(item) {
    var arr = grouped[item];
    if (arr.length < 2) return;
    var late = arr.filter(function(r) { return r.daysToPeriod >= 0 && r.daysToPeriod <= 4; }).length;
    if (late >= 2) result.push((late >= 3 ? 'Pattern: ' : 'Possible pattern: ') + item + ' shows up in the 0-4 days before your predicted period (' + late + ' logs).');
    var intense = arr.filter(function(r) { return r.severity === 'intense'; }).length;
    if (intense >= 2) result.push((intense >= 3 ? 'Pattern: ' : 'Possible pattern: ') + item + ' has been marked intense more than once (' + intense + ' logs).');
    var allDay = arr.filter(function(r) { return r.duration === 'all day'; }).length;
    if (allDay >= 2) result.push((allDay >= 3 ? 'Pattern: ' : 'Possible pattern: ') + item + ' sometimes lasts all day (' + allDay + ' logs).');
    var phaseCounts = {};
    arr.forEach(function(r) { phaseCounts[r.phase] = (phaseCounts[r.phase] || 0) + 1; });
    var top = Object.keys(phaseCounts).sort(function(a,b) { return phaseCounts[b] - phaseCounts[a]; })[0];
    if (top && phaseCounts[top] >= 2) result.push((phaseCounts[top] >= 3 ? 'Pattern: ' : 'Possible pattern: ') + item + ' clusters most in your ' + top + ' phase (' + phaseCounts[top] + ' logs).');
  });
  return result.filter(function(v,i) { return result.indexOf(v) === i; });
}

function getHormoneData(phaseName) {
  var data = {
    menstrual: [
      { icon:'🩸', name: 'Estrogen', level: '↓ at its lowest', desc: 'Both estrogen and progesterone are at rock bottom — this is what triggers the uterine lining to shed. Low estrogen contributes to fatigue, emotional sensitivity, and the deep pull toward stillness and solitude.' },
      { icon:'🔻', name: 'Progesterone', level: '↓ falling sharply', desc: 'The dramatic drop in progesterone is the direct cause of your period beginning. As it falls, serotonin and dopamine dip with it, which is why mood can feel tender or low right before and during day 1 and 2.' },
      { icon:'🌱', name: 'FSH (Follicle-Stimulating Hormone)', level: '↑ beginning to rise', desc: 'The pituitary gland begins secreting FSH to recruit the next dominant follicle. This subtle hormonal stirring is what eventually leads to the rising energy you\'ll feel in the follicular phase.' },
      { icon:'🔥', name: 'Prostaglandins', level: '⬆ elevated', desc: 'These inflammatory compounds cause uterine contractions to help expel the lining — they are the direct source of cramping. Omega-3s, magnesium, and heat therapy help counteract excess prostaglandin production.' }
    ],
    follicular: [
      { icon:'✨', name: 'Estrogen', level: '↑ climbing steadily', desc: 'Rising estrogen is the star of this phase. It rebuilds the uterine lining, enhances brain function and memory, boosts serotonin and dopamine, and creates the light, motivated, social feeling that defines follicular energy.' },
      { icon:'🌸', name: 'FSH', level: '↑ actively stimulating', desc: 'FSH continues driving follicle development in the ovaries, selecting the dominant follicle that will eventually release an egg. This process takes around 10–14 days and builds in intensity.' },
      { icon:'⚡', name: 'Testosterone', level: '↑ gently rising', desc: 'A subtle but meaningful rise in testosterone adds drive, assertiveness, and creative confidence. You may notice you want to initiate more — conversations, projects, physical movement.' },
      { icon:'🌿', name: 'Progesterone', level: '→ low, minimal', desc: 'Progesterone stays quiet this phase, which is part of why the body feels so unencumbered and light. There is no hormonal drag on energy or mood — this is the cleanest hormonal window of the cycle.' }
    ],
    ovulatory: [
      { icon:'🌊', name: 'LH (Luteinizing Hormone)', level: '🔺 surging', desc: 'The LH surge is the signal that triggers egg release from the dominant follicle. It happens rapidly — within 24–36 hours — and marks the opening of the fertile window. Ovulation tests detect this surge.' },
      { icon:'🌞', name: 'Estrogen', level: '🔺 peaks, then drops', desc: 'Estrogen hits its absolute peak just before ovulation, contributing to the radiant, magnetic, highly verbal quality of ovulatory energy. It then drops sharply immediately after ovulation, which some people feel as a brief post-ovulation energy dip.' },
      { icon:'💫', name: 'Testosterone', level: '🔺 at its peak', desc: 'Testosterone peaks alongside estrogen, and together these hormones create the signature ovulatory qualities: high libido, physical confidence, charisma, and a genuine desire to be seen and heard.' },
      { icon:'🌙', name: 'Progesterone', level: '↑ beginning to rise', desc: 'After ovulation, the ruptured follicle (now called the corpus luteum) begins producing progesterone. This rise signals the transition from ovulatory to luteal phase and prepares the uterine lining for potential implantation.' }
    ],
    luteal: [
      { icon:'🌒', name: 'Progesterone', level: '🔺 dominant hormone', desc: 'Progesterone rules this phase. It creates warmth, a nesting instinct, heightened body temperature (which is why BBT rises post-ovulation), bloating, and breast tenderness. When it drops at the end, it triggers both PMS and the next period.' },
      { icon:'🍂', name: 'Estrogen', level: '↑ secondary peak, then falls', desc: 'A smaller second estrogen rise occurs in early luteal, then both estrogen and progesterone fall sharply in late luteal if pregnancy doesn\'t occur. This double drop is the hormonal driver of PMS symptoms.' },
      { icon:'☁️', name: 'Serotonin', level: '↓ declining in late phase', desc: 'Falling progesterone reduces serotonin synthesis. This is the biochemical root of late-luteal mood changes — irritability, anxiety, food cravings (especially for carbs and chocolate, which temporarily boost serotonin).' },
      { icon:'🔋', name: 'Dopamine', level: '↓ declining', desc: 'Lower dopamine in late luteal explains the decreased motivation and difficulty starting new things. This is your body\'s intelligent push to complete and close rather than initiate — finishing tasks feels more natural than beginning them.' }
    ]
  };
  return data[phaseName] || data.menstrual;
}

function getSymptomPatterns() {
  var phaseCounts = {};
  var totalCounts = {};
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!log || !log.symptoms) return;
    var syms;
    try { syms = typeof log.symptoms === 'string' ? JSON.parse(log.symptoms) : log.symptoms; } catch(e) { return; }
    if (!syms || !syms.length) return;
    var dDate = new Date(d + 'T00:00:00');
    var dCycleDay = 1;
    if (appState.cycleStarts && appState.cycleStarts.length) {
      var starts = appState.cycleStarts.map(function(s) { return s.start_date; }).sort();
      var closest = null;
      starts.forEach(function(s) {
        var sDate = new Date(s + 'T00:00:00');
        if (sDate <= dDate && (!closest || sDate > new Date(closest + 'T00:00:00'))) closest = s;
      });
      if (closest) dCycleDay = Math.floor((dDate - new Date(closest + 'T00:00:00')) / 86400000) + 1;
    }
    var pName = getPhase(dCycleDay, appState.profile.cycle_len || 28).name;
    syms.forEach(function(s) {
      if (!phaseCounts[s]) phaseCounts[s] = {};
      phaseCounts[s][pName] = (phaseCounts[s][pName] || 0) + 1;
      totalCounts[s] = (totalCounts[s] || 0) + 1;
    });
  });

  var result = Object.keys(phaseCounts).map(function(sym) {
    var phases = Object.keys(phaseCounts[sym]).sort(function(a,b) {
      return phaseCounts[sym][b] - phaseCounts[sym][a];
    });
    return { symptom: sym, phases: phases, count: totalCounts[sym] || 0 };
  });
  result.sort(function(a,b){ return b.count - a.count; });
  return result.slice(0, 10);
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
function openSettings() {
  closeProfileMenu();
  renderSettings();
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

function renderSettings() {
  var profile = appState.profile;
  var cs = appState.customSettings || {};
  var html = '';

  // Profile
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">profile</div>';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">app name</label>';
  html += '<input class="settings-input" id="set-appname" value="' + (profile.app_name||'') + '">';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">greeting</label>';
  html += '<input class="settings-input" id="set-greeting" value="' + (profile.greeting||'') + '">';
  html += '</div>';

  // Cycle + tracking
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">cycle + tracking</div>';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">cycle length</label>';
  html += '<input class="settings-input" id="set-cyclelen" type="number" min="21" max="35" value="' + (profile.cycle_len||28) + '">';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">typical bleed length</label>';
  html += '<input class="settings-input" id="set-periodlen" type="number" min="2" max="10" value="' + (profile.period_len||5) + '">';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">cycle goal</label>';
  html += '<select class="settings-input" id="set-cyclegoal">';
  ['body literacy','cycle support','symptom patterns','fertility awareness','trying to conceive'].forEach(function(g) {
    html += '<option value="' + g + '"' + ((profile.cycle_goal||'body literacy')===g?' selected':'') + '>' + g + '</option>';
  });
  html += '</select>';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">fertility signs tracker</label>';
  html += '<select class="settings-input" id="set-fertilitytracking">';
  html += '<option value="yes"' + (profile.fertility_tracking !== false ? ' selected' : '') + '>show on home + log</option>';
  html += '<option value="no"' + (profile.fertility_tracking === false ? ' selected' : '') + '>hide for now</option>';
  html += '</select>';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">pregnancy mode</label>';
  html += '<select class="settings-input" id="set-pregnant" onchange="togglePregnancyDueSetting()">';
  html += '<option value="no"' + (!profile.pregnant ? ' selected' : '') + '>off - use cycle predictions</option>';
  html += '<option value="yes"' + (profile.pregnant ? ' selected' : '') + '>on - pause cycle predictions</option>';
  html += '</select>';
  html += '<div id="pregnancy-due-wrap" style="display:' + (profile.pregnant ? 'block' : 'none') + ';">';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:4px;">estimated due date <span style="color:var(--text3);">(optional)</span></label>';
  html += '<input class="settings-input" id="set-pregnancy-due" type="date" value="' + (profile.pregnancy_due_date||'') + '">';
  html += '</div>';
  html += '<button class="save-btn" onclick="saveBasicSettings()">save</button>';
  html += '</div>';

  // Display preferences
  var dm = profile.dark_mode_pref || 'auto';
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">display</div>';
  html += '<label style="font-size:.78rem;color:var(--text3);display:block;margin-bottom:8px;">dark mode</label>';
  html += '<div style="display:flex;gap:6px;">';
  [{v:'auto',l:'auto (phase)'},{v:'always',l:'always'},{v:'off',l:'light only'}].forEach(function(o){
    var act = dm === o.v;
    html += '<button data-pref="'+o.v+'" onclick="setDarkModePref(this.dataset.pref)" style="flex:1;padding:8px 4px;border-radius:20px;border:1.5px solid '+(act?'var(--brand)':'var(--bg2)')+';background:'+(act?'var(--brand)':'transparent')+';color:'+(act?'#fff':'var(--text3)')+';font-size:clamp(.62rem,2.4vw,.7rem);cursor:pointer;font-family:Jost,sans-serif;">'+o.l+'</button>';
  });
  html += '</div>';
  html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);margin-top:8px;line-height:1.5;">auto: dark for menstrual &#127761; and luteal &#127767;</div>';
  html += '</div>';

  // Data + backup
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">data + backup</div>';
  html += '<button onclick="exportData()" style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:1px solid var(--bg2);background:var(--white);color:var(--brand);font-family:Jost,sans-serif;font-size:.82rem;text-align:left;cursor:pointer;margin-bottom:8px;">export private backup</button>';
  html += '<button onclick="importData()" style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:1px solid var(--bg2);background:var(--white);color:var(--text2);font-family:Jost,sans-serif;font-size:.82rem;text-align:left;cursor:pointer;">restore from backup</button>';
  html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);margin-top:8px;line-height:1.5;">Data is stored locally on this device. Export regularly if your logs matter to you.</div>';
  html += '</div>';

  // Guidance
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">guidance</div>';
  html += '<button onclick="showMaximizeGuide()" style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:1px solid var(--bg2);background:var(--white);color:var(--brand);font-family:Jost,sans-serif;font-size:.82rem;text-align:left;cursor:pointer;">how to maximize this app</button>';
  html += '<div style="font-size:clamp(.68rem,2.6vw,.74rem);color:var(--text3);margin-top:8px;line-height:1.5;">A quick reference for what to log, where features live, when to trust insights, and how to protect local data.</div>';
  html += '</div>';

  // Mood emojis
  var moodEmojis = getMoodEmojis();
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">customize · mood emojis</div>';
  html += '<div id="set-mood-emoji-list">';
  moodEmojis.forEach(function(e, i) {
    html += '<span class="settings-chip">' + e.emoji + ' ' + e.label;
    html += '<button class="settings-chip-del" onclick="removeMoodEmoji(' + i + ')">✕</button></span>';
  });
  html += '</div>';
  html += '<div class="settings-add-row">';
  html += '<input class="settings-add-input" id="set-new-emoji" placeholder="emoji"  style="max-width:60px;">';
  html += '<input class="settings-add-input" id="set-new-emoji-label" placeholder="label">';
  html += '<button class="btn-sm" onclick="addMoodEmoji()">+</button>';
  html += '</div></div>';

  // Mood words
  var moodWords = getMoodWords();
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">customize · mood words</div>';
  html += '<div id="set-mood-word-list">';
  moodWords.forEach(function(w, i) {
    html += '<span class="settings-chip">' + w;
    html += '<button class="settings-chip-del" onclick="removeMoodWord(' + i + ')">✕</button></span>';
  });
  html += '</div>';
  html += '<div class="settings-add-row">';
  html += '<input class="settings-add-input" id="set-new-word" placeholder="new mood word">';
  html += '<button class="btn-sm" onclick="addMoodWord()">+</button>';
  html += '</div></div>';

  // Custom symptoms
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">customize · symptoms</div>';
  html += '<div class="section-sel">';
  ['general','menstrual','follicular','ovulatory','luteal'].forEach(function(s) {
    html += '<span class="section-sel-opt' + (settingsSymptomTab===s?' active':'') + '" onclick="setSymSection(\'' + s + '\')">' + s + '</span>';
  });
  html += '</div>';
  var customSyms = {};
  if (cs.custom_symptoms) {
    try { customSyms = typeof cs.custom_symptoms === 'string' ? JSON.parse(cs.custom_symptoms) : cs.custom_symptoms; } catch(e) {}
  }
  if (customSyms && customSyms.ovulation && !customSyms.ovulatory) customSyms.ovulatory = customSyms.ovulation;
  var curCustomSyms = (customSyms && customSyms[settingsSymptomTab]) || [];
  html += '<div id="set-sym-list">';
  curCustomSyms.forEach(function(s, i) {
    html += '<span class="settings-chip">' + s.emoji + ' ' + s.name;
    html += '<button class="settings-chip-del" onclick="removeCustomSym(' + i + ')">✕</button></span>';
  });
  html += '</div>';
  html += '<div class="settings-add-row">';
  html += '<input class="settings-add-input" id="set-sym-emoji" placeholder="emoji" style="max-width:60px;">';
  html += '<input class="settings-add-input" id="set-sym-name" placeholder="symptom name">';
  html += '<button class="btn-sm" onclick="addCustomSym()">+</button>';
  html += '</div></div>';

  // Work tasks per phase
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">customize · task suggestions</div>';
  html += '<div class="settings-phase-tabs">';
  ['menstrual','follicular','ovulatory','luteal'].forEach(function(p) {
    html += '<span class="settings-phase-tab' + (settingsPhaseTab===p?' active':'') + '" onclick="setSettingsPhase(\'' + p + '\')">' + p + '</span>';
  });
  html += '</div>';
  var customTasks = {};
  if (cs.custom_tasks) {
    try { customTasks = typeof cs.custom_tasks === 'string' ? JSON.parse(cs.custom_tasks) : cs.custom_tasks; } catch(e) {}
  }
  var curTasks = (customTasks && customTasks[settingsPhaseTab]) || DEFAULT_TASKS[settingsPhaseTab] || [];
  html += '<div id="set-task-list">';
  curTasks.forEach(function(t, i) {
    html += '<span class="settings-chip">' + t;
    html += '<button class="settings-chip-del" onclick="removeTask(\'' + settingsPhaseTab + '\',' + i + ')">✕</button></span>';
  });
  html += '</div>';
  html += '<div class="settings-add-row">';
  html += '<input class="settings-add-input" id="set-new-task" placeholder="new work suggestion">';
  html += '<button class="btn-sm" onclick="addTask2()">+</button>';
  html += '</div></div>';

  // Affirmations
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title">customize · affirmations</div>';
  html += '<div class="settings-phase-tabs">';
  ['menstrual','follicular','ovulatory','luteal'].forEach(function(p) {
    html += '<span class="settings-phase-tab' + (settingsPhaseTab===p?' active':'') + '" onclick="setSettingsPhase(\'' + p + '\')">' + p + '</span>';
  });
  html += '</div>';
  var customAffs = {};
  if (cs.custom_affirmations) {
    try { customAffs = typeof cs.custom_affirmations === 'string' ? JSON.parse(cs.custom_affirmations) : cs.custom_affirmations; } catch(e) {}
  }
  var curAffs = (customAffs && customAffs[settingsPhaseTab]) || AFFIRMATIONS[settingsPhaseTab] || [];
  html += '<div id="set-aff-list">';
  curAffs.forEach(function(a, i) {
    html += '<span class="settings-chip" style="max-width:100%;white-space:normal;">' + a.slice(0,60) + (a.length>60?'...':'');
    html += '<button class="settings-chip-del" onclick="removeAff(\'' + settingsPhaseTab + '\',' + i + ')">✕</button></span>';
  });
  html += '</div>';
  html += '<div class="settings-add-row" style="flex-direction:column;">';
  html += '<textarea class="settings-add-input" id="set-new-aff" placeholder="new affirmation" rows="2" style="width:100%;resize:none;"></textarea>';
  html += '<button class="btn-sm" onclick="addAff()" style="align-self:flex-start;margin-top:6px;">+</button>';
  html += '</div></div>';

  document.getElementById('settings-content').innerHTML = html;
}

function setSettingsPhase(p) {
  settingsPhaseTab = p;
  renderSettings();
}

function setSymSection(s) {
  settingsSymptomTab = s === 'ovulation' ? 'ovulatory' : s;
  renderSettings();
}

function saveBasicSettings() {
  appState.profile.app_name = document.getElementById('set-appname').value || 'The Sacred Cycle';
  appState.profile.greeting = document.getElementById('set-greeting').value || 'welcome back';
  appState.profile.cycle_len = parseInt(document.getElementById('set-cyclelen').value) || 28;
  appState.profile.period_len = parseInt(document.getElementById('set-periodlen').value) || 5;
  appState.profile.cycle_goal = document.getElementById('set-cyclegoal').value || 'body literacy';
  appState.profile.fertility_tracking = document.getElementById('set-fertilitytracking').value !== 'no';
  appState.profile.pregnant = document.getElementById('set-pregnant').value === 'yes';
  appState.profile.pregnancy_due_date = document.getElementById('set-pregnancy-due').value || '';
  lsSet('appSettings', appState.profile);
  showSync('saved');
  updatePhaseDisplay();
  renderToday();
  renderLog();
  renderInsights();
  renderSupport();
}

function togglePregnancyDueSetting() {
  var pregnantEl = document.getElementById('set-pregnant');
  var dueWrap = document.getElementById('pregnancy-due-wrap');
  if (!pregnantEl || !dueWrap) return;
  dueWrap.style.display = pregnantEl.value === 'yes' ? 'block' : 'none';
}

function getCustomSettings() {
  var cs = appState.customSettings || {};
  var customSymptoms = cs.custom_symptoms ? (typeof cs.custom_symptoms === 'string' ? JSON.parse(cs.custom_symptoms) : cs.custom_symptoms) : {};
  if (customSymptoms.ovulation && !customSymptoms.ovulatory) {
    customSymptoms.ovulatory = customSymptoms.ovulation;
    delete customSymptoms.ovulation;
  }
  return {
    custom_tasks: cs.custom_tasks ? (typeof cs.custom_tasks === 'string' ? JSON.parse(cs.custom_tasks) : cs.custom_tasks) : {},
    custom_affirmations: cs.custom_affirmations ? (typeof cs.custom_affirmations === 'string' ? JSON.parse(cs.custom_affirmations) : cs.custom_affirmations) : {},
    custom_symptoms: customSymptoms,
    custom_mood_emojis: cs.custom_mood_emojis ? (typeof cs.custom_mood_emojis === 'string' ? JSON.parse(cs.custom_mood_emojis) : cs.custom_mood_emojis) : DEFAULT_MOOD_EMOJIS.slice(),
    custom_mood_words: cs.custom_mood_words ? (typeof cs.custom_mood_words === 'string' ? JSON.parse(cs.custom_mood_words) : cs.custom_mood_words) : DEFAULT_MOOD_WORDS.slice()
  };
}

function saveCustomSettings() {
  lsSet('customSettings', appState.customSettings);
  showSync('saved');
}

function removeMoodEmoji(i) {
  var emojis = getMoodEmojis();
  emojis.splice(i,1);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_mood_emojis = emojis;
  saveCustomSettings();
  renderSettings();
}

function addMoodEmoji() {
  var emoji = document.getElementById('set-new-emoji').value.trim();
  var label = document.getElementById('set-new-emoji-label').value.trim().toLowerCase();
  if (!emoji || !label) return;
  var emojis = getMoodEmojis();
  emojis.push({ emoji: emoji, label: label });
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_mood_emojis = emojis;
  saveCustomSettings();
  renderSettings();
}

function removeMoodWord(i) {
  var words = getMoodWords();
  words.splice(i,1);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_mood_words = words;
  saveCustomSettings();
  renderSettings();
}

function addMoodWord() {
  var word = document.getElementById('set-new-word').value.trim().toLowerCase();
  if (!word) return;
  var words = getMoodWords();
  words.push(word);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_mood_words = words;
  saveCustomSettings();
  renderSettings();
}

function removeCustomSym(i) {
  var cs = getCustomSettings();
  if (!cs.custom_symptoms[settingsSymptomTab]) return;
  cs.custom_symptoms[settingsSymptomTab].splice(i,1);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_symptoms = cs.custom_symptoms;
  saveCustomSettings();
  renderSettings();
}

function addCustomSym() {
  var emoji = document.getElementById('set-sym-emoji').value.trim();
  var name = document.getElementById('set-sym-name').value.trim().toLowerCase();
  if (!name) return;
  var cs = getCustomSettings();
  if (!cs.custom_symptoms[settingsSymptomTab]) cs.custom_symptoms[settingsSymptomTab] = [];
  cs.custom_symptoms[settingsSymptomTab].push({ emoji: emoji||'💊', name: name });
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_symptoms = cs.custom_symptoms;
  saveCustomSettings();
  renderSettings();
}

function removeTask(phase, i) {
  var cs = getCustomSettings();
  var tasks = cs.custom_tasks[phase] || DEFAULT_TASKS[phase].slice();
  tasks.splice(i,1);
  cs.custom_tasks[phase] = tasks;
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_tasks = cs.custom_tasks;
  saveCustomSettings();
  renderSettings();
}

function addTask2() {
  var task = document.getElementById('set-new-task').value.trim().toLowerCase();
  if (!task) return;
  var cs = getCustomSettings();
  if (!cs.custom_tasks[settingsPhaseTab]) cs.custom_tasks[settingsPhaseTab] = DEFAULT_TASKS[settingsPhaseTab].slice();
  cs.custom_tasks[settingsPhaseTab].push(task);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_tasks = cs.custom_tasks;
  saveCustomSettings();
  renderSettings();
}

function removeAff(phase, i) {
  var cs = getCustomSettings();
  var affs = cs.custom_affirmations[phase] || AFFIRMATIONS[phase].slice();
  affs.splice(i,1);
  cs.custom_affirmations[phase] = affs;
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_affirmations = cs.custom_affirmations;
  saveCustomSettings();
  renderSettings();
}

function addAff() {
  var aff = document.getElementById('set-new-aff').value.trim();
  if (!aff) return;
  var cs = getCustomSettings();
  if (!cs.custom_affirmations[settingsPhaseTab]) cs.custom_affirmations[settingsPhaseTab] = AFFIRMATIONS[settingsPhaseTab].slice();
  cs.custom_affirmations[settingsPhaseTab].push(aff);
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_affirmations = cs.custom_affirmations;
  saveCustomSettings();
  renderSettings();
}

// ═══════════════════════════════════════════
// EXPORT DATA
// ═══════════════════════════════════════════
function exportData() {
  closeProfileMenu();
  // Collect everything — cycles, logs, habits, all settings
  var ts = lsGet('taskSets');
  var data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: appState.profile,
    taskSets: ts || [],
    cycleStarts: appState.cycleStarts,
    dayLogs: appState.dayLogs,
    ritualLogs: appState.ritualLogs,
    habitLogs: appState.habitLogs || {},
    customSettings: appState.customSettings
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'sacred-cycle-backup-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  appState.profile.last_backup_date = todayStr();
  lsSet('appSettings', appState.profile);
  showSync('saved');
}

function importData() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var d = JSON.parse(ev.target.result);
        if (!d.cycleStarts && !d.dayLogs) {
          alert('this file does not look like a sacred cycle backup');
          return;
        }
        if (!confirm('restore from this backup? your current data on this device will be replaced.')) return;
        // Restore profile
        if (d.profile) {
          Object.assign(appState.profile, d.profile);
          appState.profile.onboarded = true;
          lsSet('appSettings', appState.profile);
          lsSet('onboarded', true);
        }
        // Restore task sets
        if (d.taskSets && d.taskSets.length) {
          lsSet('taskSets', d.taskSets);
          appState.profile.task_sets = JSON.stringify(d.taskSets);
          appState.profile.task_set  = d.taskSets[0];
        }
        // Restore cycles
        if (d.cycleStarts) {
          appState.cycleStarts = d.cycleStarts;
          lsSet('pastCycles', appState.cycleStarts);
        }
        // Restore day logs
        if (d.dayLogs) {
          appState.dayLogs = d.dayLogs;
          lsSet('dayData', appState.dayLogs);
        }
        // Restore ritual logs
        if (d.ritualLogs) {
          appState.ritualLogs = d.ritualLogs;
          lsSet('rituals', appState.ritualLogs);
        }
        // Restore habit logs
        if (d.habitLogs) {
          appState.habitLogs = d.habitLogs;
          lsSet('habitLogs', appState.habitLogs);
        }
        // Restore custom settings
        if (d.customSettings) {
          appState.customSettings = d.customSettings;
          lsSet('customSettings', appState.customSettings);
        }
        // Re-render everything
        repairHiddenBlocks();
        applyDarkMode();
        updatePhaseDisplay();
        renderAllTabs();
        closeSettings();
        setTimeout(function(){ alert('\u2713 backup restored successfully'); }, 300);
      } catch(err) {
        alert('could not read backup file. make sure it is a valid sacred cycle backup.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}



// ═══════════════════════════════════════════
// HAPTIC FEEDBACK
// ═══════════════════════════════════════════
function haptic(style) {
  if (!window.navigator || !window.navigator.vibrate) return;
  var p = {light:10, medium:20, heavy:40, success:[10,50,10], error:[30,20,30]}[style] || 10;
  try { window.navigator.vibrate(p); } catch(e) {}
}

// ═══════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════
function applyDarkMode() {
  if (!appState.profile.onboarded) { document.body.classList.remove('dark-mens','dark-lut'); return; }
  var cycleDay = getCycleDay();
  var phase = getPhase(cycleDay, appState.profile.cycle_len || 28);
  var pref = appState.profile.dark_mode_pref || 'auto';
  document.body.classList.remove('dark-mens','dark-lut');
  if (pref === 'off') return;
  if (pref === 'always' || (pref === 'auto' && phase.name === 'menstrual')) {
    document.body.classList.add('dark-mens');
  } else if (pref === 'auto' && phase.name === 'luteal') {
    document.body.classList.add('dark-lut');
  }
}

function setDarkModePref(pref) {
  appState.profile.dark_mode_pref = pref;
  lsSet('appSettings', appState.profile);
  applyDarkMode();
  renderSettings();
  renderHabits();
}

// ═══════════════════════════════════════════
// HABITS
// ═══════════════════════════════════════════
var DEFAULT_HABITS = [
  {id:'supplements', label:'take supplements', emoji:'💊', goal:'daily'},
  {id:'gratitude',   label:'gratitude journal', emoji:'📓', goal:'daily'},
  {id:'drybrushed',  label:'lymphatic massage', emoji:'🫧', goal:'three_week'},
  {id:'water',       label:'8 glasses of water', emoji:'💧', goal:'daily'},
  {id:'moved',       label:'moved my body',      emoji:'🏃', goal:'three_week'},
  {id:'skincare',    label:'skincare ritual',     emoji:'🌿', goal:'daily'}
];

var PREGNANCY_HABITS = [
  {id:'prenatal', label:'prenatal / provider-approved supplements', emoji:'💊', goal:'daily'},
  {id:'hydration', label:'hydration', emoji:'💧', goal:'daily'},
  {id:'protein', label:'protein-rich meals', emoji:'🥚', goal:'daily'},
  {id:'gentlemove', label:'gentle movement', emoji:'🚶', goal:'three_week'},
  {id:'rest', label:'intentional rest', emoji:'🛌', goal:'daily'},
  {id:'questions', label:'provider questions / notes', emoji:'📝', goal:'three_week'}
];

function escapeHabitText(value) {
  return String(value || '').replace(/[&<>"']/g, function(ch) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
  });
}

function normalizeHabit(h) {
  return {
    id: h.id,
    label: h.label,
    emoji: h.emoji || '✨',
    goal: h.goal || 'daily'
  };
}

function getHabitDefs() {
  if (appState.customSettings && appState.customSettings.custom_habits) {
    try {
      var v = appState.customSettings.custom_habits;
      var c = typeof v === 'string' ? JSON.parse(v) : v;
      if (c && c.length) return c.map(normalizeHabit);
    } catch(e) {}
  }
  return (isPregnancyMode() ? PREGNANCY_HABITS : DEFAULT_HABITS).map(normalizeHabit);
}

function getTodayHabits() {
  var t = todayStr();
  if (!appState.habitLogs) appState.habitLogs = {};
  if (!appState.habitLogs[t]) appState.habitLogs[t] = {};
  return appState.habitLogs[t];
}

function toggleHabit(habitId) {
  haptic('medium');
  var t = todayStr();
  if (!appState.habitLogs) appState.habitLogs = {};
  if (!appState.habitLogs[t]) appState.habitLogs[t] = {};
  appState.habitLogs[t][habitId] = !appState.habitLogs[t][habitId];
  lsSet('habitLogs', appState.habitLogs);
  renderHabits();
}

function getHabitStreak(habitId) {
  var streak = 0;
  var d = new Date(); d.setHours(0,0,0,0);
  for (var i = 0; i < 365; i++) {
    var ds = dateToString(d);
    if (appState.habitLogs && appState.habitLogs[ds] && appState.habitLogs[ds][habitId]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else { break; }
  }
  return streak;
}

function getHabitGoalLabel(goal) {
  var labels = {
    daily: 'daily',
    weekdays: 'weekdays',
    three_week: '3x / week',
    luteal: 'luteal support'
  };
  return labels[goal || 'daily'] || 'daily';
}

function getHabitGoalOptions(selected) {
  var opts = [
    {v:'daily', l:'daily'},
    {v:'weekdays', l:'weekdays'},
    {v:'three_week', l:'3x / week'},
    {v:'luteal', l:'luteal only'}
  ];
  var html = '';
  opts.forEach(function(o) {
    html += '<option value="'+o.v+'"'+((selected||'daily')===o.v?' selected':'')+'>'+o.l+'</option>';
  });
  return html;
}

function getCurrentMonthDates() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var dates = [];
  for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(dateToString(new Date(d)));
  }
  return dates;
}

function getRecentDates(days) {
  var dates = [];
  var d = new Date(); d.setHours(0,0,0,0);
  for (var i = days - 1; i >= 0; i--) {
    var x = new Date(d); x.setDate(x.getDate() - i);
    dates.push(dateToString(x));
  }
  return dates;
}

function isHabitCheckedOnDate(habitId, dateStr) {
  return !!(appState.habitLogs && appState.habitLogs[dateStr] && appState.habitLogs[dateStr][habitId]);
}

function isHabitExpectedOnDate(habit, dateStr) {
  var goal = habit.goal || 'daily';
  var d = new Date(dateStr + 'T00:00:00');
  if (goal === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
  if (goal === 'luteal') return getPhase(getCycleDayForDate(dateStr), appState.profile.cycle_len || 28).name === 'luteal';
  return true;
}

function countWeeksInDates(dates) {
  var weeks = {};
  dates.forEach(function(ds) {
    var d = new Date(ds + 'T00:00:00');
    var start = new Date(d); start.setDate(d.getDate() - d.getDay());
    weeks[dateToString(start)] = true;
  });
  return Object.keys(weeks).length || 1;
}

function getHabitStats(habit, dates) {
  var hits = dates.filter(function(ds) { return isHabitCheckedOnDate(habit.id, ds); }).length;
  var expected = 0;
  if ((habit.goal || 'daily') === 'three_week') {
    expected = Math.min(dates.length, countWeeksInDates(dates) * 3);
  } else {
    expected = dates.filter(function(ds) { return isHabitExpectedOnDate(habit, ds); }).length;
  }
  expected = Math.max(1, expected);
  return {
    hits: hits,
    expected: expected,
    pct: Math.min(100, Math.round(hits / expected * 100))
  };
}

function getBestHabitStreakInDates(habitId, dates) {
  var best = 0, current = 0;
  dates.forEach(function(ds) {
    if (isHabitCheckedOnDate(habitId, ds)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  });
  return best;
}

function getHabitPhaseStats(habit, dates) {
  var stats = {};
  dates.forEach(function(ds) {
    var phase = getPhase(getCycleDayForDate(ds), appState.profile.cycle_len || 28).name;
    if (!stats[phase]) stats[phase] = {hits:0, expected:0};
    if (isHabitExpectedOnDate(habit, ds)) stats[phase].expected++;
    if (isHabitCheckedOnDate(habit.id, ds)) stats[phase].hits++;
  });
  Object.keys(stats).forEach(function(p) {
    stats[p].pct = stats[p].expected ? Math.round(stats[p].hits / stats[p].expected * 100) : 0;
  });
  return stats;
}

function getMonthlyHabitSummary(habits, monthDates) {
  var stats = habits.map(function(h) {
    var s = getHabitStats(h, monthDates);
    return {habit:h, hits:s.hits, expected:s.expected, pct:s.pct, best:getBestHabitStreakInDates(h.id, monthDates)};
  });
  var expected = stats.reduce(function(sum, s) { return sum + s.expected; }, 0);
  var hits = stats.reduce(function(sum, s) { return sum + s.hits; }, 0);
  stats.sort(function(a,b) { return b.pct - a.pct; });
  return {
    pct: expected ? Math.round(hits / expected * 100) : 0,
    hits: hits,
    expected: expected,
    best: stats[0] || null,
    needs: stats[stats.length - 1] || null,
    bestStreak: stats.reduce(function(best, s) { return Math.max(best, s.best); }, 0),
    stats: stats
  };
}

function getHabitPhaseInsight(habits, monthDates) {
  if (isPregnancyMode()) {
    return 'Pregnancy mode is focused on gentle consistency: hydration, nourishment, rest, movement, and notes you can bring to your provider.';
  }
  var best = null, tender = null;
  habits.forEach(function(h) {
    var phaseStats = getHabitPhaseStats(h, monthDates);
    Object.keys(phaseStats).forEach(function(p) {
      var row = phaseStats[p];
      if (row.expected < 2) return;
      var item = {habit:h, phase:p, pct:row.pct};
      if (!best || item.pct > best.pct) best = item;
      if (!tender || item.pct < tender.pct) tender = item;
    });
  });
  if (best && tender && best.phase !== tender.phase) {
    return 'You were most consistent with ' + best.habit.label + ' in ' + best.phase + ', while ' + tender.habit.label + ' asked for more support in ' + tender.phase + '.';
  }
  return 'Keep watching which habits feel easy in each phase. The pattern matters more than perfection.';
}

function getHabitPhaseSuggestion() {
  if (isPregnancyMode()) return 'Today, favor the habits that support steadiness: hydration, protein, rest, gentle movement, and care notes.';
  var phase = getPhase(getCycleDay(), appState.profile.cycle_len || 28).name;
  var suggestions = {
    menstrual: 'Inner winter: keep habits warm, simple, and restorative. Rest counts.',
    follicular: 'Inner spring: this is a lovely time to restart routines or try a lighter habit stack.',
    ovulatory: 'Inner summer: connection, movement, and visibility habits may feel easier.',
    luteal: 'Inner autumn: support sleep, magnesium-rich foods, hydration, and closing loops.'
  };
  return suggestions[phase] || suggestions.menstrual;
}

function renderHabits() {
  var pane = document.getElementById('habits-pane');
  if (!pane) return;
  var habits   = getHabitDefs();
  var todayH   = getTodayHabits();
  var done     = habits.filter(function(h){ return todayH[h.id]; }).length;
  var pct      = habits.length ? Math.round(done/habits.length*100) : 0;
  var view     = appState._habitView || 'today';
  if (habitViewOptions.indexOf(view) === -1) view = 'today';
  var custOpen = appState._habitCustOpen || false;
  var monthDates = getCurrentMonthDates();
  var monthSummary = getMonthlyHabitSummary(habits, monthDates);
  var monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var now = new Date();
  var monthLabel = monthNames[now.getMonth()] + ' ' + now.getFullYear();

  // ── Header card ──
  var html = '<div class="card" style="margin-bottom:12px;">';
  html += '<div style="padding:14px 16px 12px;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.1rem,4.5vw,1.3rem);color:var(--brand);">habits</div>';
  html += '<div style="font-size:clamp(.72rem,2.8vw,.8rem);color:var(--text3);">'+done+' / '+habits.length+' today</div>';
  html += '</div>';
  // Progress bar
  html += '<div style="background:var(--bg2);border-radius:6px;height:5px;overflow:hidden;margin-bottom:12px;">';
  html += '<div style="width:'+pct+'%;height:100%;background:var(--brand);border-radius:6px;transition:width .4s;"></div></div>';
  // View toggle
  html += '<div style="display:flex;gap:6px;">';
  habitViewOptions.forEach(function(v){
    var act = view === v;
    html += '<button data-v="'+v+'" onclick="setHabitView(this.dataset.v)" style="flex:1;padding:7px;border-radius:20px;border:1.5px solid '+(act?'var(--brand)':'var(--bg2)')+';background:'+(act?'var(--brand)':'transparent')+';color:'+(act?'#fff':'var(--text3)')+';font-size:clamp(.62rem,2.4vw,.7rem);cursor:pointer;font-family:Jost,sans-serif;">'+v+'</button>';
  });
  html += '</div></div></div>';

  html += '<div class="insight-mini-card">';
  html += '<div class="insight-mini-kicker">' + monthLabel + '</div>';
  html += '<div class="insight-mini-title">' + monthSummary.pct + '% aligned this month</div>';
  html += '<div class="insight-mini-body">' + getHabitPhaseSuggestion() + '</div>';
  if (monthSummary.best && monthSummary.needs) {
    html += '<div class="insight-mini-meta">most consistent: ' + escapeHabitText(monthSummary.best.habit.label) + ' · needs support: ' + escapeHabitText(monthSummary.needs.habit.label) + '</div>';
  }
  html += '</div>';

  if (view === 'month') {
    html += renderHabitMonthView(habits, monthDates, monthSummary);
  } else if (view === 'year') {
    html += renderHabitYearView(habits);
  } else {
    html += renderHabitTodayView(habits, todayH, monthDates);
  }

  // ── Customize accordion ──
  html += '<div class="card" style="margin-top:6px;overflow:hidden;">';
  html += '<button onclick="toggleHabitCustomize()" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:transparent;border:none;cursor:pointer;">';
  html += '<span style="font-size:clamp(.8rem,3.2vw,.88rem);color:var(--text2);">&#9998; customize habits</span>';
  html += '<span id="habit-cust-arrow" style="color:var(--text3);font-size:.7rem;display:inline-block;transition:transform .25s;'+(custOpen?'transform:rotate(180deg);':'')+'"  >&#9660;</span>';
  html += '</button>';
  html += '<div id="habit-cust-body" style="overflow:hidden;max-height:'+(custOpen?'900px':'0')+';transition:max-height .35s cubic-bezier(.4,0,.2,1);">';
  html += '<div style="padding:0 16px 16px;border-top:1px solid var(--bg2);">';
  habits.forEach(function(h, hi) {
    html += '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:'+(hi<habits.length-1?'1px solid var(--bg2)':'none')+';flex-wrap:wrap;">';
    html += '<span style="font-size:1.1rem;">'+h.emoji+'</span>';
    html += '<span style="flex:1;min-width:120px;font-size:clamp(.8rem,3.2vw,.86rem);color:var(--text);">'+escapeHabitText(h.label)+'</span>';
    html += '<select data-hid="'+h.id+'" onchange="setHabitGoal(this.dataset.hid,this.value)" style="border:1px solid var(--bg2);border-radius:20px;padding:6px 9px;background:var(--bg);color:var(--text3);font-size:.7rem;">'+getHabitGoalOptions(h.goal)+'</select>';
    html += '<button data-hid="'+h.id+'" onclick="removeHabit(this.dataset.hid)" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:.8rem;padding:4px 8px;">remove</button>';
    html += '</div>';
  });
  html += '<div style="display:flex;gap:8px;margin-top:12px;">';
  html += '<input id="new-habit-emoji" type="text" placeholder="&#128170;" style="width:52px;border:1px solid var(--bg2);border-radius:var(--radius-sm);padding:9px 8px;font-size:.9rem;text-align:center;background:var(--bg);color:var(--text);" maxlength="2">';
  html += '<input id="new-habit-label" type="text" placeholder="habit name..." style="flex:1;border:1px solid var(--bg2);border-radius:var(--radius-sm);padding:9px 12px;font-size:.85rem;background:var(--bg);color:var(--text);">';
  html += '<button onclick="addHabitDef()" style="padding:9px 14px;background:var(--brand);color:#fff;border:none;border-radius:var(--radius-sm);font-size:.8rem;cursor:pointer;">add</button>';
  html += '</div></div></div></div>';

  pane.innerHTML = html;
}

function renderHabitTodayView(habits, todayH, monthDates) {
  var html = renderHabitCareBasics();
  html += '<div class="card">';
  habits.forEach(function(h, hi) {
    var checked = !!todayH[h.id];
    var streak  = getHabitStreak(h.id);
    var stats = getHabitStats(h, monthDates);
    var bdr = hi < habits.length-1 ? '1px solid var(--bg2)' : 'none';
    html += '<div style="padding:14px 16px 12px;border-bottom:'+bdr+';">';
    html += '<div style="display:flex;align-items:center;gap:12px;">';
    html += '<button data-hid="'+h.id+'" onclick="toggleHabit(this.dataset.hid)" style="width:34px;height:34px;border-radius:50%;border:2px solid '+(checked?'var(--brand)':'var(--bg2)')+';background:'+(checked?'var(--brand)':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .2s;">';
    if (checked) html += '<span style="color:#fff;font-size:.95rem;">&#10003;</span>';
    html += '</button>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+h.emoji+'  '+escapeHabitText(h.label)+'</div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);color:var(--text3);margin-top:2px;">'+getHabitGoalLabel(h.goal)+(streak > 0 ? ' · &#128293; '+streak+' day streak' : '')+'</div>';
    html += '</div>';
    html += '<div style="text-align:right;flex-shrink:0;"><div style="font-size:clamp(.8rem,3.2vw,.88rem);color:var(--text2);">'+stats.pct+'%</div><div style="font-size:clamp(.58rem,2.2vw,.64rem);color:var(--text3);">month</div></div>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderHabitCareBasics() {
  var log = getTodayLog();
  var water = log.water || 0;
  var sleepOpts = ['poor','okay','good','great','amazing'];
  var html = '<div class="card" style="margin-bottom:12px;">';
  html += '<div class="card-header"><span class="card-title">daily care</span><span style="font-size:.72rem;color:var(--text3);">water + sleep</span></div>';
  html += '<div class="card-body">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span class="symp-section-label" style="margin-bottom:0;">water</span><span style="font-size:.72rem;color:var(--text3);">' + water + '/8</span></div>';
  html += '<div class="water-btns" style="margin-bottom:13px;">';
  for (var i = 1; i <= 8; i++) {
    html += '<span class="water-drop' + (i<=water?' filled':'') + '" onclick="setWater(' + i + ')">&#128167;</span>';
  }
  html += '</div>';
  html += '<div class="symp-section-label">sleep</div>';
  html += '<div class="sleep-opts">';
  sleepOpts.forEach(function(o) {
    html += '<div class="sleep-opt' + (log.sleep===o?' selected':'') + '" onclick="setSleep(\'' + o + '\')">' + o + '</div>';
  });
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderHabitMonthView(habits, monthDates, summary) {
  var html = '<div class="card" style="margin-bottom:12px;"><div style="padding:14px 16px;">';
  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:10px;">month at a glance</div>';
  html += '<div class="recap-grid">';
  html += '<div><span>checked</span><strong>'+summary.hits+'/'+summary.expected+'</strong></div>';
  html += '<div><span>best streak</span><strong>'+summary.bestStreak+' days</strong></div>';
  html += '<div><span>most consistent</span><strong>'+(summary.best ? escapeHabitText(summary.best.habit.label) : '—')+'</strong></div>';
  html += '<div><span>needs support</span><strong>'+(summary.needs ? escapeHabitText(summary.needs.habit.label) : '—')+'</strong></div>';
  html += '</div>';
  html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);line-height:1.55;margin-top:10px;">'+getHabitPhaseInsight(habits, monthDates)+'</div>';
  html += '</div></div>';

  html += '<div class="card" style="margin-bottom:12px;"><div style="padding:14px 16px;">';
  html += '<div style="font-size:clamp(.78rem,3vw,.84rem);color:var(--text2);margin-bottom:10px;">daily rhythm</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
  ['s','m','t','w','t','f','s'].forEach(function(day) {
    html += '<div style="text-align:center;font-size:.62rem;color:var(--text3);">'+day+'</div>';
  });
  var first = new Date(monthDates[0] + 'T00:00:00').getDay();
  for (var blank = 0; blank < first; blank++) html += '<div></div>';
  monthDates.forEach(function(ds) {
    var d = new Date(ds + 'T00:00:00');
    var expected = habits.filter(function(h) { return isHabitExpectedOnDate(h, ds); }).length || habits.length;
    var hits = habits.filter(function(h) { return isHabitCheckedOnDate(h.id, ds); }).length;
    var dayPct = expected ? hits / expected : 0;
    var bg = hits ? 'var(--brand)' : 'var(--bg2)';
    var color = hits ? '#fff' : 'var(--text3)';
    html += '<div title="'+ds+'" style="aspect-ratio:1;border-radius:9px;background:'+bg+';opacity:'+(hits?Math.max(.35, dayPct):.45)+';color:'+color+';font-size:.68rem;display:flex;align-items:center;justify-content:center;">'+d.getDate()+'</div>';
  });
  html += '</div></div></div>';

  html += '<div class="card">';
  habits.forEach(function(h, hi) {
    var stats = getHabitStats(h, monthDates);
    var bdr = hi < habits.length-1 ? '1px solid var(--bg2)' : 'none';
    html += '<div style="padding:14px 16px 12px;border-bottom:'+bdr+';">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">';
    html += '<div><div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">'+h.emoji+' '+escapeHabitText(h.label)+'</div><div style="font-size:.66rem;color:var(--text3);">'+getHabitGoalLabel(h.goal)+' · '+stats.hits+'/'+stats.expected+'</div></div>';
    html += '<div style="font-size:clamp(.86rem,3.4vw,.94rem);color:var(--brand);">'+stats.pct+'%</div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat('+monthDates.length+',1fr);gap:2px;">';
    monthDates.forEach(function(ds) {
      var hit = isHabitCheckedOnDate(h.id, ds);
      var expected = isHabitExpectedOnDate(h, ds);
      var bg = hit ? 'var(--brand)' : expected ? 'var(--bg2)' : 'transparent';
      var border = expected ? 'none' : '1px dashed var(--bg2)';
      html += '<div style="height:10px;border-radius:3px;background:'+bg+';border:'+border+';opacity:'+(hit?1:.55)+';"></div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderHabitYearView(habits) {
  var dates = getRecentDates(365);
  var html = '<div class="card">';
  habits.forEach(function(h, hi) {
    var stats = getHabitStats(h, dates);
    var bdr = hi < habits.length-1 ? '1px solid var(--bg2)' : 'none';
    html += '<div style="padding:14px 16px 10px;border-bottom:'+bdr+';">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px;">';
    html += '<div><div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">'+h.emoji+' '+escapeHabitText(h.label)+'</div><div style="font-size:.66rem;color:var(--text3);">'+getHabitGoalLabel(h.goal)+'</div></div>';
    html += '<div style="text-align:right;"><div style="font-size:clamp(.8rem,3.2vw,.88rem);color:var(--text2);">'+stats.pct+'%</div><div style="font-size:.62rem;color:var(--text3);">year</div></div></div>';
    html += '<div style="display:grid;grid-template-rows:repeat(7,1fr);grid-template-columns:repeat(52,1fr);grid-auto-flow:column;gap:2px;">';
    dates.slice(-364).forEach(function(ds) {
      var hit = isHabitCheckedOnDate(h.id, ds);
      var bg = hit ? 'var(--brand)' : 'var(--bg2)';
      html += '<div style="border-radius:1.5px;background:'+bg+';opacity:'+(hit?1:.1)+';aspect-ratio:1;"></div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function setHabitView(v) {
  appState._habitView = habitViewOptions.indexOf(v) > -1 ? v : 'today';
  renderHabits();
}

function getHabitCompletion(habitId, days) {
  var count = 0;
  var d = new Date(); d.setHours(0,0,0,0);
  for (var i = 0; i < days; i++) {
    var ds = dateToString(d);
    if (appState.habitLogs && appState.habitLogs[ds] && appState.habitLogs[ds][habitId]) count++;
    d.setDate(d.getDate()-1);
  }
  return Math.round(count/days*100);
}



function toggleHabitCustomize() {
  appState._habitCustOpen = !appState._habitCustOpen;
  var body  = document.getElementById('habit-cust-body');
  var arrow = document.getElementById('habit-cust-arrow');
  if (!body) return;
  if (appState._habitCustOpen) {
    body.style.maxHeight = '600px';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    body.style.maxHeight = '0';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function addHabitDef() {
  var emoji = (document.getElementById('new-habit-emoji').value || '✨').trim();
  var label = (document.getElementById('new-habit-label').value || '').trim();
  if (!label) return;
  haptic('light');
  var habits = getHabitDefs();
  habits.push({id: 'c_' + Date.now(), label: label, emoji: emoji, goal: 'daily'});
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_habits = JSON.stringify(habits);
  lsSet('customSettings', appState.customSettings);
  renderHabits();
}

function setHabitGoal(habitId, goal) {
  var habits = getHabitDefs().map(function(h) {
    if (h.id === habitId) h.goal = goal || 'daily';
    return h;
  });
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_habits = JSON.stringify(habits);
  lsSet('customSettings', appState.customSettings);
  renderHabits();
}

function removeHabit(habitId) {
  var habits = getHabitDefs().filter(function(h){ return h.id !== habitId; });
  if (!appState.customSettings) appState.customSettings = {};
  appState.customSettings.custom_habits = JSON.stringify(habits);
  lsSet('customSettings', appState.customSettings);
  renderHabits();
}

// ═══════════════════════════════════════════
// SMARTER PREDICTIONS
// ═══════════════════════════════════════════
function getCycleLengthHistory() {
  var starts = (appState.cycleStarts || []).map(function(s) { return s.start_date; }).filter(Boolean).sort();
  var lengths = [];
  for (var i = 1; i < starts.length; i++) {
    var days = Math.round((new Date(starts[i] + 'T00:00:00') - new Date(starts[i-1] + 'T00:00:00')) / 86400000);
    if (days > 15 && days < 65) lengths.push(days);
  }
  return lengths;
}

function renderPregnancyInsights() {
  var totalDays = Object.keys(appState.dayLogs || {}).filter(function(d) {
    return hasRecordedDayLog(appState.dayLogs[d]);
  }).length;
  var week = getPregnancyWeek();
  var due = appState.profile.pregnancy_due_date;
  var monthReport = summarizeWindow(dateToString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), todayStr());
  var html = '';
  html += '<div class="insight-mini-card" style="border-left-color:#8a6a9a;">';
  html += '<div class="insight-mini-kicker">pregnancy mode</div>';
  html += '<div class="insight-mini-title">' + (week ? 'week ' + week + ' support' : 'cycle predictions paused') + '</div>';
  html += '<div class="insight-mini-body">The app will not predict periods, ovulation, fertile windows, PMS, or cycle phases while pregnancy mode is on.</div>';
  if (due) html += '<div class="insight-mini-meta">estimated due date: ' + due + '</div>';
  html += '</div>';
  html += '<div class="card"><div style="padding:16px 16px 4px;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(1.05rem,4.2vw,1.25rem);font-weight:400;color:var(--brand);">tracking focus</div></div>';
  html += '<div style="padding:4px 0 10px;">';
  [
    ['Logged days', totalDays],
    ['Best use', 'symptoms, mood, sleep, hydration, notes'],
    ['Paused', 'period + fertility predictions'],
    ['Bring to provider', 'symptom trends, concerns, questions']
  ].forEach(function(r) {
    html += '<div class="insight-row"><span>' + r[0] + '</span><strong>' + r[1] + '</strong></div>';
  });
  html += '</div></div>';
  html += '<div class="symptom-recs" style="border-left-color:#8a6a9a;">';
  html += '<div class="symptom-recs-title" style="color:#8a6a9a;">gentle safety reminders</div>';
  html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text2);line-height:1.75;">';
  html += '· check with your provider before trying herbs, supplements, castor oil, steaming, detoxes, or intense new practices<br>';
  html += '· seek medical guidance for bleeding, severe cramping, fever, dizziness, persistent vomiting, or anything that feels alarming<br>';
  html += '· this app is a reflection tool, not medical advice';
  html += '</div></div>';
  if (monthReport.loggedDays >= 3) {
    html += '<div class="insight-mini-card" style="border-left-color:#8a6a9a;">';
    html += '<div class="insight-mini-kicker">pregnancy pattern note</div>';
    html += '<div class="insight-mini-title">' + monthReport.loggedDays + ' logged days this month</div>';
    html += '<div class="insight-mini-body">' + (monthReport.topSymptom ? 'Most common symptom: ' + monthReport.topSymptom + '. ' : '') + (monthReport.topMood ? 'Most common mood: ' + monthReport.topMood + '. ' : '') + 'Use this as a provider conversation starter, not a diagnosis.</div>';
    html += '</div>';
  }
  return html;
}

function getPredictionCycleLength() {
  var lengths = getCycleLengthHistory();
  if (!lengths.length) return appState.profile.cycle_len || 28;
  return Math.round(lengths.reduce(function(a,b) { return a + b; }, 0) / lengths.length);
}

function getCycleDayForDate(dateStr) {
  var dDate = new Date(dateStr + 'T00:00:00');
  var closest = null;
  (appState.cycleStarts || []).map(function(s) { return s.start_date; }).filter(Boolean).sort().forEach(function(s) {
    var sDate = new Date(s + 'T00:00:00');
    if (sDate <= dDate && (!closest || sDate > new Date(closest + 'T00:00:00'))) closest = s;
  });
  if (!closest) return 1;
  return Math.max(1, Math.floor((dDate - new Date(closest + 'T00:00:00')) / 86400000) + 1);
}

function getFertilitySignalSummary() {
  var currentStart = getCurrentCycleStart();
  if (!currentStart) return { confidence:'cycle math only', score:0, signs:[] };
  var best = null;
  var signs = [];
  Object.keys(appState.dayLogs || {}).sort().forEach(function(dateStr) {
    if (dateStr < currentStart || dateStr > todayStr()) return;
    var log = appState.dayLogs[dateStr];
    if (!log || !log.fertility) return;
    var f = getFertility(log);
    var score = 0;
    var parts = [];
    if (f.lh === 'peak') { score += 5; parts.push('LH peak'); }
    else if (f.lh === 'high') { score += 3; parts.push('LH high'); }
    if (f.mucus === 'egg white') { score += 3; parts.push('egg white mucus'); }
    else if (f.mucus === 'watery') { score += 2; parts.push('watery mucus'); }
    if (f.ovulation_pain) { score += 3; parts.push('ovulation pain'); }
    if (f.bbt) { score += 1; parts.push('BBT logged'); }
    if (!score) return;
    signs.push({ date: dateStr, score: score, parts: parts, fertility: f });
    if (!best || score > best.score || (score === best.score && dateStr > best.date)) best = { date: dateStr, score: score, parts: parts, fertility: f };
  });
  if (!best) return { confidence:'cycle math only', score:0, signs:[] };
  var ovDate = best.date;
  if (best.fertility.lh === 'peak' || best.fertility.lh === 'high') ovDate = addDays(best.date, 1);
  var confidence = best.score >= 5 ? 'high' : best.score >= 3 ? 'moderate' : 'low';
  return {
    confidence: confidence,
    score: best.score,
    signs: signs,
    likelyDate: ovDate,
    likelyDay: getCycleDayForDate(ovDate),
    evidence: best.parts.join(' + ')
  };
}

function getPMSCountdown() {
  var cycleLen = getPredictionCycleLength();
  var cycleDay = getCycleDay();
  var ovDay = Math.round(cycleLen * 0.5);
  var lutealStart = ovDay + 2;
  if (cycleDay < lutealStart) return {daysUntilLuteal: lutealStart - cycleDay, inLuteal: false};
  return {inLuteal: true, lutealDay: cycleDay - lutealStart + 1, daysUntilPeriod: cycleLen - cycleDay};
}

function getOvulationStatus() {
  var cycleLen = getPredictionCycleLength();
  var cycleDay = getCycleDay();
  var ovDay = Math.round(cycleLen * 0.5);
  var fertileStart = ovDay - 6;
  if (cycleDay < fertileStart) return {status:'upcoming', daysUntil: fertileStart - cycleDay};
  if (cycleDay >= fertileStart && cycleDay < ovDay) return {status:'fertile', daysUntilOv: ovDay - cycleDay};
  if (cycleDay === ovDay) return {status:'ovulating'};
  return {status:'past', daysPast: cycleDay - ovDay};
}

function getSymptomCorrelations() {
  var symPhase = {};
  Object.keys(appState.dayLogs || {}).forEach(function(d) {
    var log = appState.dayLogs[d];
    if (!log || !log.symptoms) return;
    var syms; try { syms = typeof log.symptoms==='string'?JSON.parse(log.symptoms):log.symptoms; } catch(e){ return; }
    if (!syms || !syms.length) return;
    var dDate = new Date(d+'T00:00:00'), dCycleDay = 1;
    if (appState.cycleStarts && appState.cycleStarts.length) {
      var starts = appState.cycleStarts.map(function(s){return s.start_date;}).sort();
      var closest = null;
      starts.forEach(function(s){ var sd=new Date(s+'T00:00:00'); if(sd<=dDate&&(!closest||sd>new Date(closest+'T00:00:00')))closest=s; });
      if (closest) dCycleDay = Math.floor((dDate-new Date(closest+'T00:00:00'))/86400000)+1;
    }
    var pName = getPhase(dCycleDay, appState.profile.cycle_len||28).name;
    syms.forEach(function(s) {
      if (!symPhase[s]) symPhase[s] = {menstrual:0,follicular:0,ovulatory:0,luteal:0,total:0};
      symPhase[s][pName]++;
      symPhase[s].total++;
    });
  });
  var insights = [];
  Object.keys(symPhase).forEach(function(sym) {
    var d = symPhase[sym];
    if (d.total < 2) return;
    var topPhase = ['menstrual','follicular','ovulatory','luteal'].reduce(function(a,b){ return d[a]>=d[b]?a:b; });
    var pct = Math.round(d[topPhase]/d.total*100);
    if (pct >= 60) insights.push({symptom:sym, phase:topPhase, pct:pct, count:d.total});
  });
  return insights.sort(function(a,b){ return b.count-a.count; }).slice(0,6);
}

// ═══════════════════════════════════════════
// CYCLE LIBRARY
// ═══════════════════════════════════════════
var LIBRARY_ARTICLES = [
  {id:'mens', phase:'menstrual', emoji:'🌑', title:'the menstrual phase', subtitle:'Inner Winter · Days 1–5',
   sections:[
    {h:'what happens in your body', b:'Your period begins when progesterone and estrogen drop to their lowest points, signaling the uterus to shed its lining. Prostaglandins — inflammatory compounds — contract the uterine muscle to expel the lining. This is the source of cramping. Meanwhile, FSH begins quietly rising, already recruiting the follicle that will develop next cycle. Your body is simultaneously ending one chapter and beginning another.'},
    {h:'what happens in your brain', b:'Both hemispheres communicate more readily during menstruation — heightened intuition, enhanced pattern recognition, and access to emotions and subconscious material. Many women report their most vivid dreams, most accurate gut feelings, and most profound realizations during this phase. This is not weakness. It is a different kind of intelligence.'},
    {h:'energy and capacity', b:'Your energy is at its cyclic low, and this is physiologically appropriate. Attempting to perform at follicular or ovulatory levels during menstruation depletes the body and suppresses recovery. The ancient practice of rest during the bleed mirrors what the body is actually doing: redirecting enormous resources toward the process of shedding and renewal.'},
    {h:'what supports you most', b:'Warmth, iron-rich foods, anti-inflammatory herbs, deep rest, restorative movement, and reduced social obligation. Your liver is working hard to process prostaglandins — supporting it with beets, leafy greens, and avoiding alcohol helps significantly. Magnesium is the single most impactful supplement: it relaxes uterine smooth muscle, improves sleep, and stabilizes mood during the hormonal drop.'},
    {h:'the oracle archetype', b:'Every culture has a version of the wise woman who withdraws from ordinary life to access deeper knowing. The menstrual phase is your oracle time — not a time to produce, but to receive. Rest is not laziness in this phase; it is the active practice of listening to what cannot be heard when the world is loud.'}
   ]},
  {id:'foll', phase:'follicular', emoji:'🌒', title:'the follicular phase', subtitle:'Inner Spring · Days 6–12',
   sections:[
    {h:'what happens in your body', b:'FSH stimulates follicle development, with one dominant follicle emerging to mature. As it grows, it produces increasing estrogen. The uterine lining rebuilds. Cervical mucus shifts — becoming clearer and more slippery as ovulation approaches. Energy, skin clarity, and metabolism all respond to the rising hormonal tide.'},
    {h:'estrogen: the rising tide', b:'In healthy amounts, estrogen is profoundly nourishing: it enhances neuroplasticity, improves memory, boosts serotonin and dopamine, reduces inflammation, and supports skin elasticity. The rising estrogen of the follicular phase is why this feels like waking up after a long sleep. This hormone has receptors in virtually every tissue in the body.'},
    {h:'cognitive superpowers', b:'Verbal fluency, working memory, and the ability to process new information all peak in the follicular phase. Learning new skills, absorbing complex material, starting new projects, and having difficult conversations all feel more available. This is the phase to front-load cognitively demanding work.'},
    {h:'the estrobolome', b:'Your gut microbiome contains a community of bacteria called the estrobolome that metabolizes and recirculates estrogen. When disrupted by antibiotics, processed foods, chronic stress, or alcohol, estrogen can accumulate or clear too quickly. Fermented foods, fiber, and liver support directly support healthy estrogen metabolism.'},
    {h:'the artist archetype', b:'The follicular phase is a return to possibility. The Artist does not just create art — she creates options. She says yes to ideas before she knows if they are possible. She begins things. She is curious, playful, and unconcerned with completion. This is the phase to plant seeds you will harvest at ovulation.'}
   ]},
  {id:'ovul', phase:'ovulatory', emoji:'🌕', title:'the ovulatory phase', subtitle:'Inner Summer · Days 13–15',
   sections:[
    {h:'what happens in your body', b:'The LH surge triggers the dominant follicle to rupture and release the egg. The egg travels into the fallopian tube, viable for 12–24 hours. Sperm can survive 5 days in fertile cervical mucus. The ruptured follicle transforms into the corpus luteum, which begins producing progesterone. Everything changes at this pivot point.'},
    {h:'the hormonal peak', b:'Estrogen reaches its absolute peak just before ovulation, then drops sharply. Testosterone also peaks — and together, these two hormones create the signature ovulatory experience: physical confidence, magnetic social energy, high libido, effortless verbal expression, and a genuine desire to be seen. These are biological drives shaped by millions of years of evolution.'},
    {h:'voice and presence', b:'Studies show ovulating women are rated as more attractive by observers unaware of their cycle status. Vocal pitch shifts slightly. Skin glows from increased blood flow. The desire to communicate, connect, and collaborate surges. This is the optimal time for presentations, difficult conversations, sales calls, live content, pitches, and anything requiring presence and persuasion.'},
    {h:'signs of ovulation', b:'Egg white cervical mucus — clear, stretchy, like raw egg white — is the most reliable physical indicator. Other signs include mittelschmerz (a sharp twinge on one side), increased libido, a subtle energy peak, and a slight rise in basal body temperature immediately after ovulation. Tracking these signs over several cycles creates a rich, personalized picture of your fertility pattern.'},
    {h:'the muse archetype', b:'The Muse is magnetic, generous, fully expressed. She does not create alone; she inspires others to create. She is present, radiant, and unafraid of being seen. The energy of ovulation is not about vanity — it is about service through visibility. What you bring forward at your peak has the potential to move people.'}
   ]},
  {id:'lut', phase:'luteal', emoji:'🌗', title:'the luteal phase', subtitle:'Inner Autumn · Days 16–28',
   sections:[
    {h:'what happens in your body', b:'The corpus luteum produces progesterone, which dominates this phase. It thickens the uterine lining, raises body temperature slightly, slows digestion, and produces a calming effect. If pregnancy does not occur, the corpus luteum degrades, progesterone falls, and the next period begins.'},
    {h:'progesterone: the overlooked hormone', b:'In healthy amounts, progesterone is calming, anti-inflammatory, and protective of the nervous system. It promotes deep sleep, reduces anxiety, and supports healthy thyroid function. The problem arises in late luteal when it drops sharply: this sudden withdrawal triggers PMS. The symptoms are not random — they are predictable, hormonal, and addressable.'},
    {h:'serotonin and the PMS connection', b:'As progesterone falls, serotonin synthesis declines with it. Irritability, anxiety, weepiness, and low mood are serotonin deficiency driven by hormonal withdrawal — not personality flaws or weakness. This is why complex carbohydrates, magnesium, and B6 are so effective for late-luteal mood support.'},
    {h:'the editing intelligence', b:'The luteal phase sharpens discernment. Things that are inauthentic, wasteful, or out of alignment become immediately apparent. The frustration of luteal is often not irrational anger but accurate signal. Learning to trust luteal clarity — and separate it from luteal reactivity — is one of the most advanced cycle literacy skills.'},
    {h:'the huntress archetype', b:'The Huntress does not begin things — she completes them. She edits, sharpens, and eliminates. She has no patience for the unnecessary. In luteal, your job is to refine what already exists: complete projects, edit sessions, declutter, organize, prepare. What you finish now creates the clean slate for the rest that menstruation requires.'}
   ]},
  {id:'hormones', phase:'all', emoji:'🧬', title:'hormones 101', subtitle:'the four key players',
   sections:[
    {h:'estrogen', b:'Produced primarily in the ovaries, estrogen builds the uterine lining, bone density, neurological connections, and energetic momentum across the first half of the cycle. It directly increases serotonin and dopamine receptor sensitivity — which is why mood, motivation, and cognitive sharpness all rise with it. It has receptors in virtually every tissue in the body. Estrogen dominance — too much relative to progesterone — is the most common hormonal imbalance, driven by liver congestion, gut dysbiosis, chronic stress, or environmental estrogens from plastics, conventional skincare, and non-organic produce.'},
    {h:'progesterone', b:'Made by the corpus luteum after ovulation, progesterone calms the nervous system via GABA receptors, promotes deep sleep, and counterbalances estrogen. Low progesterone manifests as short cycles under 26 days, spotting before the period, PMS, anxiety, and difficulty maintaining early pregnancy. The most common causes are chronic stress (cortisol competes directly with progesterone synthesis via the pregnenolone pathway), undereating, and poor sleep. Progesterone metabolizes into allopregnanolone — a GABA-A modulator that promotes calm — which is why the days before menstruation feel harder when it drops suddenly.'},
    {h:'testosterone', b:'Produced in the ovaries and adrenal glands, testosterone drives libido, confidence, muscle synthesis, and motivation throughout the cycle. It peaks at ovulation alongside estrogen, creating the high-performance ovulatory window. Low testosterone in women — increasingly common with hormonal contraceptives, chronic stress, and undereating — manifests as low libido, difficulty building muscle, fatigue, and flat motivation. Testosterone also works synergistically with estrogen to protect bone density and cognitive function throughout the reproductive years.'},
    {h:'FSH and LH', b:'Follicle-stimulating hormone (FSH) and luteinizing hormone (LH) are pituitary hormones that orchestrate ovulation. FSH rises in the early follicular phase to stimulate follicle recruitment. LH surges sharply at mid-cycle to trigger egg release, typically 24-36 hours before ovulation. Elevated day-3 FSH is one of the most sensitive markers of diminishing ovarian reserve. Tracking the LH surge via OPKs alongside basal body temperature and cervical mucus gives the most complete picture of your fertile window.'},
    {h:'cortisol: the hidden disruptor', b:'Cortisol and progesterone are both synthesized from the same precursor — pregnenolone. When stress is chronically high, the body prioritizes cortisol over progesterone in what is known as the pregnenolone steal. Chronically elevated cortisol also suppresses the hypothalamic hormone GnRH, disrupts the LH surge, impairs thyroid conversion, and drives estrogen dominance by congesting liver detox pathways. Managing cortisol through sleep, stable blood sugar, nervous system regulation, and cycle-aware scheduling is not optional self-care. It is foundational hormonal medicine.'},
    {h:'insulin: the overlooked player', b:'Chronically elevated insulin from a diet high in refined carbohydrates suppresses sex hormone binding globulin (SHBG), which causes free testosterone to rise excessively. This is the primary hormonal mechanism behind PCOS — and it is why blood sugar regulation is so central to cycle health even without a formal diagnosis. Insulin also interacts with LH signaling in the ovaries and can prevent follicles from maturing or releasing properly. Every phase of the cycle benefits from stable, low-glycemic eating — and the luteal phase is especially vulnerable to the mood and energy consequences of blood sugar crashes.'},
    {h:'thyroid hormones', b:'The thyroid produces T4 (inactive) and T3 (active), which regulate metabolism, body temperature, energy production, and the speed of virtually every cellular process — including hormone synthesis and clearance. Thyroid dysfunction is one of the most frequently missed causes of cycle irregularity, heavy periods, long cycles, hair loss, and fatigue in women. The thyroid requires adequate selenium and iodine for hormone production, and adequate iron for T4-to-T3 conversion. A full thyroid panel — TSH, free T3, free T4, and thyroid antibodies — gives a far more complete picture than TSH alone.'}
   ]},
    {id:'syncing', phase:'all', emoji:'🔄', title:'cycle syncing', subtitle:'aligning life with your rhythm',
   sections:[
    {h:'what is cycle syncing?', b:'Cycle syncing is aligning your diet, exercise, work, social schedule, and creative output with the four phases of your cycle. It is rooted in the biological reality that your hormonal environment shifts dramatically across the month, affecting energy, cognition, mood, metabolism, and physical capacity in predictable ways.'},
    {h:'syncing your exercise', b:'Menstrual: gentle movement only. Follicular: build intensity — strength training, HIIT, new classes. Ovulatory: peak performance — push hardest, personal records, group fitness. Luteal: moderate and mindful — pilates, swimming, yoga, hiking. Your insulin sensitivity, recovery speed, and cardiovascular capacity all shift with your hormones.'},
    {h:'syncing your work', b:'Menstrual: visioning and long-term planning. Follicular: learning, initiating, brainstorming, pitching. Ovulatory: presenting, collaborating, live events, important conversations. Luteal: editing, completing, organizing, detail work. Front-load the most demanding tasks in the phases where you are most resourced.'},
    {h:'syncing your social life', b:'Menstrual: solitude or close intimacy. Follicular: casual socializing, new connections. Ovulatory: peak social engagement — parties, dates, networking. Luteal: selective socializing, meaningful 1:1 connection, saying no to energy-draining obligations. Respecting this rhythm makes you more present when you do show up.'},
    {h:'you don&#39;t have to do any of this', b:'Cycle syncing is a tool, not a rule. Even a single shift — protecting one day of rest during menstruation, or scheduling one important conversation during ovulation — creates meaningful change. The goal is not perfection or full adherence. It is awareness. The more you understand your own rhythm, the more agency you have over how you spend your energy. This is not about adding more to your plate — it is about organizing what is already there in a way that actually works for your biology. And it is one of the most practical things you can do to prevent the kind of chronic depletion that comes from ignoring your cycle entirely.'},
    {h:'designed for a 24-hour cycle — not yours', b:'Most of modern society was built around the male hormonal clock, which runs on a 24-hour cycle. Men&#39;s testosterone peaks in the morning and gradually declines through the day — their energy, mood, and cognitive capacity are relatively stable across the month. Women operate on a 28-day hormonal cycle with four distinct biological seasons. Expecting women to perform identically every day of the month is not a neutral standard. It is a structural mismatch — and it is the hidden source of enormous amounts of chronic exhaustion, shame around low-energy days, and guilt about needing rest or solitude at certain times. Much of what women have been told is weakness is actually just biology meeting a system that was never designed for them. Cycle syncing is quietly radical: it is choosing to organize your life around your actual nature rather than around a structure built for someone else&#39;s hormonal reality.'},
    {h:'the bigger picture', b:'Every woman who tracks her cycle discovers the same thing: what felt like inconsistency was actually a predictable rhythm. What felt like her worst self was a phase with specific needs that were not being met. The cycle is not a liability. It is a built-in guidance system — and living in alignment with it, even imperfectly, is an act of deep self-respect.'}
   ]}
];

var currentLibraryArticle = null;

function renderLibrary() {
  var pane = document.getElementById('library-pane');
  if (!pane) return;
  var cycleDay = getCycleDay();
  var phase = getPhase(cycleDay, appState.profile.cycle_len || 28);

  if (currentLibraryArticle) {
    pane.innerHTML = buildArticleHTML(currentLibraryArticle);
    return;
  }

  var html = '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.1rem,4.5vw,1.3rem);color:var(--brand);margin-bottom:14px;">cycle library</div>';

  var phaseArts = LIBRARY_ARTICLES.filter(function(a){ return a.phase === phase.name; });
  if (phaseArts.length) {
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">recommended now</div>';
    phaseArts.forEach(function(a){ html += buildLibCard(a); });
  }

  html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--text3);margin:14px 0 8px;">all articles</div>';
  LIBRARY_ARTICLES.forEach(function(a){ html += buildLibCard(a); });

  pane.innerHTML = html;
}

function buildLibCard(a) {
  var html = '<div data-aid="' + a.id + '" onclick="openArticle(this.dataset.aid)" style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:10px;padding:16px;cursor:pointer;display:flex;align-items:center;gap:14px;">';
  html += '<div style="font-size:1.8rem;flex-shrink:0;">' + a.emoji + '</div>';
  html += '<div style="flex:1;"><div style="font-family:Cormorant Garamond,serif;font-size:clamp(.95rem,3.8vw,1.1rem);font-weight:500;color:var(--text);margin-bottom:2px;">' + a.title + '</div>';
  html += '<div style="font-size:clamp(.7rem,2.7vw,.76rem);color:var(--text3);">' + a.subtitle + '</div></div>';
  html += '<span style="color:var(--text3);font-size:1rem;">&#8250;</span></div>';
  return html;
}

function buildArticleHTML(article) {
  var html = '<button onclick="closeArticle()" style="display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--brand);font-size:.84rem;cursor:pointer;margin-bottom:16px;padding:0;">&#8249; back to library</button>';
  html += '<div style="margin-bottom:20px;">';
  html += '<div style="font-size:2.2rem;margin-bottom:8px;">' + article.emoji + '</div>';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.4rem,5.5vw,1.8rem);font-weight:400;color:var(--brand);line-height:1.2;margin-bottom:4px;">' + article.title + '</div>';
  html += '<div style="font-size:clamp(.72rem,2.8vw,.8rem);color:var(--text3);">' + article.subtitle + '</div></div>';
  article.sections.forEach(function(sec) {
    html += '<div style="margin-bottom:20px;">';
    html += '<div style="font-size:clamp(.62rem,2.4vw,.68rem);letter-spacing:.12em;text-transform:uppercase;color:var(--brand);margin-bottom:8px;">' + sec.h + '</div>';
    html += '<div style="font-size:clamp(.82rem,3.2vw,.9rem);color:var(--text2);line-height:1.8;">' + sec.b + '</div></div>';
  });
  return html;
}

function openArticle(id) {
  currentLibraryArticle = null;
  for (var i = 0; i < LIBRARY_ARTICLES.length; i++) {
    if (LIBRARY_ARTICLES[i].id === id) { currentLibraryArticle = LIBRARY_ARTICLES[i]; break; }
  }
  var pane = document.getElementById('library-pane');
  if (pane && currentLibraryArticle) pane.innerHTML = buildArticleHTML(currentLibraryArticle);
  document.getElementById('tab-content').scrollTop = 0;
}

function closeArticle() {
  currentLibraryArticle = null;
  renderLibrary();
  document.getElementById('tab-content').scrollTop = 0;
}

// ═══════════════════════════════════════════
// SMART PREDICTIONS IN INSIGHTS
// ═══════════════════════════════════════════
function renderPredictionCards() {
  var pmsData = getPMSCountdown();
  var ovData  = getOvulationStatus();
  var html = '';

  if (!pmsData.inLuteal && pmsData.daysUntilLuteal !== undefined) {
    html += '<div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.4rem;">🍂</span><div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:2px;">luteal phase begins</div>';
    html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">in ' + pmsData.daysUntilLuteal + ' day' + (pmsData.daysUntilLuteal===1?'':'s') + ' &#183; prepare for the inward turn</div>';
    html += '</div></div>';
  } else if (pmsData.inLuteal) {
    var dtp = pmsData.daysUntilPeriod;
    var periodTiming = dtp < 0
      ? 'period expected ' + Math.abs(dtp) + ' day' + (Math.abs(dtp)===1?'':'s') + ' ago'
      : dtp === 0
        ? 'period expected today'
        : 'period predicted in ' + dtp + ' day' + (dtp===1?'':'s');
    html += '<div style="background:#f3f0f8;border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.4rem;">🌗</span><div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:#6a5a9a;margin-bottom:2px;">luteal day ' + pmsData.lutealDay + '</div>';
    html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">' + periodTiming + '</div>';
    if (dtp <= (appState.profile.pms_notice_days || 3)) html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:#6a5a9a;margin-top:3px;">&#128138; magnesium + early bedtime will help</div>';
    html += '</div></div>';
  }

  if (ovData.status === 'upcoming') {
    html += '<div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.4rem;">🌱</span><div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:2px;">fertile window opens</div>';
    html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">in ' + ovData.daysUntil + ' day' + (ovData.daysUntil===1?'':'s') + '</div>';
    html += '</div></div>';
  } else if (ovData.status === 'fertile') {
    html += '<div style="background:#f0f5f0;border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.4rem;">🌸</span><div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:#5a8a6a;margin-bottom:2px;">fertile window &#183; ovulation in ' + ovData.daysUntilOv + ' day' + (ovData.daysUntilOv===1?'':'s') + '</div>';
    html += '<div style="font-size:clamp(.82rem,3.2vw,.88rem);color:var(--text);">peak fertility &#183; watch for egg white mucus</div>';
    html += '</div></div>';
  } else if (ovData.status === 'ovulating') {
    html += '<div style="background:#fdf6ec;border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:1.4rem;">🌕</span><div>';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:#b8832a;margin-bottom:2px;">ovulation day</div>';
    html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">your most powerful day &#183; show up fully</div>';
    html += '</div></div>';
  }

  var fertilitySummary = getFertilitySignalSummary();
  if (appState.profile.fertility_tracking !== false) {
    if (fertilitySummary.likelyDate) {
      html += '<div style="background:#f0f5f0;border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">';
      html += '<span style="font-size:1.35rem;">🔎</span><div>';
      html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:#5a8a6a;margin-bottom:2px;">personal ovulation signal</div>';
      html += '<div style="font-size:clamp(.84rem,3.3vw,.92rem);color:var(--text);">likely around cycle day ' + fertilitySummary.likelyDay + '</div>';
      html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);line-height:1.5;margin-top:3px;">confidence: ' + fertilitySummary.confidence + ' · ' + fertilitySummary.evidence + '</div>';
      html += '</div></div>';
    } else {
      html += '<div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">';
      html += '<span style="font-size:1.35rem;">🌿</span><div>';
      html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:2px;">make predictions more personal</div>';
      html += '<div style="font-size:clamp(.8rem,3.1vw,.86rem);color:var(--text2);line-height:1.5;">log LH tests, cervical mucus, BBT, or ovulation pain for stronger ovulation timing.</div>';
      html += '</div></div>';
    }
  }

  var correlations = getSymptomCorrelations();
  if (correlations.length > 0) {
    html += '<div class="card"><div style="padding:16px 16px 14px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:4px;">your body&#39;s patterns</div>';
    html += '<div style="font-size:clamp(.72rem,2.8vw,.78rem);color:var(--text3);margin-bottom:12px;">based on your tracked symptoms</div>';
    var phC = {menstrual:'#f4d8d5',follicular:'#d5ead8',ovulatory:'#f5edcc',luteal:'#e8e0f0'};
    var phT = {menstrual:'#9a4a42',follicular:'#3a6a4a',ovulatory:'#8a6010',luteal:'#4a3a7a'};
    correlations.forEach(function(c,i){
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:' + (i<correlations.length-1?'1px solid var(--bg2)':'none') + ';gap:10px;">';
      html += '<span style="font-size:clamp(.8rem,3.2vw,.86rem);color:var(--text);">' + c.symptom + '</span>';
      html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
      html += '<span style="font-size:clamp(.62rem,2.4vw,.68rem);background:' + (phC[c.phase]||'var(--bg2)') + ';color:' + (phT[c.phase]||'var(--text3)') + ';border-radius:20px;padding:2px 8px;">' + c.phase + '</span>';
      html += '<span style="font-size:clamp(.62rem,2.4vw,.68rem);color:var(--text3);">' + c.pct + '%</span>';
      html += '</div></div>';
    });
    html += '</div></div>';
  }
  return html;
}



// ═══════════════════════════════════════════
// SHAREABLE CYCLE REPORT CARD
// ═══════════════════════════════════════════
function generateReportCard() {
  var cycleDay  = getCycleDay();
  var cycleLen  = appState.profile.cycle_len || 28;
  var phase     = getPhase(cycleDay, cycleLen);
  var sortedSt  = (appState.cycleStarts||[]).map(function(s){return s.start_date;}).sort();
  var cycleLens = [];
  for (var ci=1;ci<sortedSt.length;ci++){
    var dl=Math.round((new Date(sortedSt[ci]+'T00:00:00')-new Date(sortedSt[ci-1]+'T00:00:00'))/86400000);
    if(dl>15&&dl<65) cycleLens.push(dl);
  }
  var avgLen = cycleLens.length ? Math.round(cycleLens.reduce(function(a,b){return a+b;},0)/cycleLens.length) : cycleLen;

  // Rich phase palettes
  var P = {
    menstrual:  {bg1:'#0e0509',bg2:'#3d0f1a',acc:'#d4756e',text:'#faeae8',sub:'rgba(250,234,232,0.5)',hi:'rgba(212,117,110,0.15)'},
    follicular: {bg1:'#040e08',bg2:'#0e3520',acc:'#6ec497',text:'#e8f5ed',sub:'rgba(232,245,237,0.5)',hi:'rgba(110,196,151,0.15)'},
    ovulatory:  {bg1:'#0e0b02',bg2:'#3d2c04',acc:'#e8c050',text:'#faf4e0',sub:'rgba(250,244,224,0.5)',hi:'rgba(232,192,80,0.15)'},
    luteal:     {bg1:'#06040e',bg2:'#1a0e3d',acc:'#a090d8',text:'#ede8f8',sub:'rgba(237,232,248,0.5)',hi:'rgba(160,144,216,0.15)'}
  };
  var pal = P[phase.name] || P.menstrual;

  var W=1080, H=1350;
  var canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  var ctx = canvas.getContext('2d');

  // === BACKGROUND ===
  var bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0, pal.bg2);
  bg.addColorStop(0.5, pal.bg1);
  bg.addColorStop(1, pal.bg1);
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Atmospheric glow top-right
  var glowA = ctx.createRadialGradient(W*0.8,0,0,W*0.8,0,W*0.7);
  glowA.addColorStop(0,'rgba(255,255,255,0.04)'); glowA.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glowA; ctx.fillRect(0,0,W,H);

  // Warm glow bottom-left
  var glowB = ctx.createRadialGradient(0,H,0,0,H,W*0.5);
  glowB.addColorStop(0,'rgba(255,255,255,0.025)'); glowB.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glowB; ctx.fillRect(0,0,W,H);

  // === STARS ===
  var starData=[[88,55],[798,40],[162,185],[944,125],[298,75],[672,155],[45,365],[1005,295],[178,478],[938,428],[52,608],[1002,688],[125,808],[954,768],[65,968],[1018,908],[198,1085],[874,1042],[344,1210],[744,1172],[488,82],[432,252],[694,312],[812,488],[272,668],[596,738],[138,1022],[694,1262],[454,1142],[838,1192],[560,420],[200,920],[700,850]];
  starData.forEach(function(s,i){
    ctx.save(); ctx.globalAlpha=0.08+(i%7)*0.04;
    ctx.fillStyle=pal.acc;
    var r=i%3===0?1.8:i%2===0?1.2:0.8;
    ctx.beginPath(); ctx.arc(s[0],s[1],r,0,Math.PI*2); ctx.fill(); ctx.restore();
  });

  // === LAYOUT ===
  // Full bleed: no margins wasted
  // Left column: 0–420 (identity)  Right column: 440–1080 (data)
  var LW=420, RX=450, RW=W-RX-30;
  var topPad=50, botPad=40;
  var contentH = H - topPad - botPad;

  // === LEFT COLUMN ===
  var cx = LW/2; // center of left col

  // Moon — large, with glow halo
  var moonY = topPad + contentH*0.13;
  ctx.save();
  // Halo
  var halo = ctx.createRadialGradient(cx,moonY-40,0,cx,moonY-40,110);
  halo.addColorStop(0,'rgba(255,255,255,0.06)'); halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo; ctx.fillRect(0,0,W,H);
  ctx.shadowColor=pal.acc; ctx.shadowBlur=80;
  ctx.font='148px serif'; ctx.textAlign='center';
  ctx.fillText(phase.moon, cx, moonY);
  ctx.restore();

  // Phase name
  var nameY = topPad + contentH*0.27;
  ctx.fillStyle=pal.text; ctx.globalAlpha=0.95;
  ctx.font='300 48px Jost,sans-serif'; ctx.textAlign='center';
  ctx.fillText(phase.name, cx, nameY);
  ctx.globalAlpha=1;

  // Season — accented
  ctx.fillStyle=pal.acc; ctx.globalAlpha=0.85;
  ctx.font='300 24px Jost,sans-serif';
  ctx.fillText(phase.season, cx, nameY+42);
  ctx.globalAlpha=1;

  // Ornamental line
  var ln1Y = nameY+68;
  ctx.save(); ctx.strokeStyle=pal.acc; ctx.globalAlpha=0.22; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,ln1Y); ctx.lineTo(LW-30,ln1Y); ctx.stroke(); ctx.restore();

  // Archetype
  var archY = topPad + contentH*0.44;
  ctx.fillStyle=pal.acc;
  ctx.font='italic 600 30px Cormorant Garamond,Georgia,serif'; ctx.textAlign='center';
  ctx.fillText(phase.arch, cx, archY);

  // Arch subtitle (2 lines max)
  ctx.fillStyle=pal.sub; ctx.font='italic 300 23px Cormorant Garamond,Georgia,serif';
  var aw=LW-60, aLines=[], aCur='';
  phase.arch_sub.split(' ').forEach(function(w){ var t=aCur?aCur+' '+w:w; if(ctx.measureText(t).width>aw){aLines.push(aCur);aCur=w;}else aCur=t; });
  if(aCur)aLines.push(aCur);
  aLines.slice(0,3).forEach(function(l,i){ ctx.fillText(l,cx,archY+32+i*30); });

  // Cycle day — watermark style
  var cdY = topPad + contentH*0.66;
  ctx.fillStyle=pal.text; ctx.globalAlpha=0.12;
  ctx.font='700 160px Jost,sans-serif'; ctx.textAlign='center';
  ctx.fillText(cycleDay, cx, cdY);
  ctx.globalAlpha=1;
  ctx.fillStyle=pal.sub; ctx.font='300 22px Jost,sans-serif';
  ctx.fillText('cycle day of '+avgLen, cx, cdY+30);

  // Affirmation — fills bottom of left col
  var affs=AFFIRMATIONS[phase.name]||AFFIRMATIONS.menstrual;
  var aff=affs[new Date().getDate()%affs.length];
  var affStartY = topPad + contentH*0.79;
  var affEndY   = H - botPad - 28;
  ctx.save(); ctx.strokeStyle=pal.acc; ctx.globalAlpha=0.15; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,affStartY-10); ctx.lineTo(LW-30,affStartY-10); ctx.stroke(); ctx.restore();
  ctx.fillStyle=pal.text; ctx.globalAlpha=0.65;
  ctx.font='italic 300 24px Cormorant Garamond,Georgia,serif'; ctx.textAlign='center';
  var afW=LW-40, afLH=36, afY=affStartY+20;
  var afWords=aff.split(' '), afLines=[], afCur='';
  afWords.forEach(function(w){ var t=afCur?afCur+' '+w:w; if(ctx.measureText(t).width>afW){afLines.push(afCur);afCur=w;}else afCur=t; });
  if(afCur)afLines.push(afCur);
  var maxL=Math.floor((affEndY-afY)/afLH);
  afLines.slice(0,maxL).forEach(function(l,i){ ctx.fillText(l,cx,afY+i*afLH); });
  ctx.globalAlpha=1;

  // === DIVIDER ===
  ctx.save(); ctx.strokeStyle=pal.acc; ctx.globalAlpha=0.1; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(LW+15,topPad+20); ctx.lineTo(LW+15,H-botPad-20); ctx.stroke(); ctx.restore();

  // === RIGHT COLUMN — stat cards ===
  // Compute data
  var npLabel='—', daysUntilStr='';
  if(sortedSt.length){
    var np=new Date(sortedSt[sortedSt.length-1]+'T00:00:00'); np.setDate(np.getDate()+avgLen);
    var todayD=new Date(); todayD.setHours(0,0,0,0);
    var dtu=Math.max(0,Math.floor((np-todayD)/86400000));
    var mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    npLabel=mn[np.getMonth()]+' '+np.getDate();
    daysUntilStr=dtu===0?'today':'in '+dtu+' days';
  }
  var ovDay=Math.round(avgLen*0.5);
  var inFert=cycleDay>=(ovDay-6)&&cycleDay<=ovDay;
  var fertLabel=inFert?'fertile window — now':'days '+(ovDay-6)+' – '+ovDay;
  var fertSub=inFert?'ovulation around day '+ovDay:'ovulation ~day '+ovDay;
  var regLabel='—', regSub='log 2+ cycles to unlock';
  if(cycleLens.length>=2){
    var mean=avgLen, v2=cycleLens.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/cycleLens.length;
    var sd=Math.sqrt(v2);
    regLabel=sd<1?'very regular':sd<2.5?'regular':sd<5?'somewhat variable':'irregular';
    regSub='±'+sd.toFixed(1)+' days across '+cycleLens.length+' cycles';
  }
  var phDescs={menstrual:'rest · receive · restore',follicular:'begin · create · explore',ovulatory:'connect · express · shine',luteal:'complete · edit · release'};

  var cards=[
    {label:'next period',      val:npLabel,              sub:daysUntilStr,           icon:'🗓️'},
    {label:'avg cycle',        val:avgLen+' days',        sub:cycleLens.length?cycleLens.length+' cycles tracked':'from settings', icon:'↻'},
    {label:'fertile window',   val:fertLabel,             sub:fertSub,                icon:'🌱'},
    {label:'cycle regularity', val:regLabel,              sub:regSub,                 icon:'〜'},
    {label:'phase energy',     val:phDescs[phase.name]||'','sub':'',                  icon:'✦'},
  ];

  var numCards=cards.length;
  var totalCardH = contentH; // use full height
  var gap=14;
  var cardH=Math.floor((totalCardH-(numCards-1)*gap)/numCards);
  var cy2=topPad;

  cards.forEach(function(c) {
    // Card background
    ctx.save();
    var cg = ctx.createLinearGradient(RX,cy2,RX+RW,cy2+cardH);
    cg.addColorStop(0, pal.hi);
    cg.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle=cg;
    ctx.beginPath();
    if(ctx.roundRect){ ctx.roundRect(RX,cy2,RW,cardH,12); } else { ctx.rect(RX,cy2,RW,cardH); }
    ctx.fill();
    // Card border
    ctx.strokeStyle=pal.acc; ctx.globalAlpha=0.12; ctx.lineWidth=1;
    ctx.stroke();
    ctx.restore();

    // Icon strip on left
    ctx.fillStyle=pal.acc; ctx.globalAlpha=0.6;
    ctx.font=Math.floor(cardH*0.28)+'px serif'; ctx.textAlign='left';
    if(c.icon.length<=2) ctx.fillText(c.icon, RX+16, cy2+cardH*0.52);
    ctx.globalAlpha=1;

    var textX = RX + 64;
    var textW = RW - 74;

    // Label
    var lblSize = Math.max(16, Math.floor(cardH*0.18));
    ctx.fillStyle=pal.sub; ctx.font='300 '+lblSize+'px Jost,sans-serif';
    ctx.textAlign='left'; ctx.globalAlpha=0.75;
    ctx.fillText(c.label, textX, cy2+lblSize+Math.floor(cardH*0.14));
    ctx.globalAlpha=1;

    // Value
    var valSize = Math.min(36, Math.max(22, Math.floor(cardH*0.3)));
    ctx.fillStyle=pal.text; ctx.font='400 '+valSize+'px Jost,sans-serif';
    var valY = cy2+lblSize+Math.floor(cardH*0.14)+valSize+6;
    // truncate if too wide
    var valText = c.val;
    while(valText.length>4 && ctx.measureText(valText).width>textW) valText=valText.slice(0,-4)+'…';
    ctx.fillText(valText, textX, valY);

    // Sub
    if(c.sub){
      var subSize = Math.max(15, Math.floor(cardH*0.16));
      ctx.fillStyle=pal.acc; ctx.font='300 '+subSize+'px Jost,sans-serif'; ctx.globalAlpha=0.7;
      ctx.fillText(c.sub, textX, cy2+cardH-Math.floor(cardH*0.14));
      ctx.globalAlpha=1;
    }
    ctx.textAlign='center';
    cy2+=cardH+gap;
  });

  // === BOTTOM BAR ===
  var barY=H-botPad+4, barW2=W-60, barX2=30, barH2=4;
  var ovD=Math.round(avgLen*0.5);
  var bSegs=[{p:5/avgLen,c:'#d4756e'},{p:Math.max(0,(ovD-7))/avgLen,c:'#6ec497'},{p:4/avgLen,c:'#e8c050'},{p:(avgLen-ovD-1)/avgLen,c:'#a090d8'}];
  var bx=barX2; ctx.globalAlpha=0.25;
  bSegs.forEach(function(seg){ ctx.fillStyle=seg.c; ctx.fillRect(bx,barY,barW2*seg.p,barH2); bx+=barW2*seg.p; });
  ctx.globalAlpha=1;
  var dotX=barX2+barW2*((cycleDay-1)/Math.max(avgLen-1,1));
  ctx.save(); ctx.shadowColor=pal.acc; ctx.shadowBlur=12;
  ctx.fillStyle=pal.acc; ctx.beginPath(); ctx.arc(dotX,barY+barH2/2,7,0,Math.PI*2); ctx.fill(); ctx.restore();

  // Watermark
  ctx.fillStyle=pal.text; ctx.font='300 17px Jost,sans-serif'; ctx.globalAlpha=0.18; ctx.textAlign='center';
  ctx.fillText('The Sacred Cycle',W/2,H-12); ctx.globalAlpha=1;

  return canvas;
}

// ── Canvas helpers ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function sectionLabel(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = '500 22px Jost, sans-serif';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
}

function statRow(ctx, icon, label, val, x, y, color) {
  ctx.textAlign = 'left';
  ctx.font = '34px serif';
  ctx.fillStyle = '#000';
  ctx.globalAlpha = 0.85;
  ctx.fillText(icon, x, y+16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#777';
  ctx.font = '300 22px Jost, sans-serif';
  ctx.fillText(label, x+50, y+4);
  ctx.fillStyle = color;
  ctx.font = '500 30px Jost, sans-serif';
  ctx.fillText(val, x+50, y+38);
  ctx.textAlign = 'center';
}

function dividerLine(ctx, x, y, endX, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function shadeColor(hex, pct) {
  var num = parseInt(hex.slice(1), 16);
  var r = Math.min(255, Math.max(0, (num>>16) + pct));
  var g = Math.min(255, Math.max(0, ((num>>8)&0xff) + pct));
  var b = Math.min(255, Math.max(0, (num&0xff) + pct));
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

function showReportCard() {
  var canvas = generateReportCard();
  
  // Create full-screen overlay to preview + share
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;overflow:hidden;padding:calc(env(safe-area-inset-top)+18px) 16px calc(env(safe-area-inset-bottom)+18px);';

  var img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  img.style.cssText = 'display:block;width:auto;height:auto;max-width:calc(100vw - 32px);max-height:calc(100dvh - 150px);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);object-fit:contain;flex:0 1 auto;';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;width:100%;max-width:420px;flex-shrink:0;';

  var saveBtn = document.createElement('button');
  saveBtn.textContent = '⬇ save';
  saveBtn.style.cssText = 'flex:1;padding:14px;background:#b05a52;color:#fff;border:none;border-radius:12px;font-size:.88rem;font-family:Jost,sans-serif;cursor:pointer;letter-spacing:.06em;';
  saveBtn.onclick = function() {
    var a = document.createElement('a');
    a.download = 'my-cycle-portrait.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  var shareBtn = document.createElement('button');
  shareBtn.textContent = '✦ share';
  shareBtn.style.cssText = 'flex:1;padding:14px;background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);border-radius:12px;font-size:.88rem;font-family:Jost,sans-serif;cursor:pointer;letter-spacing:.06em;';
  shareBtn.onclick = function() {
    canvas.toBlob(function(blob) {
      var file = new File([blob], 'cycle-portrait.png', {type:'image/png'});
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        navigator.share({files:[file], title:'My Cycle Portrait', text:'tracked with The Sacred Cycle'})
          .catch(function(){});
      } else if (navigator.share) {
        navigator.share({title:'My Cycle Portrait', text:'tracked with The Sacred Cycle', url:window.location.href})
          .catch(function(){});
      } else {
        saveBtn.click();
      }
    }, 'image/png');
  };

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top)+14px);right:16px;background:rgba(255,255,255,0.16);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:1rem;cursor:pointer;z-index:501;backdrop-filter:blur(8px);';
  closeBtn.onclick = function() { overlay.remove(); };

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(shareBtn);
  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  overlay.appendChild(btnRow);
  document.body.appendChild(overlay);
}

function exportCycleReport() {
  var W = 1080, H = 1350;
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');
  var phase = getPhase(getCycleDay(), getPredictionCycleLength());
  var colors = { menstrual:'#b05a52', follicular:'#5a8a6a', ovulatory:'#b8832a', luteal:'#6a5a9a' };
  var brand = colors[phase.name] || '#b05a52';
  ctx.fillStyle = '#fdf0ee';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = brand;
  ctx.font = '48px Georgia,serif';
  ctx.textAlign = 'center';
  ctx.fillText('The Sacred Cycle Report', W/2, 90);
  ctx.font = '28px Jost, sans-serif';
  ctx.fillStyle = '#6b3d38';
  ctx.fillText('day ' + getCycleDay() + ' · ' + phase.name + ' · ' + todayStr(), W/2, 132);

  var y = 210;
  function section(title, lines) {
    ctx.fillStyle = brand;
    ctx.font = '26px Jost, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title.toUpperCase(), 90, y);
    y += 38;
    ctx.fillStyle = '#2c1a18';
    ctx.font = '31px Georgia,serif';
    lines.forEach(function(line) {
      y = wrapCanvasText(ctx, line, 90, y, W - 180, 38) + 44;
    });
    y += 18;
  }

  var recapDates = getCurrentCycleDateRange();
  var fertility = getFertilitySignalSummary();
  section('Current Recap', [
    recapDates.length + ' logged day' + (recapDates.length===1?'':'s') + ' this cycle',
    fertility.likelyDate ? 'Likely ovulation around day ' + fertility.likelyDay + ' from ' + fertility.evidence : 'No confirmed ovulation signal yet'
  ]);

  var patterns = getAdvancedPatternInsights();
  section('Patterns', patterns.length ? patterns.slice(0,3) : ['Keep logging symptoms, mood, and fertility signs to reveal timing patterns.']);

  var flags = [];
  getCycleLengthHistory().forEach(function(len) {
    if (len < 21 || len > 35) flags.push('Cycle length worth noticing: ' + len + ' days');
  });
  if ((appState.profile.period_len || 5) > 7) flags.push('Bleed length is longer than 7 days.');
  section('Notes', flags.length ? flags.slice(0,3) : ['No gentle cycle flags yet. This report is educational, not diagnostic.']);

  ctx.fillStyle = '#9a6460';
  ctx.font = '22px Jost, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Not medical advice · Not contraception · Local-only data', W/2, H-54);

  var a = document.createElement('a');
  a.download = 'sacred-cycle-report-' + todayStr() + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  var words = String(text || '').split(' ');
  var line = '';
  words.forEach(function(word) {
    var test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
  return y;
}


function showPrivacyPolicy() {
  closeProfileMenu();
  var overlay = document.createElement('div');
  overlay.id = 'privacy-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:var(--bg);overflow-y:scroll;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top)+16px) 20px 80px;font-size:14px;';
  var html = '<div style="max-width:620px;margin:0 auto;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.4rem,5.5vw,1.8rem);color:var(--brand);">privacy policy</div>';
  html += '<button onclick="closePrivacyPolicy()" style="background:none;border:none;font-size:1.2rem;color:var(--text3);cursor:pointer;">&#10005;</button>';
  html += '</div>';
  html += '<div style="font-size:clamp(.62rem,2.4vw,.68rem);letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:24px;">last updated march 2026</div>';
  var secs = [
    ['what this app is','The Sacred Cycle is a personal cycle-tracking web application created by Taylor Rourke for wellness and educational purposes only. It is not a medical device and does not provide medical advice, diagnosis, or treatment.'],
    ['data you enter','The app stores the wellness data you choose to log — cycle dates, flow, mood, sleep, symptoms, notes, tasks, and habits. There is no account, email login, advertising profile, or payment data.'],
    ['how your data is used','Your data is used solely to power the app&#39;s features. It is never sold, shared with third parties, or used for advertising. The Sacred Cycle is completely ad-free.'],
    ['data storage and security','Your data is stored locally in this browser using localStorage on your device. It is not uploaded to The Sacred Cycle or Supabase. Anyone with access to this browser profile or device may be able to access the local app data.'],
    ['your control','You may export your data at any time from the profile menu and restore it later from a backup file. You can delete local app data by clearing this site&#39;s browser storage. All logging fields are optional.'],
    ['health information disclosure','All food, supplement, tea, and lifestyle recommendations are for educational purposes only, based on publicly available research and traditional wellness knowledge. They are not a substitute for professional medical advice. Always consult a qualified healthcare provider before changing your diet, supplements, or health practices — especially if pregnant, breastfeeding, trying to conceive, or managing a medical condition.'],
    ['not a contraceptive','The Sacred Cycle must not be used as contraception. Fertile window and ovulation estimates are based on average cycle math, not clinically validated predictions. Do not rely on this app to prevent pregnancy.'],
    ['third-party services','The app uses Google Fonts for typography. No Supabase, advertising networks, analytics trackers, or social media pixels are used.'],
    ['children','This app is intended for adults 18 and older. We do not knowingly collect data from anyone under 18.'],
    ['contact','Questions or data deletion requests: taylor@swapsmadesimple.com'],
  ];
  secs.forEach(function(s){
    html += '<div style="margin-bottom:20px;">';
    html += '<div style="font-size:clamp(.6rem,2.3vw,.66rem);letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin-bottom:6px;">'+s[0]+'</div>';
    html += '<div style="font-size:clamp(.8rem,3.2vw,.88rem);color:var(--text2);line-height:1.8;">'+s[1]+'</div>';
    html += '</div>';
  });
  html += '<div style="height:1px;background:var(--bg2);margin:24px 0;"></div>';
  html += '<div style="font-size:clamp(.66rem,2.5vw,.72rem);color:var(--text3);">The Sacred Cycle &#183; created with love by Taylor Rourke</div>';
  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

function closePrivacyPolicy() { var el = document.getElementById('privacy-overlay'); if (el) el.remove(); }

function showMaximizeGuide() {
  var overlay = document.createElement('div');
  overlay.id = 'maximize-guide-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:520;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top)+16px) 20px 80px;';
  var html = '<button onclick="closeMaximizeGuide()" style="position:fixed;top:calc(env(safe-area-inset-top)+14px);right:16px;background:var(--white);border:1px solid var(--bg2);color:var(--text3);width:36px;height:36px;border-radius:50%;font-size:1rem;cursor:pointer;box-shadow:var(--shadow);">✕</button>';
  html += '<div style="max-width:520px;margin:0 auto;padding-top:34px;">';
  html += '<div style="font-family:Cormorant Garamond,serif;font-size:clamp(1.5rem,6vw,2rem);color:var(--brand);margin-bottom:8px;">how to maximize this app</div>';
  html += '<div style="font-size:clamp(.8rem,3.1vw,.88rem);color:var(--text3);line-height:1.65;margin-bottom:18px;">The Sacred Cycle is part tracker, part pattern reader, part support library. You do not need to use every feature every day. The goal is to build a gentle body record that helps you understand your rhythm with more clarity over time.</div>';
  [
    ['today tab','Your calm daily home base. Use it for affirmation, phase context, mood, fertility signs if enabled, symptoms, support ideas, notes, and the opening or closing ritual.'],
    ['log tab','Your editable body record. Tap calendar days to set bleeding/flow or move a period start, use the date lookup for past days, and see only what was actually recorded.'],
    ['tasks tab','Use this for today’s focus list, task energy tags, rollover choices, and cycle-aware weekly planning. This keeps work planning separate from body logging.'],
    ['habits tab','Track supportive routines, water, and sleep. Use Today, Month, and Year views to see consistency without perfection. Habit goals can be daily, weekdays, 3x/week, or luteal-only.'],
    ['insights tab','This is where the app reads the data back to you in focused views: Overview for the essentials, Patterns for saved reads, and Reports for exports, hormones, predictions, and cycle history.'],
    ['support tab + library','Support gives phase-aware food, tea, supplement, movement, and lifestyle guidance. The library is the deeper learning space for hormones, phases, and cycle syncing.'],
    ['settings','Use Settings for profile details, cycle + tracking preferences, fertility signs, pregnancy mode, display, backups, guidance, and all customization.'],
    ['pregnancy mode','When enabled, period, ovulation, fertile-window, and cycle prediction surfaces pause. The app shifts toward symptom notes, habits, provider questions, and pregnancy-safe reminders.'],
    ['fertility signs','LH, mucus, BBT, and ovulation pain can refine ovulation timing, but they are context only. This app is not contraception and cannot confirm pregnancy or medical issues.'],
    ['symptom detail tracking','When a symptom is selected, add severity and duration when useful. This helps the app notice whether something is occasional, intense, all-day, or phase-linked.'],
    ['how insights get accurate','Small honest logs are better than perfect ones. The app uses repeated entries across days and cycles, and it should stay cautious until there is enough data.'],
    ['local data + backups','Your data is stored locally on this device. Export a private backup regularly, especially after customizing settings or building meaningful history.'],
    ['when to get support','Heavy bleeding, severe pain, very irregular cycles, pregnancy concerns, or symptoms that feel alarming deserve qualified medical care.']
  ].forEach(function(row) {
    html += '<div class="insight-mini-card">';
    html += '<div class="insight-mini-title">' + row[0] + '</div>';
    html += '<div class="insight-mini-body">' + row[1] + '</div>';
    html += '</div>';
  });
  html += '<div class="symptom-recs"><div class="symptom-recs-title">quick rhythm</div>';
  html += '<div style="font-size:clamp(.76rem,3vw,.82rem);color:var(--text2);line-height:1.8;">daily: Today check-in + Habits care basics<br>weekly: use Habits Plan for upcoming work<br>monthly: review Insights + export backup</div></div>';
  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

function closeMaximizeGuide() {
  var el = document.getElementById('maximize-guide-overlay');
  if (el) el.remove();
}

function logNavTo(dateStr) { haptic('light'); logViewDate = dateStr; renderLog(); document.getElementById('tab-content').scrollTop=0; }
function logLookupDate() {
  var input = document.getElementById('log-lookup-date');
  if (!input || !input.value) return;
  logNavTo(input.value);
}
function logGetLog(dateStr) {
  if (!appState.dayLogs) appState.dayLogs = {};
  if (!appState.dayLogs[dateStr]) appState.dayLogs[dateStr]={log_date:dateStr,tasks:[],symptoms:[],intimate:false,mood_emoji:[],mood_words:[],flow:'',water:0,sleep:'',note:''};
  return appState.dayLogs[dateStr];
}
function logSaveDay(dateStr) {
  if (appState.dayLogs && appState.dayLogs[dateStr] && !hasRecordedDayLog(appState.dayLogs[dateStr])) {
    delete appState.dayLogs[dateStr];
  }
  lsSet('dayData', appState.dayLogs);
  showSync('saved');
  if (dateStr === todayStr()) { renderToday(); updatePhaseDisplay(); }
  renderInsights();
}
function logToggleIntimacy(d) { haptic('medium'); var l=logGetLog(d); l.intimate=!l.intimate; logSaveDay(d); renderLog(); }
function logSetFlow(d,v) { haptic('light'); var l=logGetLog(d); l.flow=l.flow===v?'':v; logSaveDay(d); renderLog(); }
function logSetFertilitySign(d,k,v) { haptic('light'); var l=logGetLog(d); var f=getFertility(l); f[k]=f[k]===v?'':v; logSaveDay(d); renderLog(); renderInsights(); }
function logSetFertilityBBT(d,v) { var l=logGetLog(d); var f=getFertility(l); f.bbt=v?String(v):''; logSaveDay(d); renderInsights(); }
function logToggleFertilityPain(d) { haptic('light'); var l=logGetLog(d); var f=getFertility(l); f.ovulation_pain=!f.ovulation_pain; logSaveDay(d); renderLog(); renderInsights(); }
function logToggleMoodEmoji(d,emoji) { haptic('light'); var l=logGetLog(d); if(!l.mood_emoji)l.mood_emoji=[]; var i=l.mood_emoji.indexOf(emoji); if(i>-1)l.mood_emoji.splice(i,1);else l.mood_emoji.push(emoji); logSaveDay(d); renderLog(); }
function logToggleMoodWord(d,word) { haptic('light'); var l=logGetLog(d); if(!l.mood_words)l.mood_words=[]; var i=l.mood_words.indexOf(word); if(i>-1)l.mood_words.splice(i,1);else l.mood_words.push(word); logSaveDay(d); renderLog(); }
function logSetSleep(d,v) { haptic('light'); var l=logGetLog(d); l.sleep=l.sleep===v?'':v; logSaveDay(d); renderLog(); }
function logToggleSymptom(d,name) { haptic('light'); var l=logGetLog(d); if(!l.symptoms)l.symptoms=[]; var i=l.symptoms.indexOf(name); if(i>-1){ l.symptoms.splice(i,1); if(l.symptom_details) delete l.symptom_details[name]; } else { l.symptoms.push(name); var details=getSymptomDetails(l); if(!details[name]) details[name]={severity:'',duration:''}; } logSaveDay(d); renderLog(); }
function logSetSymptomDetail(d,name,key,value) { var l=logGetLog(d); if(!l.symptoms)l.symptoms=[]; if(l.symptoms.indexOf(name)===-1) l.symptoms.push(name); var details=getSymptomDetails(l); if(!details[name]) details[name]={severity:'',duration:''}; details[name][key]=details[name][key]===value?'':value; logSaveDay(d); renderLog(); }
function logSaveNote(d) { var a=document.getElementById('log-note-area'); if(!a)return; var l=logGetLog(d); l.note=a.value; logSaveDay(d); }


// ═══════════════════════════════════════════
// AUTO-UPDATE CHECK
// ═══════════════════════════════════════════
function checkForAppUpdate() {
  // Fetch the version file bypassing cache with a timestamp query param.
  var url = 'js/state.js?v=' + Date.now();
  fetch(url, { cache: 'no-store' })
    .then(function(res){ return res.text(); })
    .then(function(html) {
      var m = html.match(/var APP_VERSION = '([^']+)'/);
      if (!m) return;
      var liveVersion = m[1];
      if (liveVersion !== APP_VERSION) {
        showUpdateBanner();
      }
    })
    .catch(function(){}); // fail silently — no internet is fine
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom)+70px);left:50%;transform:translateX(-50%);background:var(--brand);color:#fff;border-radius:20px;padding:10px 20px;font-family:Jost,sans-serif;font-size:.8rem;letter-spacing:.06em;box-shadow:0 4px 20px rgba(176,90,82,.35);z-index:999;display:flex;align-items:center;gap:12px;white-space:nowrap;';
  banner.innerHTML = '<span>✦ update available</span><button onclick="window.location.reload(true)" style="background:rgba(255,255,255,.25);border:none;border-radius:12px;color:#fff;padding:5px 12px;font-size:.78rem;cursor:pointer;font-family:Jost,sans-serif;">reload</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:1rem;cursor:pointer;padding:0 4px;">✕</button>';
  document.body.appendChild(banner);
}

// ═══════════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════════
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') {
    clearTimeout(saveTodayTimer);
    flushPendingTextInputs();
  }
});


if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Prevent body scroll/drag on iOS, but allow intentional scroll containers and full-screen guides.
document.body.addEventListener('touchmove', function(e) {
  if (e.target && e.target.closest && e.target.closest('#tab-content, #maximize-guide-overlay, #privacy-overlay, #settings-overlay, #ob-overlay')) return;
  e.preventDefault();
}, { passive: false });
