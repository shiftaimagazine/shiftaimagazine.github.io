// SHIFT AI 메일 구독 서버 (Cloudflare Workers, 무료 요금제로 충분)
// 하는 일: 구독 신청을 받아 확인 메일을 보내고, 확인 버튼을 누른 주소만 Resend 연락처(세그먼트)에 넣는다(이중 확인).
// 구독 해지는 메일 아래 링크로 Resend 가 직접 처리한다(이 서버를 거치지 않음).
// 이 서버는 주소를 따로 저장하지 않는다. 확인 전 주소는 서명한 링크(토큰) 안에만 들어 있다.
//
// 설정(wrangler.toml [vars]): SITE · FROM · REPLY_TO · SEGMENT_ID · START · ALLOW_ORIGINS(선택)
// 비밀값(wrangler secret): RESEND_API_KEY · SIGNING_SECRET · TURNSTILE_SECRET(선택)
// 선택 바인딩: RL(속도 제한, wrangler.toml [[ratelimits]])
//
// 주소: POST /subscribe {email, hp, ms[, ts]} → 확인 메일 / POST /confirm {t} → 구독 확정

const enc = new TextEncoder();
const DAY = 86400000;
const TOKEN_DAYS = 2; // 확인 링크는 신청한 날 포함 2~3일 동안 열린다

const b64u = bytes => {
  let s = ''; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
// 토큰 = base64url("주소|만료시각") + "." + base64url(HMAC). 만료 시각을 하루 단위로 맞춰, 같은 날 같은 주소면 같은 토큰이 나온다.
async function makeToken(env, email, now) {
  const exp = Math.floor(now / DAY) * DAY + (TOKEN_DAYS + 1) * DAY;
  const payload = enc.encode(`${email}|${exp}`);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SIGNING_SECRET), payload);
  return `${b64u(payload)}.${b64u(sig)}`;
}
async function readToken(env, t, now) {
  const m = /^([A-Za-z0-9_-]{8,700})\.([A-Za-z0-9_-]{20,100})$/.exec(String(t || ''));
  if (!m) return { error: 'bad' };
  let payload, sig;
  try { payload = unb64u(m[1]); sig = unb64u(m[2]); } catch { return { error: 'bad' }; }
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SIGNING_SECRET), sig, payload);
  if (!ok) return { error: 'bad' };
  const [email, exp] = new TextDecoder().decode(payload).split('|');
  if (!validEmail(email) || !(Number(exp) > 0)) return { error: 'bad' };
  if (now > Number(exp)) return { error: 'expired' };
  return { email };
}

