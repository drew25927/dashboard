// 로그인 쿠키(admin_session, student_sid)에 서명을 붙여서 위조를 막는다.
// 쿠키 값 형식: v1.<base64url(JSON)>.<base64url(HMAC-SHA256)>
// - 서명 비밀값: SESSION_SECRET 환경변수. 없으면 서버 전용 키(SUPABASE_SERVICE_ROLE_KEY)에서 만든다.
// - 서명이 없거나 틀린 값(예전 형식의 평문 JSON 포함)은 로그인되지 않은 것으로 본다.
// - 만료 시각(exp)이 지나면 무효.
import crypto from 'crypto';

function secret() {
  const base = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('세션 서명 비밀값이 설정되어 있지 않습니다 (SESSION_SECRET 또는 SUPABASE_SERVICE_ROLE_KEY).');
  return crypto.createHash('sha256').update('session-cookie:' + base).digest();
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (payloadB64) => crypto.createHmac('sha256', secret()).update('v1.' + payloadB64).digest();

// payload: { id, ... }, maxAgeSec: 쿠키 유효 기간(초)
export function signSession(payload, maxAgeSec) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSec }));
  return 'v1.' + body + '.' + b64(hmac(body));
}

// 올바른 쿠키면 payload 객체, 아니면 null
export function verifySession(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, body, sig] = parts;

  let expected;
  try { expected = hmac(body); } catch { return null; }
  let given;
  try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let data;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data !== 'object' || !data.id) return null;
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}
