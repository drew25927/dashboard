// 별도 DB 변경 없이 Supabase Storage 비공개 버킷(app-data)에 JSON 파일로 저장하는 작은 저장소.
// 서버(service_role)에서만 읽고 쓰며, 브라우저에는 이 파일이 직접 노출되지 않는다.
//
// 읽을 때는 매번 새 서명 주소(createSignedUrl)로 가져온다. 같은 주소로 download() 하면
// 스토리지 CDN이 이전 버전을 한동안 돌려줘서, 방금 저장한 내용이 안 보이는 일이 생기기 때문.
import { supabaseAdmin } from './supabaseAdmin';

const BUCKET = 'app-data';

async function ensureBucket(db) {
  const { error } = await db.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

// 없으면 null
export async function readJson(name) {
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(name, 60);
  if (error || !data?.signedUrl) {
    if (/bucket not found/i.test(error?.message || '')) await ensureBucket(db);
    return null;
  }
  const sep = data.signedUrl.includes('?') ? '&' : '?';
  const res = await fetch(data.signedUrl + sep + '_=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) return null;
  try { return JSON.parse(await res.text()); } catch { return null; }
}

export async function writeJson(name, obj) {
  const db = supabaseAdmin();
  const body = Buffer.from(JSON.stringify(obj));
  const opts = { upsert: true, contentType: 'application/json', cacheControl: '0' };
  let { error } = await db.storage.from(BUCKET).upload(name, body, opts);
  if (error && /bucket not found/i.test(error.message || '')) {
    await ensureBucket(db);
    ({ error } = await db.storage.from(BUCKET).upload(name, body, opts));
  }
  if (error) throw error;
}
