/* ============================================
   FlowMind — AI 智能助手模块 (增强体验版)
   ============================================ */

// ---- 任务灵感库 ----
const TASK_POOL = {
  health: [
    { icon: '🏃', text: '户外慢跑 3 公里', priority: 'medium', category: 'health' },
    { icon: '🧘', text: '睡前瑜伽 15 分钟', priority: 'low', category: 'health' },
    { icon: '💧', text: '喝够 2000ml 水', priority: 'low', category: 'health' },
    { icon: '💪', text: '核心力量训练', priority: 'high', category: 'health' },
    { icon: '🥗', text: '准备一份健康减脂餐', priority: 'medium', category: 'health' },
    { icon: '🚴', text: '骑行 30 分钟', priority: 'medium', category: 'health' }
  ],
  study: [
    { icon: '📖', text: '阅读专业书籍 30 分钟', priority: 'medium', category: 'study' },
    { icon: '📝', text: '复习昨天学习的笔记', priority: 'high', category: 'study' },
    { icon: '💻', text: '刷 2 道 LeetCode 算法题', priority: 'high', category: 'study' },
    { icon: '🎧', text: '听一期全英文播客', priority: 'low', category: 'study' },
    { icon: '📚', text: '整理本周学习资料', priority: 'medium', category: 'study' },
    { icon: '🧠', text: '学习一个新框架的基础', priority: 'high', category: 'study' }
  ],
  work: [
    { icon: '📧', text: '处理并回复重要邮件', priority: 'high', category: 'work' },
    { icon: '📊', text: '总结本周工作周报', priority: 'medium', category: 'work' },
    { icon: '🎯', text: '制定明天的核心工作目标', priority: 'high', category: 'work' },
    { icon: '🧹', text: '清理电脑桌面和旧文件', priority: 'low', category: 'work' },
    { icon: '🤝', text: '与团队对齐项目进度', priority: 'high', category: 'work' }
  ],
  personal: [
    { icon: '🛒', text: '购买生活必需品', priority: 'medium', category: 'personal' },
    { icon: '🧹', text: '打扫房间卫生', priority: 'low', category: 'personal' },
    { icon: '💰', text: '记录本周财务开销', priority: 'medium', category: 'personal' },
    { icon: '🌱', text: '给阳台的植物浇水', priority: 'low', category: 'personal' },
    { icon: '🎵', text: '听音乐彻底放松 20 分钟', priority: 'low', category: 'personal' }
  ]
};

// 随机获取任务
function getRandomTasks(count = 4, category = null) {
  let pool = [];
  if (category && TASK_POOL[category]) {
    pool = [...TASK_POOL[category]];
  } else {
    Object.values(TASK_POOL).forEach(arr => pool.push(...arr));
  }
  // 随机打乱
  pool.sort(() => 0.5 - Math.random());
  return pool.slice(0, count);
}

// ---- AI 建议生成 ----
function generateAISuggestions() {
  const btn = document.getElementById('ai-refresh-btn');
  if (btn) btn.classList.add('spinning');

  // 模拟思考延迟
  setTimeout(() => {
    if (btn) btn.classList.remove('spinning');
    const suggestions = analyzeAndSuggest();
    renderAISuggestions(suggestions);
    renderAIMessage(suggestions.message);
  }, 600);
}

