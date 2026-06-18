/* ============================================
   FlowMind — 番茄钟 API 路由 (JSON DB 版)
   ============================================ */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const sorted = [...db.data.pomodoro_sessions]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, days);
  res.json({ success: true, data: sorted });
});

router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const row = db.data.pomodoro_sessions.find(r => r.date === today);
  res.json({
    success: true,
    data: row || { date: today, sessions: 0, minutes: 0 }
  });
});

router.post('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const minutes = parseInt(req.body.minutes) || 25;
  
  let row = db.data.pomodoro_sessions.find(r => r.date === today);
  if (row) {
    row.sessions += 1;
    row.minutes += minutes;
  } else {
    row = { date: today, sessions: 1, minutes };
    db.data.pomodoro_sessions.push(row);
  }
  
  db.save();
  res.json({
    success: true,
    data: row,
    message: `🍅 第 ${row.sessions} 轮番茄钟已记录！今日累计 ${row.minutes} 分钟`
  });
});

module.exports = router;
