// functions/api/proxy.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  // Заголовки для CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Обработка OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---------- Прокси к университету ----------
  const auth = btoa(`${env.RUIZ_USER}:${env.RUIZ_PASS}`);
  const upstreamHeaders = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  // Проксируем запрос к schedule.mi.university
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
  return response;
}