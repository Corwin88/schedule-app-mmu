// Cloudflare Worker — единая точка входа
// Раздаёт статику из dist/ (через ASSETS binding) и обрабатывает /api/*

import { Redis } from '@upstash/redis/cloudflare';
import webpush from 'web-push';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

async function fetchRemote(url, method, body, authHeader) {
  const options = {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
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

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, '');

  const AUTH_HEADER = 'Basic ' + btoa(`${env.RUIZ_USER}:${env.RUIZ_PASS}`);

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  webpush.setVapidDetails(
    'mailto:example@mail.ru',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  // --- save-subscription ---
  if (request.method === 'POST' && path === '/save-subscription') {
    const { groupId, subscription } = await request.json();
    if (!groupId || !subscription) return jsonResponse({ error: 'Нет данных' }, 400);
    const key = `sub:${groupId}:${subscription.endpoint}`;
    await redis.set(key, JSON.stringify(subscription));
    return jsonResponse({ success: true });
  }

  // --- unsubscribe ---
  if (request.method === 'POST' && path === '/unsubscribe') {
    const { groupId, endpoint } = await request.json();
    if (!groupId || !endpoint) return jsonResponse({ error: 'Нет данных' }, 400);
    const key = `sub:${groupId}:${endpoint}`;
    await redis.del(key);
    return jsonResponse({ success: true });
  }

  // --- subscriptions-stats ---
  if (request.method === 'GET' && path === '/subscriptions-stats') {
    const keys = await redis.keys('sub:*');
    const stats = {};
    for (const key of keys) {
      const [, groupId] = key.split(':');
      stats[groupId] = (stats[groupId] || 0) + 1;
    }
    return jsonResponse(stats);
  }

  // --- send-notification ---
  if (request.method === 'POST' && path === '/send-notification') {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
      return jsonResponse({ error: 'Неверный секретный ключ' }, 403);
    }
    const { title, body, groupIds, fileUrl } = await request.json();
    if (!title || !body) return jsonResponse({ error: 'Укажите title и body' }, 400);

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
    return jsonResponse({ success: true, sent: success, total: targets.length });
  }

  // --- upload (stub) ---
  if (request.method === 'POST' && path === '/upload') {
    return jsonResponse({ error: 'Загрузка файлов временно недоступна' }, 501);
  }

  // --- проксирование остальных запросов к schedule.mi.university ---
  const targetUrl = `https://schedule.mi.university${url.pathname}${url.search}`;
  const bodyData = request.method !== 'GET' ? await request.json() : null;
  const { status, body: resBody } = await fetchRemote(targetUrl, request.method, bodyData, AUTH_HEADER);
  return jsonResponse(resBody, status);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api')) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Запросы к нашему API — обрабатываем сами
    if (url.pathname.startsWith('/api')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        return jsonResponse({ error: 'Internal server error', details: error.message }, 500);
      }
    }

    // Всё остальное — статика (React-приложение) через ASSETS binding
    return env.ASSETS.fetch(request);
  },
};
