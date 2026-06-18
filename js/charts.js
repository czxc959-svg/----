/* ============================================
   FlowMind — 图表统计模块（全栈版）
   数据优先从 /api/stats 接口获取
   前端计算作为降级方案
   ============================================ */

// ============================================
// 主入口：从 API 获取数据后渲染
// ============================================
async function renderCharts() {
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
    console.warn('API 图表加载失败，降级到前端计算:', err.message);
    renderBarChart();
    renderDonutChart();
    renderPriorityBars();
    updateKPIs();
    generateInsights();
  }
}

// ============================================
// 近7天柱状图（使用 API 数据）
// ============================================
function renderBarChartFromData(days) {
  const container = document.getElementById('bar-chart');
  if (!container || !days) return;
  const maxVal = Math.max(...days.map(d => d.tasks), 1);
  container.innerHTML = days.map(d => {
    const height = Math.max((d.tasks / maxVal) * 110, 4);
    return `
      <div class="bar-group">
        <div class="bar-val">${d.tasks}</div>
        <div class="bar-fill" style="height:${height}px;" title="${d.label}: ${d.tasks} 个任务"></div>
        <div class="bar-day">${d.label}</div>
      </div>
    `;
  }).join('');
}

// 降级版（前端计算）
function renderBarChart() {
  const container = document.getElementById('bar-chart');
  if (!container) return;
  const weekdays = ['日','一','二','三','四','五','六'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = appState.tasks.filter(t =>
      t.completed && t.completedAt?.startsWith(dateStr)
    ).length;
    days.push({ label: i===0?'今天':(i===1?'昨天':`周${weekdays[d.getDay()]}`), tasks: count });
  }
  renderBarChartFromData(days);
}

// ============================================
// 分类环形图
// ============================================
function renderDonutChartFromData(byCategory) {
  const svg    = document.getElementById('donut-chart');
  const legend = document.getElementById('donut-legend');
  if (!svg || !legend) return;

  const colorMap = {
    work:     { color: '#a78bfa', label: '💼 工作' },
    study:    { color: '#60a5fa', label: '📚 学习' },
    personal: { color: '#f59e0b', label: '🏠 生活' },
    health:   { color: '#34d399', label: '💪 健康' },
    other:    { color: '#f472b6', label: '🗂️ 其他' }
  };

  if (!byCategory || byCategory.length === 0) {
    svg.innerHTML = `
      <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="20"/>
      <text x="80" y="88" text-anchor="middle" fill="#475569" font-size="12">暂无数据</text>
    `;
    legend.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted)">添加任务后显示分布</span>';
    return;
  }

  const total = byCategory.reduce((s, r) => s + r.total, 0) || 1;
  const circ  = 2 * Math.PI * 60;
  let offset  = 0;
  let svgStr  = '';

  byCategory.forEach(row => {
    const pct     = row.total / total;
    const dashLen = pct * circ;
    const info    = colorMap[row.category] || { color: '#94a3b8', label: row.category };
    svgStr += `<circle cx="80" cy="80" r="60"
      fill="none" stroke="${info.color}" stroke-width="20"
      stroke-dasharray="${dashLen} ${circ - dashLen}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 80 80)">
      <title>${info.label}: ${row.total} (${Math.round(pct*100)}%)</title>
    </circle>`;
    offset += dashLen;
  });

  svgStr += `
    <text x="80" y="76" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="800">${total}</text>
    <text x="80" y="94" text-anchor="middle" fill="var(--text-muted)" font-size="10">总任务</text>
  `;
  svg.innerHTML = svgStr;

  legend.innerHTML = byCategory.map(row => {
    const info = colorMap[row.category] || { color: '#94a3b8', label: row.category };
    return `<div class="legend-item">
      <span class="legend-dot" style="background:${info.color}"></span>
      <span>${info.label} ${Math.round((row.total/total)*100)}%</span>
    </div>`;
  }).join('');
}

function renderDonutChart() {
  const counts = {};
  appState.tasks.forEach(t => { counts[t.category] = (counts[t.category]||0)+1; });
  const rows = Object.entries(counts).map(([category,total]) => ({ category, total }));
  renderDonutChartFromData(rows);
}

