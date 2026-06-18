/* ============================================
   FlowMind — 纯 JSON 文件数据库
   避免 Windows 平台上的 Native 编译问题 (0依赖)
   ============================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'db.json');

const defaultData = {
  tasks: [],
  pomodoro_sessions: [],
  settings: [
    { key: 'focus_duration', value: '25' },
    { key: 'short_break', value: '5' },
    { key: 'long_break', value: '15' },
    { key: 'max_sessions', value: '4' }
  ]
};

let dbData = { ...defaultData };

if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    dbData = { ...defaultData, ...JSON.parse(raw) };
  } catch(e) {
    console.error('⚠️ 解析 db.json 失败，将使用默认数据');
  }
} else {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2));
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2));
}

console.log('✅ 数据库初始化完成 (JSON 模式):', DB_PATH);

module.exports = {
  data: dbData,
  save
};
