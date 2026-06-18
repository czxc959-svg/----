/* ============================================
   FlowMind — Express 服务器入口
   ============================================ */

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const taskRoutes     = require('./routes/tasks');
const pomodoroRoutes = require('./routes/pomodoro');
const statsRoutes    = require('./routes/stats');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- 中间件 ----
app.use(cors());
app.use(express.json());

// 请求日志（轻量级，无需第三方）
app.use((req, res, next) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  res.on('finish', () => {
    const color = res.statusCode < 400 ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}[${now}] ${req.method} ${req.originalUrl} → ${res.statusCode}\x1b[0m`);
  });
  next();
});

// ---- API 路由 ----
app.use('/api/tasks',    taskRoutes);
app.use('/api/pomodoro', pomodoroRoutes);
app.use('/api/stats',    statsRoutes);

// API 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 FlowMind API 运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ---- 静态文件（前端）----
app.use(express.static(path.join(__dirname, '..')));

// 所有未匹配路由回退到 index.html（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---- 全局错误处理 ----
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err.message);
  res.status(500).json({
    success: false,
    error:   '服务器内部错误',
    message: err.message
  });
});

// ---- 启动 ----
app.listen(PORT, () => {
  console.log('\x1b[35m');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   🧠 FlowMind Server  已启动          ║');
  console.log(`║   📡 http://localhost:${PORT}            ║`);
  console.log('║   🗄️  SQLite 数据库已连接             ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\x1b[0m');
});

module.exports = app;
