// 별도 DB 변경 없이 Supabase Storage 비공개 버킷(app-data)에 JSON 파일로 저장하는 작은 저장소.
// 서버(service_role)에서만 읽고 쓰며, 브라우저에는 이 파일이 직접 노출되지 않는다.
import { supabaseAdmin } from './supabaseAdmin';

const BUCKET = 'app-data';

async function ensureBucket(db) {
  const { error } = await db.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

// 없으면 null
export async function readJson(name) {
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(BUCKET).download(name);
  if (error) {
    if (/bucket not found/i.test(error.message || '')) await ensureBucket(db);
    return null;
  }
  try { return JSON.parse(await data.text()); } catch { return null; }
}

export async function writeJson(name, obj) {
  const db = supabaseAdmin();
  const body = Buffer.from(JSON.stringify(obj));
  const opts = { upsert: true, contentType: 'application/json' };
  let { error } = await db.storage.from(BUCKET).upload(name, body, opts);
  if (error && /bucket not found/i.test(error.message || '')) {
    await ensureBucket(db);
    ({ error } = await db.storage.from(BUCKET).upload(name, body, opts));
  }
  if (error) throw error;
}