const normEmail = s => String(s || '').trim().toLowerCase();
function validEmail(e) {
  if (!e || e.length > 254) return false;
  const m = /^([^\s@<>()[\]",;:\\]{1,64})@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/.exec(e);
  return !!m && /\.[a-z]{2,}$/.test(m[2]) && !m[1].startsWith('.') && !m[1].endsWith('.') && !m[1].includes('..');
}

function allowedOrigins(env) {
  return [env.SITE, ...String(env.ALLOW_ORIGINS || '').split(',')].map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
}
function cors(env, origin) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
const json = (env, origin, status, body) => new Response(JSON.stringify(body), { status, headers: cors(env, origin) });

async function resend(env, method, path, body, extraHeaders = {}) {
  const r = await fetch('https://api.resend.com' + path, {
    method,
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'shift-ai-newsletter-worker', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null; try { data = await r.json(); } catch { /* 빈 응답 */ }
  return { ok: r.ok, status: r.status, data };
}

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function confirmMail(env, link) {
  const site = env.SITE.replace(/\/$/, '');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>구독 신청 확인</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:#111214">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px">
<tr><td style="padding:28px 28px 8px"><img src="${site}/img/brand/logo-wide-mail.png" width="140" height="45" alt="SHIFT AI" style="display:block;border:0;width:140px;height:auto"></td></tr>
<tr><td style="padding:12px 28px 0;font-size:20px;font-weight:700;line-height:1.45">구독 신청을 확인해 주세요</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.75;color:#3f4046">SHIFT AI 데일리 메일 구독 신청을 받았습니다. 아래 버튼을 누르면 구독이 확정되고, 그날 나온 데일리 이슈를 매일 아침 7시에 보내 드립니다.</td></tr>
<tr><td style="padding:22px 28px 6px"><a href="${escHtml(link)}" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:8px">구독 확정하기</a></td></tr>
<tr><td style="padding:14px 28px 0;font-size:13px;line-height:1.7;color:#6f7076">버튼이 안 눌리면 이 주소를 브라우저에 붙여 넣으세요.<br><a href="${escHtml(link)}" style="color:#6f7076;word-break:break-all">${escHtml(link)}</a></td></tr>
<tr><td style="padding:18px 28px 28px;font-size:13px;line-height:1.7;color:#6f7076">직접 신청하지 않았다면 이 메일은 무시하셔도 됩니다. 버튼을 누르지 않으면 더는 메일이 가지 않습니다. 확인 링크는 ${TOKEN_DAYS}일 동안 열려 있습니다.</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#8a8b90">SHIFT AI · <a href="${site}/" style="color:#8a8b90">shiftaimagazine.com</a> · <a href="${site}/privacy/" style="color:#8a8b90">개인정보처리방침</a></p>
</td></tr></table></body></html>`;
  const text = `SHIFT AI 데일리 메일 구독 신청을 받았습니다.\n아래 주소를 열어 구독을 확정해 주세요. 확정하면 그날 나온 데일리 이슈를 매일 아침 7시에 보내 드립니다.\n\n${link}\n\n직접 신청하지 않았다면 이 메일은 무시하셔도 됩니다. 확인하지 않으면 더는 메일이 가지 않습니다.\n\nSHIFT AI · ${site}/`;
  return { subject: '[SHIFT AI] 구독 신청을 확인해 주세요', html, text };
}

async function sha256hex(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }

async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', token); if (ip) form.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const d = await r.json().catch(() => ({})); return !!d.success;
}

async function subscribe(req, env, origin, now) {
  if (env.START && now < Date.parse(env.START)) return json(env, origin, 403, { ok: false, error: 'not_open' });
  let b; try { b = await req.json(); } catch { return json(env, origin, 400, { ok: false, error: 'bad_request' }); }
  const email = normEmail(b.email);
  if (!validEmail(email)) return json(env, origin, 400, { ok: false, error: 'bad_email' });
  // 스팸 로봇: 숨은 칸(hp)을 채웠거나 페이지를 연 지 1.5초도 안 돼 보냈으면 성공처럼 답하고 아무것도 안 한다
  if (b.hp || !(Number(b.ms) >= 1500)) return json(env, origin, 200, { ok: true });
  const ip = req.headers.get('CF-Connecting-IP') || '';
  if (env.RL) { const { success } = await env.RL.limit({ key: 'ip:' + ip }); if (!success) return json(env, origin, 429, { ok: false, error: 'too_many' }); }
  if (!(await turnstileOk(env, b.ts, ip))) return json(env, origin, 400, { ok: false, error: 'captcha' });

  const token = await makeToken(env, email, now);
  const link = `${env.SITE.replace(/\/$/, '')}/subscribe/?t=${token}`;
  const m = confirmMail(env, link);
  // 같은 주소·같은 날에는 확인 메일을 한 번만 보낸다(Resend 멱등 키 24시간). 남의 주소로 메일을 퍼붓는 것을 막는다.
  const key = 'confirm-' + (await sha256hex(email)).slice(0, 32) + '-' + Math.floor(now / DAY);
  const r = await resend(env, 'POST', '/emails', {
    from: env.FROM, to: [email], reply_to: env.REPLY_TO || undefined, subject: m.subject, html: m.html, text: m.text,
    tags: [{ name: 'kind', value: 'confirm' }],
  }, { 'Idempotency-Key': key });
  if (!r.ok && r.status !== 409) {
    console.log('confirm mail failed', r.status, JSON.stringify(r.data));
    return json(env, origin, 502, { ok: false, error: r.status === 429 ? 'busy' : 'send_failed' });
  }
  return json(env, origin, 200, { ok: true });
}

async function confirm(req, env, origin, now) {
  let b; try { b = await req.json(); } catch { return json(env, origin, 400, { ok: false, error: 'bad_request' }); }
  const t = await readToken(env, b.t, now);
  if (t.error) return json(env, origin, t.error === 'expired' ? 410 : 400, { ok: false, error: t.error });
  const email = t.email, seg = env.SEGMENT_ID;
  const c = await resend(env, 'POST', '/contacts', { email, unsubscribed: false, segments: [{ id: seg }] });
  if (!c.ok) {
    if (c.status === 401 || c.status === 403 || c.status >= 500) { console.log('contact create failed', c.status, JSON.stringify(c.data)); return json(env, origin, 502, { ok: false, error: 'save_failed' }); }
    // 이미 있는 주소(예전에 해지했다가 다시 확인한 경우 포함): 수신을 다시 켜고 세그먼트에 넣는다
    const e = encodeURIComponent(email);
    const u = await resend(env, 'PATCH', `/contacts/${e}`, { unsubscribed: false });
    const s = await resend(env, 'POST', `/contacts/${e}/segments/${encodeURIComponent(seg)}`);
    if (!u.ok || (!s.ok && s.status !== 409 && s.status !== 422)) { console.log('contact update failed', c.status, u.status, s.status, JSON.stringify([c.data, u.data, s.data])); return json(env, origin, 502, { ok: false, error: 'save_failed' }); }
  }
  return json(env, origin, 200, { ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    const now = Date.now();
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
    if (url.pathname === '/' && req.method === 'GET') return new Response('SHIFT AI newsletter', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    if (req.method !== 'POST' || !['/subscribe', '/confirm'].includes(url.pathname)) return json(env, origin, 404, { ok: false, error: 'not_found' });
    // 사이트에서 온 요청만 받는다
    if (!allowedOrigins(env).includes(origin)) return json(env, origin, 403, { ok: false, error: 'origin' });
    if (!env.RESEND_API_KEY || !env.SIGNING_SECRET || !env.SEGMENT_ID || !env.FROM || !env.SITE) return json(env, origin, 503, { ok: false, error: 'not_configured' });
    try {
      return url.pathname === '/subscribe' ? await subscribe(req, env, origin, now) : await confirm(req, env, origin, now);
    } catch (e) {
      console.log('error', e && e.stack || e);
      return json(env, origin, 500, { ok: false, error: 'server' });
    }
  },
};

// 시험용(node test.mjs 가 씀)
export { makeToken, readToken, validEmail };
