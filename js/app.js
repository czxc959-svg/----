/* ============================================
   FlowMind — 核心应用逻辑（全栈版）
   所有数据通过 REST API 与后端交互
   ============================================ */

// ---- API 基础 URL ----
const API_BASE = '/api';

// ---- 全局状态（内存缓存，与后端同步）----
let appState = {
  tasks: [],
  pomodoroHistory: [],   // [{ date, sessions, minutes }]
  streak: 0,
  filter: 'all',
  currentTab: 'tasks'
};

// ============================================
// API 请求封装
// ============================================
async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const config = {
    headers: { ...defaultHeaders, ...(options.headers || {}) },
    ...options
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data;
}

const api = {
  // 任务
  getTasks:        ()         => apiFetch('/tasks'),
  createTask:      (body)     => apiFetch('/tasks', { method: 'POST', body }),
  updateTask:      (id, body) => apiFetch(`/tasks/${id}`, { method: 'PUT', body }),
  toggleTask:      (id)       => apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' }),
  deleteTask:      (id)       => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
  clearCompleted:  ()         => apiFetch('/tasks/completed/all', { method: 'DELETE' }),

  // 番茄钟
  getPomodoroAll:  ()         => apiFetch('/pomodoro'),
  getPomodoroToday:()         => apiFetch('/pomodoro/today'),
  recordPomodoro:  (minutes)  => apiFetch('/pomodoro', { method: 'POST', body: { minutes } }),

  // 统计
  getStats:        ()         => apiFetch('/stats'),
  getWeeklyStats:  ()         => apiFetch('/stats/weekly'),
  getSummary:      ()         => apiFetch('/stats/summary'),

  // 健康检查
  health:          ()         => apiFetch('/health')
};

// ============================================
// 初始化
// ============================================
async function initApp() {
  showLoadingOverlay();
  try {
    // 并行加载任务和番茄钟历史
    const [tasksRes, pomoRes] = await Promise.all([
      api.getTasks(),
      api.getPomodoroAll()
    ]);
    appState.tasks           = tasksRes.data || [];
    appState.pomodoroHistory = pomoRes.data  || [];

    updateStreak();
    updateDateDisplay();
    renderTasks();
    updateStats();
    updateProgress();
    populateFocusSelect();
    generateAISuggestions();
    initParticles();
    updatePomodoroStats();
    showToast('✅ 数据加载成功', 'success');
  } catch (err) {
    console.error('初始化失败:', err);
    showToast('⚠️ 无法连接服务器，请确认 npm run dev 已启动', 'error');
    // 降级：使用本地缓存
    const saved = localStorage.getItem('flowmind_backup');
    if (saved) {
      try { appState.tasks = JSON.parse(saved); } catch {}
    }
    renderTasks();
    updateStats();
    updateProgress();
  } finally {
    hideLoadingOverlay();
  }
}

// ============================================
// Tab 切换
// ============================================
function switchTab(tab) {
  appState.currentTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).setAttribute('aria-selected', 'true');

  document.querySelectorAll('.panel').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  const panel = document.getElementById('panel-' + tab);
  panel.style.display = 'block';
  panel.classList.add('active');

  if (tab === 'stats') {
    renderChartsFromAPI();
  }
  if (tab === 'pomodoro') {
    populateFocusSelect();
    updatePomodoroStats();
  }
}

// ============================================
// 日期 & 连续天数
// ============================================
function updateDateDisplay() {
  const now = new Date();
  const el  = document.getElementById('date-display');
  if (el) el.textContent = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
}

function updateStreak() {
  const today  = getTodayStr();
  const storedStreak     = parseInt(localStorage.getItem('fm_streak') || '0');
  const storedLastActive = localStorage.getItem('fm_last_active') || '';

  let newStreak = storedStreak;
  if (storedLastActive === today) {
    // 今天已打过卡
  } else if (storedLastActive) {
    const diff = Math.floor((new Date(today) - new Date(storedLastActive)) / 86400000);
    newStreak = diff === 1 ? storedStreak + 1 : 1;
  } else {
    newStreak = 1;
  }

  localStorage.setItem('fm_streak', newStreak);
  localStorage.setItem('fm_last_active', today);
  appState.streak = newStreak;

  const el = document.getElementById('streak-count');
  if (el) el.textContent = newStreak;
}

// ============================================
// 加载遮罩
// ============================================
function showLoadingOverlay() {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999;
      background:rgba(10,10,20,0.85);
      backdrop-filter:blur(12px);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    `;
    overlay.innerHTML = `
      <div style="width:48px;height:48px;border:3px solid rgba(167,139,250,0.2);border-top-color:#a78bfa;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <p style="color:#94a3b8;font-size:0.9rem;">正在连接服务器...</p>
    `;
    document.body.appendChild(overlay);
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s';
    setTimeout(() => overlay.remove(), 400);
  }
}

// ============================================
// Toast 通知
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// 工具函数
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getCategoryName(cat) {
  const map = { work: '💼 工作', study: '📚 学习', personal: '🏠 生活', health: '💪 健康', other: '🗂️ 其他' };
  return map[cat] || cat;
}

function getPriorityLabel(p) {
  const map = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };
  return map[p] || p;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// 粒子背景
// ============================================
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  const particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
      color: Math.random() > 0.5 ? '167, 139, 250' : '96, 165, 250'
    };
  }

  resize();
  for (let i = 0; i < 50; i++) particles.push(makeParticle());
  window.addEventListener('resize', resize);

  (function draw() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > width)  p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 150) {
          ctx.strokeStyle = `rgba(167,139,250,${0.08 * (1 - d / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  })();
}

// ============================================
// 统计图表入口（从 API 获取数据）
// ============================================
async function renderChartsFromAPI() {
  try {
    const [statsRes, weeklyRes] = await Promise.all([
      api.getStats(),
      api.getWeeklyStats()
    ]);
    renderBarChartFromData(weeklyRes.data);
    renderDonutChartFromData(statsRes.data.byCategory);
    renderPriorityBarsFromData(statsRes.data.byPriority);
    updateKPIsFromData(statsRes.data);
    generateInsightsFromData(statsRes.data, weeklyRes.data);
  } catch (err) {
    console.error('图表加载失败:', err);
    // 降级到前端计算
    renderCharts();
  }
}

// 入口（stats.js 中定义，这里提供后备）
if (typeof renderCharts === 'undefined') {
  window.renderCharts = renderChartsFromAPI;
}

// 初始化
document.addEventListener('DOMContentLoaded', initApp);
