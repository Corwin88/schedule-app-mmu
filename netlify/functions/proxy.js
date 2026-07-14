// netlify/functions/proxy.js
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

// Загружаем переменные окружения (на Netlify они доступны через process.env)
const RUIZ_USER = process.env.RUIZ_USER;
const RUIZ_PASS = process.env.RUIZ_PASS;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'default-secret-change-me';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const AUTH_HEADER = 'Basic ' + Buffer.from(`${RUIZ_USER}:${RUIZ_PASS}`).toString('base64');

webpush.setVapidDetails(
  'mailto:example@mail.ru',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// ----------- Вспомогательные функции -----------
async function fetchRemote(targetUrl, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': AUTH_HEADER,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(targetUrl, options);
  const text = await response.text();
  if (!response.ok) {
    let error;
    try { error = JSON.parse(text); } catch { error = { error: `Upstream ${response.status}` }; }
    return { status: response.status, body: error };
  }
  try { return { status: response.status, body: JSON.parse(text) }; }
  catch { return { status: response.status, body: text }; }
}

// ----------- Основной обработчик -----------
export default async function handler(req, res) {
  // Разрешаем CORS для фронтенда
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url.replace('/api', ''); // Netlify добавляет /api/ в URL функции

  // --- Push-подписка ---
  if (req.method === 'POST' && path === '/save-subscription') {
    const { groupId, subscription } = req.body || {};
    if (!groupId || !subscription) return res.status(400).json({ error: 'Нет данных' });
    const key = `sub:${groupId}:${subscription.endpoint}`;
    await redis.set(key, JSON.stringify(subscription));
    console.log(`🔔 Подписка сохранена: ${key}`);
    return res.json({ success: true });
  }

  // --- Удаление подписки ---
  if (req.method === 'POST' && path === '/unsubscribe') {
    const { groupId, endpoint } = req.body || {};
    if (!groupId || !endpoint) return res.status(400).json({ error: 'Нет данных' });
    const key = `sub:${groupId}:${endpoint}`;
    await redis.del(key);
    console.log(`🔕 Подписка удалена: ${key}`);
    return res.json({ success: true });
  }

  // --- Статистика подписок ---
  if (req.method === 'GET' && path === '/subscriptions-stats') {
    const keys = await redis.keys('sub:*');
    const stats = {};
    for (const key of keys) {
      const [, groupId] = key.split(':');
      stats[groupId] = (stats[groupId] || 0) + 1;
    }
    return res.json(stats);
  }

  // --- Отправка уведомления от деканата ---
  if (req.method === 'POST' && path === '/send-notification') {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return res.status(403).json({ error: 'Неверный секретный ключ' });
    }
    const { title, body, groupIds, fileUrl } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'Укажите title и body' });

    const payload = JSON.stringify({
      title,
      body: fileUrl ? `${body}\n\n📎 Файл: ${fileUrl}` : body,
      icon: '/icon-192.png',
      data: { url: fileUrl || '/' },
    });

    let targets = [];
    if (!groupIds || groupIds === 'all') {
      const allKeys = await redis.keys('sub:*');
      for (const key of allKeys) {
        const raw = await redis.get(key);
        if (raw) targets.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      }
    } else if (Array.isArray(groupIds)) {
      for (const gid of groupIds) {
        const groupKeys = await redis.keys(`sub:${gid}:*`);
        for (const key of groupKeys) {
          const raw = await redis.get(key);
          if (raw) targets.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
        }
      }
    }

    let success = 0;
    for (const sub of targets) {
      try {
        await webpush.sendNotification(sub, payload);
        success++;
      } catch (err) {
        if (err.statusCode === 410) {
          const endpoint = sub.endpoint;
          const keysToDelete = await redis.keys(`sub:*:${endpoint}`);
          if (keysToDelete.length > 0) await redis.del(keysToDelete[0]);
        }
      }
    }
    return res.json({ success: true, sent: success, total: targets.length });
  }

  // --- Загрузка файла ---
  if (req.method === 'POST' && path === '/upload') {
    return res.status(501).json({ error: 'Загрузка файлов временно недоступна' });
  }

  // --- Прокси к университету ---
  const targetUrl = `https://schedule.mi.university${req.url}`;
  const { status, body } = await fetchRemote(targetUrl, req.method, req.body);
  return res.status(status).json(body);
}