/* ============================================
   FlowMind — 任务管理模块（全栈版）
   所有操作通过 API 与 SQLite 数据库交互
   ============================================ */

// ---- 添加任务 ----
async function addTask() {
  const input = document.getElementById('task-input');
  const text  = input.value.trim();
  if (!text) {
    showToast('⚠️ 请输入任务内容', 'warning');
    input.focus();
    return;
  }

  const btn = document.getElementById('btn-add-task');
  btn.disabled = true;

  try {
    const res = await api.createTask({
      text,
      priority: document.getElementById('task-priority').value,
      category: document.getElementById('task-category').value,
      due:      document.getElementById('task-due').value || null,
      note:     ''
    });

    // 更新本地缓存
    appState.tasks.unshift(res.data);
    // 备份到 localStorage（离线降级）
    localStorage.setItem('flowmind_backup', JSON.stringify(appState.tasks));

    input.value = '';
    input.focus();
    renderTasks();
    updateStats();
    updateProgress();
    populateFocusSelect();
    generateAISuggestions();
    showToast(`✅ 已添加: "${text.substring(0, 25)}"`, 'success');
  } catch (err) {
    showToast(`❌ 添加失败: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function handleTaskInputKey(event) {
  if (event.key === 'Enter') addTask();
}

// ---- 切换完成状态 ----
async function toggleTask(id) {
  // 乐观更新（立即 UI 响应）
  const task = appState.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  renderTasks();
  updateStats();
  updateProgress();

  try {
    const res = await api.toggleTask(id);
    // 用服务器返回值更新本地
    const idx = appState.tasks.findIndex(t => t.id === id);
    if (idx >= 0) appState.tasks[idx] = res.data;
    renderTasks();
    if (res.data.completed) {
      showToast(`✨ 完成: "${res.data.text.substring(0, 25)}"`, 'success');
    }
  } catch (err) {
    // 回滚乐观更新
    task.completed = !task.completed;
    task.completedAt = null;
    renderTasks();
    updateStats();
    showToast(`❌ 操作失败: ${err.message}`, 'error');
  }
}

// ---- 删除任务 ----
async function deleteTask(id) {
  const task = appState.tasks.find(t => t.id === id);
  if (!task) return;

  // 乐观移除
  appState.tasks = appState.tasks.filter(t => t.id !== id);
  renderTasks();
  updateStats();
  updateProgress();
  populateFocusSelect();

  try {
    await api.deleteTask(id);
    showToast(`🗑️ 已删除: "${task.text.substring(0, 25)}"`, 'info');
  } catch (err) {
    // 回滚
    appState.tasks.unshift(task);
    renderTasks();
    updateStats();
    showToast(`❌ 删除失败: ${err.message}`, 'error');
  }
}

// ---- 打开编辑模态框 ----
function editTask(id) {
  const task = appState.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('modal-task-id').value       = id;
  document.getElementById('modal-task-text').value     = task.text;
  document.getElementById('modal-task-priority').value = task.priority;
  document.getElementById('modal-task-category').value = task.category;
  document.getElementById('modal-task-due').value      = task.due || '';
  document.getElementById('modal-task-note').value     = task.note || '';
  document.getElementById('task-modal-overlay').style.display = 'flex';
}

function closeTaskModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('task-modal-overlay').style.display = 'none';
}

async function saveTaskEdit() {
  const id   = document.getElementById('modal-task-id').value;
  const task = appState.tasks.find(t => t.id === id);
  if (!task) return;

  const body = {
    text:     document.getElementById('modal-task-text').value.trim() || task.text,
    priority: document.getElementById('modal-task-priority').value,
    category: document.getElementById('modal-task-category').value,
    due:      document.getElementById('modal-task-due').value || null,
    note:     document.getElementById('modal-task-note').value.trim()
  };

  const btn = document.querySelector('.btn-save');
  if (btn) btn.disabled = true;

  try {
    const res = await api.updateTask(id, body);
    // 更新本地缓存
    const idx = appState.tasks.findIndex(t => t.id === id);
    if (idx >= 0) appState.tasks[idx] = res.data;

    closeTaskModal();
    renderTasks();
    updateStats();
    populateFocusSelect();
    showToast('✅ 任务已更新', 'success');
  } catch (err) {
    showToast(`❌ 更新失败: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---- 清除已完成 ----
async function clearCompleted() {
  const count = appState.tasks.filter(t => t.completed).length;
  if (count === 0) { showToast('没有已完成的任务', 'info'); return; }

  try {
    const res = await api.clearCompleted();
    appState.tasks = appState.tasks.filter(t => !t.completed);
    renderTasks();
    updateStats();
    updateProgress();
    populateFocusSelect();
    showToast(res.message, 'info');
  } catch (err) {
    showToast(`❌ 清除失败: ${err.message}`, 'error');
  }
}

// ---- 过滤 ----
function setFilter(f) {
  appState.filter = f;
  document.querySelectorAll('.filter-chips .chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('filter-' + f).classList.add('active');
  document.getElementById('filter-' + f).setAttribute('aria-pressed', 'true');
  renderTasks();
}

function filterTasks() { renderTasks(); }

// ---- 渲染任务列表 ----
function renderTasks() {
  const list   = document.getElementById('tasks-list');
  const empty  = document.getElementById('empty-state');
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();

  let tasks = [...appState.tasks];

  switch (appState.filter) {
    case 'active':    tasks = tasks.filter(t => !t.completed); break;
    case 'completed': tasks = tasks.filter(t => t.completed);  break;
    case 'high':      tasks = tasks.filter(t => t.priority === 'high' && !t.completed); break;
  }

  if (search) {
    tasks = tasks.filter(t => t.text.toLowerCase().includes(search));
  }

  const pOrder = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (tasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = tasks.map(renderTaskItem).join('');
}

function renderTaskItem(task) {
  const today   = getTodayStr();
  const isOver  = task.due && !task.completed && task.due < today;
  const dueText = task.due ? formatDueDate(task.due) : '';

  return `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-priority="${task.priority}" data-id="${task.id}">
      <div class="task-priority-bar"></div>
      <div class="task-checkbox ${task.completed ? 'checked' : ''}"
           onclick="toggleTask('${task.id}')"
           role="checkbox" aria-checked="${task.completed}" tabindex="0"></div>
      <div class="task-body">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          <span class="task-cat-badge">${getCategoryName(task.category)}</span>
          ${dueText ? `<span class="task-due ${isOver ? 'overdue' : ''}">📅 ${dueText}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn" onclick="editTask('${task.id}')" title="编辑" aria-label="编辑任务">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="task-action-btn delete" onclick="deleteTask('${task.id}')" title="删除" aria-label="删除任务">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function formatDueDate(dateStr) {
  const today = getTodayStr();
  if (dateStr === today) return '今天';
  const diff = Math.floor((new Date(dateStr) - new Date(today)) / 86400000);
  if (diff === 1)  return '明天';
  if (diff === -1) return '昨天';
  if (diff < -1)   return `逾期 ${Math.abs(diff)} 天`;
  if (diff <= 7)   return `${diff} 天后`;
  return dateStr;
}

// ---- 统计 & 进度 ----
function updateStats() {
  const today   = getTodayStr();
  const all     = appState.tasks;
  const done    = all.filter(t => t.completed);
  const pending = all.filter(t => !t.completed);
  const overdue = all.filter(t => !t.completed && t.due && t.due < today);

  animateNumber('total-count',   all.length);
  animateNumber('done-count',    done.length);
  animateNumber('pending-count', pending.length);
  animateNumber('overdue-count', overdue.length);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const from     = parseInt(el.textContent) || 0;
  const start    = performance.now();
  const duration = 400;
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateProgress() {
  const today      = getTodayStr();
  const todayTasks = appState.tasks.filter(t => t.createdAt?.startsWith(today) || t.due === today);
  const total      = todayTasks.length || appState.tasks.length;
  const done       = todayTasks.length > 0
    ? todayTasks.filter(t => t.completed).length
    : appState.tasks.filter(t => t.completed).length;
  const pct        = total > 0 ? Math.round((done / total) * 100) : 0;
  const offset     = 314 - (pct / 100) * 314;

  const circle = document.getElementById('progress-circle');
  if (circle) circle.style.strokeDashoffset = offset;

  const pctEl = document.getElementById('progress-pct');
  if (pctEl)  pctEl.textContent = pct + '%';

  const textEl = document.getElementById('progress-text');
  if (textEl)  textEl.textContent = `今日完成 ${done} / ${total} 项任务`;
}

function populateFocusSelect() {
  const select = document.getElementById('focus-task-select');
  if (!select) return;
  const active = appState.tasks.filter(t => !t.completed);
  select.innerHTML = '<option value="">— 选择一个任务 —</option>'
    + active.map(t => `<option value="${t.id}">${getPriorityLabel(t.priority)} ${escapeHtml(t.text)}</option>`).join('');
}
