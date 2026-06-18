/* ============================================
   FlowMind — 番茄钟模块（全栈版）
   完成一轮后通过 API 记录到 SQLite / JSON DB
   ============================================ */

let pomodoroState = {
  mode: 'focus',
  isRunning: false,
  timeLeft: 25 * 60,
  totalTime: 25 * 60,
  session: 1,
  maxSessions: 4,
  interval: null,
  activeNoise: null
};

let POMO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const POMO_LABELS    = { focus: '专注时间', short: '短休息', long: '长休息' };

// ---- 初始化设置 ----
function initPomodoroSettings() {
  const saved = localStorage.getItem('fm_pomo_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.focus) POMO_DURATIONS.focus = parsed.focus * 60;
      if (parsed.short) POMO_DURATIONS.short = parsed.short * 60;
      if (parsed.long)  POMO_DURATIONS.long  = parsed.long * 60;
    } catch(e) {}
  }
  updatePomoLabels();
  if (!pomodoroState.isRunning) {
    pomodoroState.timeLeft = POMO_DURATIONS[pomodoroState.mode];
    pomodoroState.totalTime = POMO_DURATIONS[pomodoroState.mode];
    updateTimerDisplay();
  }
}

// 确保 DOM 加载后初始化设置
document.addEventListener('DOMContentLoaded', initPomodoroSettings);

function updatePomoLabels() {
  const lf = document.getElementById('label-focus');
  const ls = document.getElementById('label-short');
  const ll = document.getElementById('label-long');
  if (lf) lf.textContent = Math.round(POMO_DURATIONS.focus / 60);
  if (ls) ls.textContent = Math.round(POMO_DURATIONS.short / 60);
  if (ll) ll.textContent = Math.round(POMO_DURATIONS.long / 60);
}

// ---- 设置模态框 ----
function openPomoSettings() {
  document.getElementById('setting-focus-time').value = Math.round(POMO_DURATIONS.focus / 60);
  document.getElementById('setting-short-time').value = Math.round(POMO_DURATIONS.short / 60);
  document.getElementById('setting-long-time').value  = Math.round(POMO_DURATIONS.long / 60);
  document.getElementById('pomo-settings-overlay').style.display = 'flex';
}

function closePomoSettings(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('pomo-settings-overlay').style.display = 'none';
}

function savePomoSettings() {
  const f = parseInt(document.getElementById('setting-focus-time').value) || 25;
  const s = parseInt(document.getElementById('setting-short-time').value) || 5;
  const l = parseInt(document.getElementById('setting-long-time').value) || 15;
  
  POMO_DURATIONS.focus = f * 60;
  POMO_DURATIONS.short = s * 60;
  POMO_DURATIONS.long  = l * 60;
  
  localStorage.setItem('fm_pomo_settings', JSON.stringify({ focus: f, short: s, long: l }));
  
  updatePomoLabels();
  if (!pomodoroState.isRunning) {
    pomodoroState.timeLeft = POMO_DURATIONS[pomodoroState.mode];
    pomodoroState.totalTime = POMO_DURATIONS[pomodoroState.mode];
    updateTimerDisplay();
  }
  closePomoSettings();
  showToast('✅ 番茄钟时长已更新', 'success');
}

// ---- 控制逻辑 ----
function setPomodoroMode(mode) {
  pomodoroState.mode      = mode;
  pomodoroState.timeLeft  = POMO_DURATIONS[mode];
  pomodoroState.totalTime = POMO_DURATIONS[mode];
  if (pomodoroState.isRunning) {
    clearInterval(pomodoroState.interval);
    pomodoroState.isRunning = false;
  }
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('mode-' + mode)?.classList.add('active');
  updateTimerDisplay();
  updateTimerUI();
}

function togglePomodoro() {
  pomodoroState.isRunning ? pausePomodoro() : startPomodoro();
}

