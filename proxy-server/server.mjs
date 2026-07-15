import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import webpush from 'web-push';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Директория для загрузок
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const PORT = 3000;

// Переменные окружения
const RUIZ_USER = process.env.RUIZ_USER;
const RUIZ_PASS = process.env.RUIZ_PASS;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'default-secret-change-me';

if (!RUIZ_USER || !RUIZ_PASS || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌ Не все переменные окружения заданы');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${RUIZ_USER}:${RUIZ_PASS}`).toString('base64');
webpush.setVapidDetails(
  process.env.VAPID_MAILTO || 'mailto:example@mail.ru',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ==================== ХРАНЕНИЕ ПОДПИСОК ====================
const DATA_DIR = path.join(__dirname, 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// Создаём папку data, если её нет
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Загрузка подписок из файла
function loadSubscriptions() {
  try {
    if (existsSync(SUBSCRIPTIONS_FILE)) {
      const raw = readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      const map = new Map();
      for (const [key, value] of Object.entries(obj)) {
        map.set(key, value);
      }
      console.log(`📂 Загружено ${map.size} групп подписок`);
      return map;
    }
  } catch (err) {
    console.error('Ошибка загрузки подписок:', err.message);
  }
  return new Map();
}

// Сохранение подписок в файл
function saveSubscriptions() {
  try {
    const obj = Object.fromEntries(subscriptions);
    writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Ошибка сохранения подписок:', err.message);
  }
}

// Инициализируем хранилище
const subscriptions = loadSubscriptions();

// ✅ БАГ #6 ИСПРАВЛЕН: трекер уже отправленных уведомлений (lessonOid → timestamp)
const sentNotifications = new Map();

// ==================== ПРОКСИ К РУЗ ====================
app.use('/api', async (req, res, next) => {
  if ([
    '/save-subscription',
    '/check-updates',
    '/send-notification',
    '/upload',
    '/unsubscribe',
    '/subscriptions-stats'
  ].includes(req.path)) {
    return next();
  }
  try {
    const targetUrl = `https://schedule.mi.university${req.originalUrl}`;
    console.log(`🔄 Проксируем: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    const text = await response.text();
    console.log(`📡 Статус: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      res.status(response.status);
      try { res.json(JSON.parse(text)); } catch { res.json({ error: `Upstream ${response.status}` }); }
      return;
    }
    try { res.json(JSON.parse(text)); } catch { res.status(200).send(text || ''); }
  } catch (error) {
    console.error('❌ Ошибка прокси:', error.message);
    res.status(502).json({ error: 'Ошибка прокси' });
  }
});

// ==================== PUSH-ПОДПИСКА ====================
app.post('/api/save-subscription', (req, res) => {
  const { groupId, subscription } = req.body;
  if (!groupId || !subscription) return res.status(400).json({ error: 'Нет данных' });
  if (!subscriptions.has(groupId)) subscriptions.set(groupId, []);
  const list = subscriptions.get(groupId);
  const idx = list.findIndex(s => s.endpoint === subscription.endpoint);
  if (idx !== -1) list.splice(idx, 1);
  list.push(subscription);
  saveSubscriptions(); // 💾 сохраняем на диск
  console.log(`🔔 Подписка сохранена для группы ${groupId}`);
  res.json({ success: true });
});

// ==================== УДАЛЕНИЕ ПОДПИСКИ ====================
app.post('/api/unsubscribe', (req, res) => {
  const { groupId, endpoint } = req.body;
  if (!groupId || !endpoint) return res.status(400).json({ error: 'Нет данных' });
  const list = subscriptions.get(groupId);
  if (list) {
    const idx = list.findIndex(s => s.endpoint === endpoint);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveSubscriptions(); // 💾 обновляем файл
      console.log(`🔕 Подписка удалена для группы ${groupId}`);
    }
  }
  res.json({ success: true });
});

// ==================== СТАТИСТИКА ПОДПИСОК ====================
app.get('/api/subscriptions-stats', (req, res) => {
  const stats = {};
  for (const [groupOid, subs] of subscriptions.entries()) {
    stats[groupOid] = subs.length;
  }
  res.json(stats);
});

// ==================== ЗАГРУЗКА ФАЙЛА ====================
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

// ==================== ОТПРАВКА УВЕДОМЛЕНИЯ ====================
app.post('/api/send-notification', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }

  const { title, body, groupIds, fileUrl } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Укажите title и body' });

  const notificationBody = fileUrl ? `${body}\n\n📎 Файл: ${fileUrl}` : body;
  const payload = JSON.stringify({
    title,
    body: notificationBody,
    icon: '/icon-192.png',
    data: { url: fileUrl || '/' }
  });

  let targets = [];
  if (!groupIds || groupIds === 'all') {
    for (const subs of subscriptions.values()) targets.push(...subs);
  } else if (Array.isArray(groupIds)) {
    groupIds.forEach(gid => {
      if (subscriptions.has(gid)) targets.push(...subscriptions.get(gid));
    });
  }

  let success = 0;
  for (const sub of targets) {
    try {
      await webpush.sendNotification(sub, payload);
      success++;
    } catch (err) {
      if (err.statusCode === 410) {
        for (const [gid, subs] of subscriptions.entries()) {
          const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
          if (idx !== -1) {
            subs.splice(idx, 1);
            saveSubscriptions(); // удаляем невалидную подписку из файла
            break;
          }
        }
      }
    }
  }

  res.json({ success: true, sent: success, total: targets.length });
});

// ==================== ФОНОВАЯ ПРОВЕРКА ИЗМЕНЕНИЙ ====================
setInterval(async () => {
  for (const groupId of subscriptions.keys()) {
    try { await checkAndNotify(groupId); } catch (e) {}
  }
}, 5 * 60 * 1000);

async function checkAndNotify(groupId) {
  const now = new Date();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from = past.toISOString().split('T')[0];
  const to = now.toISOString().split('T')[0];
  const url = `https://schedule.mi.university/api/schedulelog?groupOid=${groupId}&fromDate=${from}&toDate=${to}`;
  const response = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
  const text = await response.text();
  if (!text) return;
  const data = JSON.parse(text);
  if (!Array.isArray(data) || data.length === 0) return;

  // ✅ БАГ #6 ИСПРАВЛЕН: отправляем только новые уведомления
  const newItems = data.filter(item => {
    const key = `${groupId}:${item.lessonOid}`;
    return !sentNotifications.has(key);
  });
  if (newItems.length === 0) return;

  const subs = subscriptions.get(groupId) || [];
  for (const item of newItems) {
    const payload = JSON.stringify({
      title: 'Изменение в расписании',
      body: `${item.discipline || 'Пара'} (${item.date || ''})`,
      icon: '/icon-192.png',
      data: { url: '/' }
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410) {
          const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
          if (idx !== -1) { subs.splice(idx, 1); saveSubscriptions(); }
        }
      }
    }
    // Помечаем как отправленное
    const key = `${groupId}:${item.lessonOid}`;
    sentNotifications.set(key, Date.now());
  }

  // Чистим старые записи (старше 48ч) чтобы Map не рос бесконечно
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [key, ts] of sentNotifications.entries()) {
    if (ts < cutoff) sentNotifications.delete(key);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});