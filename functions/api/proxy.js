// functions/api/proxy.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Обработка OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---------- Кэширование (только для GET-запросов) ----------
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  // Пытаемся достать ответ из кэша
  if (request.method === 'GET') {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log('✅ Отдано из кэша:', url.pathname);
      // Добавляем CORS-заголовки к кэшированному ответу
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }
  }

  // ---------- Прокси к университету ----------
  const auth = btoa(`${env.RUIZ_USER}:${env.RUIZ_PASS}`);
  const upstreamHeaders = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  // Запрос к schedule.mi.university
  const targetUrl = `https://schedule.mi.university${path}${url.search}`;
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method !== 'GET' ? await request.text() : undefined,
  });

  const response = new Response(upstreamResponse.body, upstreamResponse);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Сохраняем в кэш успешные GET-ответы
  if (request.method === 'GET' && upstreamResponse.ok) {
    // Кэшируем на 5 минут (можно увеличить для редко меняющихся данных)
    response.headers.set('Cache-Control', 'public, max-age=1500');
    context.waitUntil(cache.put(cacheKey, response.clone()));
    console.log('📦 Сохранено в кэш:', url.pathname);
  }

  return response;
}