// ============================================
// 优先级完成率条形图
// ============================================
function renderPriorityBarsFromData(byPriority) {
  const container = document.getElementById('priority-bars');
  if (!container) return;

  const priorities = [
    { key: 'high',   label: '🔴 高优先级', color: 'var(--red)' },
    { key: 'medium', label: '🟡 中优先级', color: 'var(--orange)' },
    { key: 'low',    label: '🟢 低优先级', color: 'var(--green)' }
  ];

  container.innerHTML = priorities.map(p => {
    const row  = byPriority?.find(r => r.priority === p.key) || { total: 0, done: 0 };
    const pct  = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
    return `
      <div class="priority-bar-item">
        <div class="priority-bar-header">
          <span class="priority-bar-label">${p.label}</span>
          <span class="priority-bar-pct">${row.done}/${row.total} (${pct}%)</span>
        </div>
        <div class="priority-bar-track">
          <div class="priority-bar-fill" style="width:${pct}%;background:${p.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPriorityBars() {
  const byPriority = ['high','medium','low'].map(key => ({
    priority: key,
    total: appState.tasks.filter(t => t.priority === key).length,
    done:  appState.tasks.filter(t => t.priority === key && t.completed).length
  }));
  renderPriorityBarsFromData(byPriority);
}

// ============================================
// KPI 卡片（使用 API 数据）
// ============================================
function updateKPIsFromData(statsData) {
  const { tasks, pomodoro } = statsData;
  document.getElementById('kpi-total-done').textContent     = tasks.done;
  document.getElementById('kpi-focus-total').textContent    = pomodoro.totalMinutes;
  document.getElementById('kpi-streak').textContent         = appState.streak || 0;
  document.getElementById('kpi-completion-rate').textContent= tasks.completionRate + '%';

  const trendDone = document.getElementById('kpi-trend-done');
  if (trendDone) {
    trendDone.textContent  = tasks.done >= 10 ? '🏆 任务达人！' : '↑ 持续进步中';
    trendDone.className = 'kpi-trend positive';
  }
  const trendFocus = document.getElementById('kpi-trend-focus');
  if (trendFocus) {
    trendFocus.textContent = pomodoro.totalMinutes >= 120 ? '🏆 专注大师！' : '🍅 番茄钟达人';
  }
}

function updateKPIs() {
  const done    = appState.tasks.filter(t => t.completed).length;
  const total   = appState.tasks.length;
  const minutes = appState.pomodoroHistory.reduce((s,r) => s+r.minutes, 0);
  const rate    = total > 0 ? Math.round((done/total)*100) : 0;
  document.getElementById('kpi-total-done').textContent     = done;
  document.getElementById('kpi-focus-total').textContent    = minutes;
  document.getElementById('kpi-streak').textContent         = appState.streak || 0;
  document.getElementById('kpi-completion-rate').textContent= rate + '%';
}

// ============================================
// AI 数据洞察（使用 API 数据）
// ============================================
function generateInsightsFromData(statsData, weeklyData) {
  const container = document.getElementById('insight-content');
  if (!container) return;

  const { tasks, pomodoro, byCategory, byPriority } = statsData;
  const insights = [];

  // 总体完成率
  if (tasks.total === 0) {
    insights.push('📭 你还没有创建任何任务。添加第一个任务来开始使用 FlowMind！');
  } else {
    insights.push(`📊 总体完成率 <strong>${tasks.completionRate}%</strong>（${tasks.done}/${tasks.total}）。
      ${tasks.completionRate >= 80 ? '非常出色！你是效率达人 🏆' : tasks.completionRate >= 50 ? '不错的进展，继续保持！' : '还有提升空间，试试番茄钟提高专注度。'}`);
  }

  // 高优先级分析
  const highRow = byPriority?.find(r => r.priority === 'high');
  if (highRow && highRow.total > 0) {
    const rate = Math.round((highRow.done / highRow.total) * 100);
    insights.push(`🎯 高优先级完成率 <strong>${rate}%</strong>（${highRow.done}/${highRow.total}）。
      ${rate >= 70 ? '重要任务处理得很好！' : '建议优先处理高优先级任务，避免逾期。'}`);
  }

  // 逾期提醒
  if (tasks.overdue > 0) {
    insights.push(`⚠️ 有 <strong>${tasks.overdue}</strong> 个任务已逾期，请立即处理或调整截止日期。`);
  }

  // 番茄钟分析
  if (pomodoro.totalSessions > 0) {
    insights.push(`🍅 累计完成 <strong>${pomodoro.totalSessions}</strong> 轮番茄钟，专注 <strong>${pomodoro.totalMinutes}</strong> 分钟。
      ${pomodoro.totalSessions >= 8 ? '你的专注力令人敬佩！' : '每天坚持4轮番茄钟，效率显著提升！'}`);
  } else {
    insights.push('🍅 你还没有使用番茄钟功能。研究表明番茄工作法可显著提升专注力，推荐试试！');
  }

  // 7天趋势
  if (weeklyData && weeklyData.length > 0) {
    const recentDays = weeklyData.slice(-3);
    const avgTasks   = recentDays.reduce((s,d) => s+d.tasks, 0) / recentDays.length;
    insights.push(`📈 近3天平均每天完成 <strong>${avgTasks.toFixed(1)}</strong> 个任务。
      ${avgTasks >= 3 ? '保持这个节奏，非常高效！' : '尝试每天设定3个以上核心任务来提高产出。'}`);
  }

  // 最活跃分类
  if (byCategory && byCategory.length > 0) {
    const top = byCategory.sort((a,b) => b.total-a.total)[0];
    const catLabel = getCategoryName(top.category);
    insights.push(`📁 任务主要集中在「${catLabel}」分类（${top.total}个）。适当均衡各方面，全面发展更有益。`);
  }

  container.innerHTML = insights.map((text, i) =>
    `<div class="insight-item" style="animation-delay:${i*0.1}s">${text}</div>`
  ).join('');
}

function generateInsights() {
  const tasks   = appState.tasks;
  const insights= [];
  const total   = tasks.length;
  const done    = tasks.filter(t=>t.completed).length;
  const rate    = total>0?Math.round((done/total)*100):0;

  if (!total) {
    insights.push('📭 你还没有创建任何任务。添加第一个任务来开始使用 FlowMind！');
  } else {
    insights.push(`📊 总体完成率 <strong>${rate}%</strong>（${done}/${total}）。${rate>=80?'非常出色！':rate>=50?'不错的进展！':'还有提升空间。'}`);
  }

  const minutes = appState.pomodoroHistory.reduce((s,r)=>s+r.minutes,0);
  const sessions= appState.pomodoroHistory.reduce((s,r)=>s+r.sessions,0);
  if (sessions>0) {
    insights.push(`🍅 累计 <strong>${sessions}</strong> 轮番茄钟，专注 <strong>${minutes}</strong> 分钟。`);
  } else {
    insights.push('🍅 还没有使用番茄钟，推荐试试！');
  }

  const container = document.getElementById('insight-content');
  if (container) {
    container.innerHTML = insights.map((text,i)=>
      `<div class="insight-item" style="animation-delay:${i*0.1}s">${text}</div>`
    ).join('');
  }
}
