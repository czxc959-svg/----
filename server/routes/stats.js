/* ============================================
   FlowMind — 统计聚合 API 路由 (JSON DB 版)
   ============================================ */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  const tasks = db.data.tasks;
  const today = new Date().toISOString().split('T')[0];
  
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pending = total - done;
  const overdue = tasks.filter(t => !t.completed && t.due && t.due < today).length;
  
  let totalSessions = 0, totalMinutes = 0;
  db.data.pomodoro_sessions.forEach(s => {
    totalSessions += s.sessions;
    totalMinutes += s.minutes;
  });

  const catCount = {};
  const prioCount = {};
  
  tasks.forEach(t => {
    if(!catCount[t.category]) catCount[t.category] = { category: t.category, total: 0, done: 0 };
    catCount[t.category].total++;
    if(t.completed) catCount[t.category].done++;

    if(!prioCount[t.priority]) prioCount[t.priority] = { priority: t.priority, total: 0, done: 0 };
    prioCount[t.priority].total++;
    if(t.completed) prioCount[t.priority].done++;
  });

  res.json({
    success: true,
    data: {
      tasks: { total, done, pending, overdue, completionRate: total > 0 ? Math.round((done/total)*100) : 0 },
      pomodoro: { totalSessions, totalMinutes },
      byCategory: Object.values(catCount),
      byPriority: Object.values(prioCount)
    }
  });
});

router.get('/weekly', (req, res) => {
  const days = [];
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    const tasksDone = db.data.tasks.filter(t => t.completed && t.completed_at && t.completed_at.startsWith(dateStr)).length;
    const pomo = db.data.pomodoro_sessions.find(p => p.date === dateStr);
    
    days.push({
      date: dateStr,
      label: i === 0 ? '今天' : (i === 1 ? '昨天' : `周${weekdays[d.getDay()]}`),
      tasks: tasksDone,
      sessions: pomo ? pomo.sessions : 0,
      minutes: pomo ? pomo.minutes : 0
    });
  }
  
  res.json({ success: true, data: days });
});

router.get('/summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const todayDone = db.data.tasks.filter(t => t.completed && t.completed_at && t.completed_at.startsWith(today)).length;
  const todayTotal = db.data.tasks.filter(t => t.created_at.startsWith(today) || t.due === today).length;
  const pomo = db.data.pomodoro_sessions.find(p => p.date === today);
  
  res.json({
    success: true,
    data: { today: { done: todayDone, total: todayTotal, sessions: pomo ? pomo.sessions : 0, minutes: pomo ? pomo.minutes : 0 } }
  });
});

module.exports = router;
