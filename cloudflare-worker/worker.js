const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

function json(data, status, origin, allowOrigin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  return { origin, allowed: !!origin && allowed.includes(origin) };
}

function sanitizeContext(value) {
  try {
    const list = JSON.parse(String(value || '[]'));
    if (!Array.isArray(list)) return [];
    return list.map(v => String(v).trim()).filter(Boolean).slice(0, 80).map(v => v.slice(0, 80));
  } catch {
    return [];
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { origin, allowed } = isAllowedOrigin(request, env);

    if (request.method === 'OPTIONS') {
      if (!allowed) return json({ error: 'Origin not allowed.' }, 403, origin, false);
      return json({ ok: true }, 200, origin, true);
    }

    if (!allowed) {
      return json({ error: 'This website origin is not allowed to use the transcription service.' }, 403, origin, false);
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500, origin, true);
      return json({ ok: true, model: 'gpt-transcribe' }, 200, origin, true);
    }

    if (url.pathname !== '/transcribe' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404, origin, true);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY is not configured on the Worker.' }, 500, origin, true);
    }

    try {
      const incoming = await request.formData();
      const audio = incoming.get('audio');
      if (!(audio instanceof File) || audio.size < 100) {
        return json({ error: 'No usable audio file was received.' }, 400, origin, true);
      }
      if (audio.size > 20 * 1024 * 1024) {
        return json({ error: 'Audio segment is too large.' }, 413, origin, true);
      }

      const context = sanitizeContext(incoming.get('context'));
      const upstream = new FormData();
      upstream.append('file', audio, audio.name || 'dictation.webm');
      upstream.append('model', 'gpt-transcribe');
      upstream.append('language', 'en');
      upstream.append('response_format', 'json');
      upstream.append('temperature', '0');
      if (context.length) {
        upstream.append('prompt', `Transcribe natural Canadian English accurately. Preserve punctuation and capitalization. The following names or terms may appear: ${context.join(', ')}.`);
      } else {
        upstream.append('prompt', 'Transcribe natural Canadian English accurately. Preserve punctuation and capitalization.');
      }

      const response = await fetch(OPENAI_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: upstream,
      });

      const bodyText = await response.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText }; }

      if (!response.ok) {
        const message = body?.error?.message || body?.error || `OpenAI transcription failed (HTTP ${response.status}).`;
        return json({ error: message }, response.status, origin, true);
      }

      return json({ text: String(body?.text || '').trim() }, 200, origin, true);
    } catch (err) {
      return json({ error: err?.message || String(err) }, 500, origin, true);
    }
  }
};