function startPomodoro() {
  pomodoroState.isRunning = true;
  updateTimerUI();
  pomodoroState.interval = setInterval(() => {
    pomodoroState.timeLeft--;
    if (pomodoroState.timeLeft <= 0) {
      clearInterval(pomodoroState.interval);
      pomodoroState.isRunning = false;
      onPomodoroComplete();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function pausePomodoro() {
  clearInterval(pomodoroState.interval);
  pomodoroState.isRunning = false;
  updateTimerUI();
}

function resetPomodoro() {
  clearInterval(pomodoroState.interval);
  pomodoroState.isRunning = false;
  pomodoroState.timeLeft  = POMO_DURATIONS[pomodoroState.mode];
  pomodoroState.totalTime = POMO_DURATIONS[pomodoroState.mode];
  updateTimerDisplay();
  updateTimerUI();
}

function skipPomodoro() {
  clearInterval(pomodoroState.interval);
  pomodoroState.isRunning = false;
  onPomodoroComplete();
}

// ---- 一轮完成 ----
async function onPomodoroComplete() {
  const audio = document.getElementById('audio-complete');
  if (audio) {
    audio.play().catch(e => console.warn("无法播放完成音效", e));
  }

  if (pomodoroState.mode === 'focus') {
    const minStr = Math.round(POMO_DURATIONS.focus / 60);
    await recordPomodoroSession(minStr);
    showToast('🍅 专注完成！休息一下吧~', 'success');
    if (pomodoroState.session >= pomodoroState.maxSessions) {
      pomodoroState.session = 1;
      setPomodoroMode('long');
    } else {
      pomodoroState.session++;
      setPomodoroMode('short');
    }
  } else {
    showToast('⏰ 休息结束，准备新一轮专注！', 'info');
    setPomodoroMode('focus');
  }
  updateTimerDisplay();
  updateTimerUI();
  updatePomodoroStats();
}

// ---- 记录到后端 ----
async function recordPomodoroSession(minutes = 25) {
  try {
    const res = await api.recordPomodoro(minutes);

    const today = getTodayStr();
    const idx   = appState.pomodoroHistory.findIndex(r => r.date === today);
    if (idx >= 0) {
      appState.pomodoroHistory[idx] = res.data;
    } else {
      appState.pomodoroHistory.unshift(res.data);
    }
  } catch (err) {
    console.error('番茄钟记录失败:', err);
    showToast('⚠️ 记录失败，请检查服务器连接', 'warning');
  }
}

// ---- 更新计时器显示 ----
function updateTimerDisplay() {
  const m       = Math.floor(pomodoroState.timeLeft / 60);
  const s       = pomodoroState.timeLeft % 60;
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  document.getElementById('timer-display').textContent      = display;
  document.getElementById('timer-mode-label').textContent   = POMO_LABELS[pomodoroState.mode];
  document.getElementById('timer-session').textContent      = `第 ${pomodoroState.session} / ${pomodoroState.maxSessions} 轮`;

  const total  = POMO_DURATIONS[pomodoroState.mode];
  const offset = 723 - ((total - pomodoroState.timeLeft) / total) * 723;
  const circle = document.getElementById('timer-circle');
  if (circle) circle.style.strokeDashoffset = offset;

  document.title = pomodoroState.isRunning
    ? `${display} - ${POMO_LABELS[pomodoroState.mode]} | FlowMind`
    : 'FlowMind — AI 驱动的智能任务管理器';
}

function updateTimerUI() {
  const playIcon = document.getElementById('play-icon');
  const pauseIcon= document.getElementById('pause-icon');
  const label    = document.getElementById('btn-toggle-label');

  if (pomodoroState.isRunning) {
    playIcon.style.display  = 'none';
    pauseIcon.style.display = 'block';
    label.textContent       = '暂停';
  } else {
    playIcon.style.display  = 'block';
    pauseIcon.style.display = 'none';
    label.textContent = pomodoroState.mode === 'focus' ? '开始专注' : '开始休息';
  }
}

// ---- 从本地缓存更新番茄钟统计 ----
function updatePomodoroStats() {
  const today   = getTodayStr();
  const record  = appState.pomodoroHistory.find(r => r.date === today);
  const sessions= record ? record.sessions : 0;
  const minutes = record ? record.minutes  : 0;

  document.getElementById('pomo-completed').textContent = sessions;
  document.getElementById('pomo-minutes').textContent   = minutes;

  const history = document.getElementById('pomo-history');
  if (!history) return;
  history.innerHTML = '';
  if (sessions === 0) {
    history.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted)">暂无记录，开始第一个番茄吧！</span>';
    return;
  }
  for (let i = 0; i < sessions; i++) {
    const t = document.createElement('span');
    t.className = 'pomo-tomato';
    t.textContent = '🍅';
    t.style.animationDelay = `${i * 0.1}s`;
    history.appendChild(t);
  }
}

// ---- 闪念笔记自动保存逻辑 ----
function initQuickNotes() {
  const textarea = document.getElementById('quick-notes');
  const statusEl = document.getElementById('quick-notes-status');
  if (!textarea) return;

  // 加载已存笔记
  const savedNotes = localStorage.getItem('fm_quick_notes');
  if (savedNotes) {
    textarea.value = savedNotes;
  }

  // 监听输入自动保存（防抖）
  let timeoutId;
  textarea.addEventListener('input', () => {
    if (statusEl) statusEl.textContent = '保存中...';
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      localStorage.setItem('fm_quick_notes', textarea.value);
      if (statusEl) statusEl.textContent = '已保存';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    }, 800);
  });
}

document.addEventListener('DOMContentLoaded', initQuickNotes);
