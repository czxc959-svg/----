/* ============================================
   FlowMind — 任务 API 路由 (JSON DB 版)
   ============================================ */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

function formatTask(row) {
  return {
    id:          row.id,
    text:        row.text,
    priority:    row.priority,
    category:    row.category,
    due:         row.due || null,
    completed:   Boolean(row.completed),
    createdAt:   row.created_at,
    completedAt: row.completed_at || null,
    note:        row.note || ''
  };
}

router.get('/', (req, res) => {
  try {
    let { filter = 'all', search = '', sort = 'created' } = req.query;
    let tasks = [...db.data.tasks];

    // 过滤
    if (filter === 'active') tasks = tasks.filter(t => !t.completed);
    if (filter === 'completed') tasks = tasks.filter(t => t.completed);
    if (filter === 'high') tasks = tasks.filter(t => t.priority === 'high' && !t.completed);

    // 搜索
    if (search.trim()) tasks = tasks.filter(t => t.text.toLowerCase().includes(search.trim().toLowerCase()));

    // 排序
    const pOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
      if (sort === 'priority') {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sort === 'due') {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.due && b.due) return 1;
        if (a.due && !b.due) return -1;
        if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
      } else {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    res.json({ success: true, data: tasks.map(formatTask), count: tasks.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const task = db.data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  res.json({ success: true, data: formatTask(task) });
});

router.post('/', (req, res) => {
  try {
    const { text, priority = 'medium', category = 'other', due = null, note = '' } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: '任务内容不能为空' });

    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text.trim(),
      priority, category, due, note,
      completed: 0,
      created_at: new Date().toISOString(),
      completed_at: null
    };

    db.data.tasks.push(task);
    db.save();
    res.status(201).json({ success: true, data: formatTask(task), message: '任务创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const task = db.data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  
  task.text = req.body.text !== undefined ? req.body.text.trim() : task.text;
  task.priority = req.body.priority || task.priority;
  task.category = req.body.category || task.category;
  task.due = req.body.due !== undefined ? req.body.due : task.due;
  task.note = req.body.note !== undefined ? req.body.note : task.note;
  
  db.save();
  res.json({ success: true, data: formatTask(task), message: '任务更新成功' });
});

router.patch('/:id/toggle', (req, res) => {
  const task = db.data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  
  task.completed = task.completed ? 0 : 1;
  task.completed_at = task.completed ? new Date().toISOString() : null;
  
  db.save();
  res.json({ success: true, data: formatTask(task), message: task.completed ? '任务已完成 ✅' : '任务已开启' });
});

router.delete('/:id', (req, res) => {
  const idx = db.data.tasks.findIndex(t => t.id === req.params.id);
  if (idx < 0) return res.status(404).json({ success: false, error: '任务不存在' });
  
  const task = db.data.tasks[idx];
  db.data.tasks.splice(idx, 1);
  db.save();
  
  res.json({ success: true, message: '任务已删除', data: formatTask(task) });
});

router.delete('/completed/all', (req, res) => {
  const before = db.data.tasks.length;
  db.data.tasks = db.data.tasks.filter(t => !t.completed);
  db.save();
  res.json({ success: true, message: `已清除 ${before - db.data.tasks.length} 个已完成任务` });
});

module.exports = router;
