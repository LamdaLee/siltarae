// 실타래 실습실의 AI 코치·힌트·코드 만들기를 OpenAI로 연결하는 Vercel 함수.
// 필수 환경변수: OPENAI_API_KEY, ALLOWED_ORIGIN(예: https://내주소.vercel.app, 여러 개면 쉼표로 구분)
// 둘 중 하나라도 없으면 503을 돌려주고, 화면은 체험용 예시 답변으로 바뀐다.
// 선택 환경변수: OPENAI_MODEL(기본 gpt-4.1-mini)

const LIMITS = {hint: 400, coach: 400, code: 1600};
const MAX_MESSAGES = 16, MAX_CHARS = 16000;
const PER_MINUTE = 8;
// 화면이 보낸 지시문 앞에 서버가 고정으로 붙이는 역할. 실습과 관계없는 요청에 키가 쓰이지 않게 한다.
const SYSTEM = {
  hint: '너는 실타래 실습실(AX 문제 정의 실습)의 조교다. 학생이 생각을 더 꺼내도록 돕는 질문만 쓴다. 실습과 관계없는 요청(다른 과제, 일반 대화, 번역, 긴 글 작성 등)에는 "이 실습실에서는 실습 질문만 도와드려요."라고 한 줄로만 답한다.',
  coach: '너는 실타래 실습실(AX 문제 정의 실습)의 코치다. 학생의 문제 정의와 자동화 설계를 돕는 대화만 한다. 실습과 관계없는 요청(다른 과제, 일반 상담, 번역, 긴 글이나 코드 작성 등)에는 "이 실습실에서는 실습 이야기만 도와드려요."라고 한 줄로만 답한다.',
  code: '너는 실타래 실습실(AX 문제 정의 실습)의 조교다. 학생의 자동화 설계도에 맞는 Google Apps Script 예시만 만든다. 설계도와 관계없는 요청에는 "이 실습실에서는 설계도에 맞는 코드만 만들어 드려요."라고 한 줄로만 답한다.',
};
const allowedOrigins = () => (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const hits = new Map(); // 같은 인스턴스 안에서만 세는 간단한 제한. 진짜 안전장치는 OpenAI 쪽 월 예산 한도.

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

function limited(ip){
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now); hits.set(ip, list);
  return list.length > PER_MINUTE;
}

export async function POST(request){
  const key = process.env.OPENAI_API_KEY, allowed = allowedOrigins();
  // 사이트 제한을 걸지 않았으면 키가 있어도 쓰지 않는다
  if (!key || !allowed.length) return json(503, {demo: true});
  if (!allowed.includes(request.headers.get('origin') || '')) return json(403, {error: 'origin'});

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
      messages: [{role: 'system', content: SYSTEM[kind]}, ...messages.map(({role, content}) => ({role, content}))],
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