function analyzeAndSuggest() {
  const tasks = appState.tasks;
  const today = getTodayStr();
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const overdueTasks = activeTasks.filter(t => t.due && t.due < today);
  const highPriorityTasks = activeTasks.filter(t => t.priority === 'high');

  let message = '';
  const suggestions = [];

  // 分析场景
  if (tasks.length === 0) {
    message = '✨ 看起来你还没有任何任务！让我为你推荐一些日常任务来开始吧。建立好习惯从今天开始！';
    suggestions.push(...getRandomTasks(4));
  } else if (overdueTasks.length > 0) {
    message = `⚠️ 注意！你有 <strong>${overdueTasks.length}</strong> 个任务已逾期。建议优先处理这些任务，避免积压。`;
    overdueTasks.slice(0, 2).forEach(t => {
      suggestions.push({ icon: '🚨', text: `优先处理: ${t.text}`, priority: 'high', category: t.category, isExisting: true });
    });
    suggestions.push({ icon: '📋', text: '重新评估任务截止日期', priority: 'high', category: 'work' });
  } else if (highPriorityTasks.length > 3) {
    message = `🎯 你有 <strong>${highPriorityTasks.length}</strong> 个高优先级任务。建议使用番茄钟逐个击破，每次只专注一个任务效果最好！`;
    suggestions.push(
      { icon: '🍅', text: '开始一个25分钟的番茄钟', priority: 'high', category: 'work' },
      { icon: '📊', text: '重新评估任务优先级', priority: 'medium', category: 'work' }
    );
  } else if (completedTasks.length > 0 && activeTasks.length === 0) {
    message = `🎉 太棒了！所有任务都已完成！你今天完成了 <strong>${completedTasks.length}</strong> 个任务。继续保持这种高效状态！`;
    suggestions.push(...getRandomTasks(3));
  } else {
    const topPriority = highPriorityTasks[0];
    message = `📊 你有 <strong>${activeTasks.length}</strong> 个待办任务。${topPriority ? `建议先完成「${topPriority.text.substring(0, 15)}...」。` : '保持节奏，逐一击破！'} 看看我为你推荐的额外灵感吧。`;
    suggestions.push(
      { icon: '🍅', text: '开始一轮番茄钟专注', priority: 'medium', category: 'work' },
      ...getRandomTasks(2)
    );
  }

  return { message, suggestions };
}

function renderAIMessage(html) {
  const el = document.getElementById('ai-message');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.innerHTML = html;
      el.style.opacity = '1';
    }, 200);
  }
}

function renderAISuggestions(data) {
  const container = document.getElementById('ai-suggestions');
  if (!container) return;

  container.innerHTML = data.suggestions.map(s =>
    `<button class="suggestion-chip" onclick="addSuggestionTask('${escapeHtml(s.text)}', '${s.priority}', '${s.category}')">
      <span>${s.icon}</span>
      <span>${s.text}</span>
    </button>`
  ).join('');
}

function addSuggestionTask(text, priority, category) {
  const task = {
    text: text.replace('优先处理: ', ''),
    priority: priority,
    category: category,
    due: getTodayStr(),
    note: '由 AI 助手建议添加'
  };

  // 通过 API 添加
  api.createTask(task).then(res => {
    appState.tasks.unshift(res.data);
    renderTasks();
    updateStats();
    updateProgress();
    populateFocusSelect();
    showToast(`✨ 已添加: "${task.text.substring(0, 20)}"`, 'success');
  }).catch(err => {
    showToast(`❌ 添加失败: ${err.message}`, 'error');
  });
}

// ---- AI 对话交互 ----
function handleAIInput(event) {
  if (event.key === 'Enter') {
    sendAIMessage();
  }
}

function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  // 1. 用户气泡
  const chat = document.getElementById('ai-chat');
  chat.innerHTML += `
    <div class="ai-bubble" style="text-align:right; margin-top:10px; background:transparent; border:none; padding:0;">
      <div class="bubble-content" style="background: var(--grad-main); color: white; border-radius: 12px 12px 4px 12px; display: inline-block; text-align: left; padding: 10px 14px;">
        ${escapeHtml(text)}
      </div>
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;

  // 2. 加载状态动画
  const typingId = 'typing-' + Date.now();
  chat.innerHTML += `
    <div class="ai-bubble" id="${typingId}" style="margin-top:10px;">
      <div class="bubble-content" style="display:flex; gap:4px; align-items:center; min-height:24px;">
        <span class="typing-dot" style="animation: bounce 1.4s infinite ease-in-out both; width:6px; height:6px; background:var(--purple); border-radius:50%;"></span>
        <span class="typing-dot" style="animation: bounce 1.4s infinite ease-in-out both; width:6px; height:6px; background:var(--purple); border-radius:50%; animation-delay:0.2s;"></span>
        <span class="typing-dot" style="animation: bounce 1.4s infinite ease-in-out both; width:6px; height:6px; background:var(--purple); border-radius:50%; animation-delay:0.4s;"></span>
      </div>
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;

  // 3. 模拟分析与回复
  setTimeout(() => {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const reply = generateAIReply(text);
    chat.innerHTML += `
      <div class="ai-bubble" style="margin-top:10px;">
        <div class="bubble-content">${reply}</div>
      </div>
    `;
    chat.scrollTop = chat.scrollHeight;
  }, 800);
}

