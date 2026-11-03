// 구독 서버 시험(바깥에 아무것도 보내지 않음, Resend 는 흉내만): node _src/newsletter/worker/test.mjs
import assert from 'node:assert/strict';
import worker, { makeToken, readToken, validEmail } from './worker.js';

const SITE = 'https://shiftaimagazine.com';
const env = { SITE, FROM: 'SHIFT AI <news@shiftaimagazine.com>', REPLY_TO: 'x@example.com', SEGMENT_ID: 'seg-1', START: '2026-01-01T00:00:00+09:00',
  RESEND_API_KEY: 're_test', SIGNING_SECRET: 'test-secret-0123456789abcdef' };
const calls = [];
let contactExists = false;
globalThis.fetch = async (url, init = {}) => {
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ url, method: init.method, body, headers: init.headers });
  const res = (s, d) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/emails')) return res(200, { id: 'em_1' });
  if (url.endsWith('/contacts') && init.method === 'POST') return contactExists ? res(422, { name: 'validation_error', message: 'Contact already exists' }) : res(200, { object: 'contact', id: 'c_1' });
  if (/\/contacts\/[^/]+$/.test(url) && init.method === 'PATCH') return res(200, { object: 'contact', id: 'c_1' });
  if (/\/segments\//.test(url)) return res(200, { id: 'seg-1' });
  return res(404, {});
};
const req = (path, body, origin = SITE, method = 'POST') => new Request('https://w.example' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const call = async (...a) => { const r = await worker.fetch(req(...a), env); return { s: r.status, j: await r.json().catch(() => null), h: r.headers }; };

// 주소 검사
for (const e of ['a@b.co', 'kim.min-su+ai@naver.com', 'x_y@sub.daum.net']) assert.ok(validEmail(e), e);
for (const e of ['', 'a@b', 'a@@b.com', 'a b@c.com', '.a@b.com', 'a..b@c.com', 'a@-b.com', 'a@b.c', 'x'.repeat(65) + '@b.com']) assert.ok(!validEmail(e), e);

// 토큰: 만들고 읽기, 변조, 만료
const now = Date.parse('2026-11-12T10:00:00+09:00');
const t = await makeToken(env, 'kim@naver.com', now);
assert.equal((await readToken(env, t, now)).email, 'kim@naver.com');
assert.equal(await makeToken(env, 'kim@naver.com', now + 3600e3), t, '같은 날이면 같은 토큰');
assert.equal((await readToken(env, t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA'), now)).error, 'bad');
assert.equal((await readToken({ ...env, SIGNING_SECRET: 'other' }, t, now)).error, 'bad');
assert.equal((await readToken(env, t, now + 4 * 86400e3)).error, 'expired');
assert.equal((await readToken(env, 'garbage', now)).error, 'bad');

// 다른 사이트에서 온 요청은 막음
assert.equal((await call('/subscribe', { email: 'a@b.co', ms: 5000 }, 'https://evil.example')).s, 403);
// 미리 보내는 요청(CORS)
{ const r = await worker.fetch(new Request('https://w.example/subscribe', { method: 'OPTIONS', headers: { Origin: SITE } }), env);
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE); }
// 잘못된 주소
assert.equal((await call('/subscribe', { email: 'nope', ms: 5000 })).j.error, 'bad_email');
// 로봇: 숨은 칸·너무 빠른 제출 → 성공처럼 답하고 메일 안 보냄
calls.length = 0;
assert.deepEqual((await call('/subscribe', { email: 'bot@b.co', hp: 'x', ms: 5000 })).j, { ok: true });
assert.deepEqual((await call('/subscribe', { email: 'bot@b.co', ms: 200 })).j, { ok: true });
assert.equal(calls.length, 0);
// 정상 신청 → 확인 메일 1통(멱등 키 포함, 링크는 사이트 /subscribe/?t=)
{ const r = await call('/subscribe', { email: ' Kim@Naver.com ', ms: 4000 });
  assert.equal(r.s, 200); assert.deepEqual(r.j, { ok: true }); assert.equal(r.h.get('Access-Control-Allow-Origin'), SITE);
  assert.equal(calls.length, 1); const c = calls[0];
  assert.ok(c.url.endsWith('/emails')); assert.deepEqual(c.body.to, ['kim@naver.com']);
  assert.match(c.headers['Idempotency-Key'], /^confirm-[0-9a-f]{32}-\d+$/);
  assert.match(c.body.html, /https:\/\/shiftaimagazine\.com\/subscribe\/\?t=[A-Za-z0-9_.-]+/); assert.ok(c.body.text.includes('/subscribe/?t=')); }
// 시작 전에는 받지 않음
assert.equal((await worker.fetch(req('/subscribe', { email: 'a@b.co', ms: 5000 }), { ...env, START: '2099-01-01T00:00:00Z' })).status, 403);
// 확정: 새 연락처
const t2 = calls[0].body.text.match(/\?t=([A-Za-z0-9_.-]+)/)[1];
calls.length = 0;
{ const r = await call('/confirm', { t: t2 }); assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].body, { email: 'kim@naver.com', unsubscribed: false, segments: [{ id: 'seg-1' }] }); }
// 확정: 이미 있던 연락처(예전에 해지) → 수신 다시 켜고 세그먼트에 넣음
contactExists = true; calls.length = 0;
{ const r = await call('/confirm', { t: t2 }); assert.equal(r.s, 200);
  assert.equal(calls.length, 3); assert.equal(calls[1].method, 'PATCH'); assert.deepEqual(calls[1].body, { unsubscribed: false }); assert.ok(calls[2].url.endsWith('/contacts/kim%40naver.com/segments/seg-1')); }
// 확정: 변조된 토큰
assert.equal((await call('/confirm', { t: t2.replace(/.$/, c => c === 'A' ? 'B' : 'A') })).j.error, 'bad');
// 설정이 빠지면 503
assert.equal((await worker.fetch(req('/subscribe', { email: 'a@b.co', ms: 5000 }), { ...env, RESEND_API_KEY: '' })).status, 503);
// 그 밖의 주소
assert.equal((await call('/other', {})).s, 404);
console.log('worker tests ok');
