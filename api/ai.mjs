// 실타래 실습실의 AI 코치·힌트·코드 만들기를 OpenAI로 연결하는 Vercel 함수.
// 환경변수 OPENAI_API_KEY가 없으면 503을 돌려주고, 화면은 체험용 예시 답변으로 바뀐다.
// 선택 환경변수: OPENAI_MODEL(기본 gpt-4.1-mini), ALLOWED_ORIGIN(예: https://내주소.vercel.app)

const LIMITS = {hint: 400, coach: 400, code: 1600};
const MAX_MESSAGES = 16, MAX_CHARS = 16000;
const PER_MINUTE = 8;
const hits = new Map(); // 같은 인스턴스 안에서만 세는 간단한 제한. 진짜 안전장치는 OpenAI 쪽 월 예산 한도.

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

function limited(ip){
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now); hits.set(ip, list);
  return list.length > PER_MINUTE;
}

export async function POST(request){
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, {demo: true});

  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && request.headers.get('origin') !== allowed) return json(403, {error: 'origin'});

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return json(429, {error: 'rate_limited'});

  let body;
  try { body = await request.json(); } catch { return json(400, {error: 'bad_json'}); }
  const kind = body?.kind, messages = body?.messages;
  if (!LIMITS[kind] || !Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return json(400, {error: 'bad_request'});
  let total = 0;
  for (const m of messages){
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return json(400, {error: 'bad_message'});
    total += m.content.length;
  }
  if (total > MAX_CHARS) return json(413, {error: 'too_long'});

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      stream: true,
      max_completion_tokens: LIMITS[kind],
      messages: messages.map(({role, content}) => ({role, content})),
    }),
    signal: request.signal,
  }).catch(() => null);
  if (!upstream) return json(502, {error: 'upstream'});
  if (upstream.status === 429) return json(429, {error: 'rate_limited'});
  if (!upstream.ok || !upstream.body) return json(502, {error: 'upstream', status: upstream.status});

  // OpenAI의 SSE를 글자만 담은 스트림으로 바꿔서 화면에 바로 흘려보낸다.
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = '';
  const stream = upstream.body.pipeThrough(new TransformStream({
    transform(chunk, ctrl){
      buf += dec.decode(chunk, {stream: true});
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines){
        const data = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!data || data === '[DONE]') continue;
        try { const t = JSON.parse(data).choices?.[0]?.delta?.content; if (t) ctrl.enqueue(enc.encode(t)); } catch {}
      }
    },
  }));
  return new Response(stream, {headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});
}