// 核心意图识别与回复生成
function generateAIReply(question) {
  const q = question.toLowerCase();
  const tasks = appState.tasks;
  const activeTasks = tasks.filter(t => !t.completed);

  // ---- 场景 1：要求制定计划 ----
  if (q.includes('计划') || q.includes('规划') || q.includes('安排')) {
    if (q.includes('锻炼') || q.includes('运动') || q.includes('健身') || q.includes('健康')) {
      setTimeout(() => renderAISuggestions({ suggestions: getRandomTasks(4, 'health') }), 100);
      return '💪 没问题！我已经为你生成了一份专属的**锻炼计划**。你可以直接点击下方的卡片，一键将它们添加到你的任务清单中！';
    }
    if (q.includes('学习') || q.includes('读书') || q.includes('复习')) {
      setTimeout(() => renderAISuggestions({ suggestions: getRandomTasks(4, 'study') }), 100);
      return '📚 好的，**学习计划**已生成！点击下方建议，将这些任务加入列表，建议配合番茄钟一起执行哦。';
    }
    if (q.includes('工作') || q.includes('上班') || q.includes('项目')) {
      setTimeout(() => renderAISuggestions({ suggestions: getRandomTasks(4, 'work') }), 100);
      return '💼 收到！为你准备了**核心工作安排**，先从最重要的事情开始做起吧！';
    }
    // 没指明具体什么计划，混合生成
    setTimeout(() => renderAISuggestions({ suggestions: getRandomTasks(4) }), 100);
    return '📝 好的！我为你综合生成了一份包含生活、学习和工作的**全方位计划**，请在下方点击添加你需要的事项。';
  }

  // ---- 场景 2：询问当前状态 ----
  if (q.includes('几个') || q.includes('多少') || q.includes('任务数')) {
    const done = tasks.filter(t => t.completed).length;
    return `📋 你目前共有 <strong>${tasks.length}</strong> 个任务。其中待处理 <strong>${activeTasks.length}</strong> 个，已完成 <strong>${done}</strong> 个。`;
  }

  if (q.includes('优先') || q.includes('重要') || q.includes('先做')) {
    const high = activeTasks.filter(t => t.priority === 'high');
    if (high.length > 0) {
      return `🎯 你有 <strong>${high.length}</strong> 个高优先级任务。建议先处理：「${escapeHtml(high[0].text)}」。马上开启番茄钟专注完成它吧！`;
    }
    return '✅ 目前没有标记为高优先级的任务。你可以按照自己的节奏逐一完成。';
  }

  // ---- 场景 3：鼓励与建议 ----
  if (q.includes('累') || q.includes('疲惫') || q.includes('拖延') || q.includes('不想动')) {
    return '☕ 感到疲惫很正常。任务管理的真谛不是机器般运转，而是劳逸结合。建议你现在去喝杯水，站起来活动5分钟，或者把当前任务拆解成非常小的步骤。';
  }

  if (q.includes('你好') || q.includes('hi') || q.includes('hello')) {
    return '👋 你好！我是 FlowMind 智能助手。你可以问我：“帮我写一份锻炼计划”、“现在该先做什么任务？”或者点击右上角的刷新按钮获取随机灵感。';
  }

  // ---- 兜底回复 ----
  setTimeout(() => renderAISuggestions({ suggestions: getRandomTasks(3) }), 100);
  return '🧠 我明白了你的意思。为了帮你更好地进入状态，我为你推荐了几个适合现在处理的小任务。如果不满意，可以随时点击右上角的“刷新”按钮换一批。';
}

// 补充打字机动画的 CSS 注入
const style = document.createElement('style');
style.innerHTML = `
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-5px); }
}
`;
document.head.appendChild(style);
