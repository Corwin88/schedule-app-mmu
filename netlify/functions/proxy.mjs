// netlify/functions/proxy.mjs
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:example@mail.ru',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const AUTH_HEADER = 'Basic ' + Buffer.from(
  `${process.env.RUIZ_USER}:${process.env.RUIZ_PASS}`
).toString('base64');

async function fetchRemote(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
      return { status: response.status, body: { error: `Upstream ${response.status}`, details: text } };
    }
    try { return { status: response.status, body: JSON.parse(text) }; }
    catch { return { status: response.status, body: text }; }
  } catch (err) {
    return { status: 502, body: { error: 'Failed to reach upstream', details: err.message } };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  // ✅ БАГ #1 ИСПРАВЛЕН: используем pathname + search, не req.url
  const path = url.pathname.replace(/^\/api/, '');

  try {
    // --- save-subscription ---
    if (req.method === 'POST' && path === '/save-subscription') {
      const { groupId, subscription } = await req.json();
      if (!groupId || !subscription) {
        return new Response(JSON.stringify({ error: 'Нет данных' }), { status: 400, headers: corsHeaders() });
      }
      const key = `sub:${groupId}:${subscription.endpoint}`;
      await redis.set(key, JSON.stringify(subscription));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
    }

    // --- unsubscribe ---
    if (req.method === 'POST' && path === '/unsubscribe') {
      const { groupId, endpoint } = await req.json();
      if (!groupId || !endpoint) {
        return new Response(JSON.stringify({ error: 'Нет данных' }), { status: 400, headers: corsHeaders() });
      }
      const key = `sub:${groupId}:${endpoint}`;
      await redis.del(key);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
    }

    // --- subscriptions-stats ---
    if (req.method === 'GET' && path === '/subscriptions-stats') {
      const keys = await redis.keys('sub:*');
      const stats = {};
      for (const key of keys) {
        const [, groupId] = key.split(':');
        stats[groupId] = (stats[groupId] || 0) + 1;
      }
      return new Response(JSON.stringify(stats), { headers: corsHeaders() });
    }

    // --- send-notification ---
    if (req.method === 'POST' && path === '/send-notification') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Неверный секретный ключ' }), { status: 403, headers: corsHeaders() });
      }
      const { title, body, groupIds, fileUrl } = await req.json();
      if (!title || !body) {
        return new Response(JSON.stringify({ error: 'Укажите title и body' }), { status: 400, headers: corsHeaders() });
      }
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
      return new Response(JSON.stringify({ success: true, sent: success, total: targets.length }), { headers: corsHeaders() });
    }

    // --- upload (stub) ---
    if (req.method === 'POST' && path === '/upload') {
      return new Response(JSON.stringify({ error: 'Загрузка файлов временно недоступна' }), { status: 501, headers: corsHeaders() });
    }

    // ✅ БАГ #1 ИСПРАВЛЕН: передаём полный pathname + search, не трогаем req.url
    const targetUrl = `https://schedule.mi.university${url.pathname}${url.search}`;
    const { status, body } = await fetchRemote(
      targetUrl,
      req.method,
      req.method !== 'GET' ? await req.json() : null
    );
    return new Response(JSON.stringify(body), { status, headers: corsHeaders() });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
