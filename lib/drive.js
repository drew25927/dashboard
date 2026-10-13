// 구글 드라이브 과제 폴더의 제출 현황을 "하루 3번" 확인해 두고, 화면에서는 저장된 결과를 보여준다.
//
// - 확인 시각(한국 시간): 09:00 · 15:00 · 19:00. 해당 시각이 지난 뒤 처음 화면을 여는 사람이 있으면
//   그 순간 백그라운드로 드라이브를 다시 읽고(약 15초) 결과를 저장한다. 관리자 화면의 [지금 다시 확인]으로 즉시 갱신도 가능.
// - 결과는 Supabase Storage의 비공개 버킷(app-data/submissions.json)에 JSON으로 저장한다(별도 DB 변경 불필요).
// - 드라이브 읽기는 API 키 없이 공개 공유 폴더를 읽는 lib/driveScan.js가 담당.

import { after } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';
import { DEFAULT_ROOT, scanDrive } from './driveScan';

const BUCKET = 'app-data';
const OBJECT = 'submissions.json';
const SLOT_HOURS_KST = [9, 15, 19];
const LOCK_MS = 3 * 60 * 1000;

// 가장 최근에 지나간 확인 시각(UTC ms)
export function lastSlotStart(now = Date.now()) {
  const kst = new Date(now + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
  const slots = [];
  for (const day of [d - 1, d]) for (const h of SLOT_HOURS_KST) slots.push(Date.UTC(y, m, day, h) - 9 * 3600 * 1000);
  return Math.max(...slots.filter((t) => t <= now));
}

async function ensureBucket(db) {
  const { error } = await db.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

async function readStore() {
  const db = supabaseAdmin();
  let { data, error } = await db.storage.from(BUCKET).download(OBJECT);
  if (error) {
    if (/bucket not found/i.test(error.message || '')) await ensureBucket(db);
    return null; // 아직 한 번도 확인하지 않음
  }
  try { return JSON.parse(await data.text()); } catch { return null; }
}

async function writeStore(obj) {
  const db = supabaseAdmin();
  const body = Buffer.from(JSON.stringify(obj));
  let { error } = await db.storage.from(BUCKET).upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (error && /bucket not found/i.test(error.message || '')) {
    await ensureBucket(db);
    ({ error } = await db.storage.from(BUCKET).upload(OBJECT, body, { upsert: true, contentType: 'application/json' }));
  }
  if (error) throw error;
}

// 드라이브를 읽어 결과를 저장한다. 실패하면 직전 결과는 그대로 두고 오류만 기록한다.
export async function refreshSubmissions() {
  const prev = await readStore().catch(() => null);
  await writeStore({ ...(prev || {}), scanningSince: Date.now() }).catch(() => {});
  try {
    const root = process.env.DRIVE_SUBMISSION_FOLDER_ID || DEFAULT_ROOT;
    const scan = await scanDrive(root);
    const next = { ok: true, ...scan, scanningSince: null, error: null };
    await writeStore(next);
    return next;
  } catch (e) {
    const failed = { ...(prev || {}), scanningSince: null, error: e.message, errorAt: new Date().toISOString() };
    await writeStore(failed).catch(() => {});
    return failed;
  }
}

// 화면에서 쓰는 조회 함수.
// 결과: { ok:true, fetchedAt, students, error?, scanning? } 또는 { ok:false, reason:'pending'|'error', error }
export async function getSubmissionData() {
  let stored = null;
  try { stored = await readStore(); } catch (e) { return { ok: false, reason: 'error', error: e.message }; }

  const fresh = stored?.fetchedAt && new Date(stored.fetchedAt).getTime() >= lastSlotStart();
  const locked = stored?.scanningSince && Date.now() - stored.scanningSince < LOCK_MS;
  const recentFail = stored?.errorAt && Date.now() - new Date(stored.errorAt).getTime() < 30 * 60 * 1000;
  if (!fresh && !locked && !recentFail) {
    // 응답은 바로 돌려주고, 드라이브 확인은 응답 뒤 백그라운드에서 진행
    try { after(() => refreshSubmissions()); } catch { /* after를 쓸 수 없는 환경이면 다음 접속 때 다시 시도 */ }
  }

  if (stored?.ok) return { ...stored, scanning: Boolean(locked) };
  if (stored?.error) return { ok: false, reason: 'error', error: stored.error };
  return { ok: false, reason: 'pending', error: '아직 처음 확인 중입니다. 잠시 뒤 새로고침해 주세요.' };
}

export function findStudent(data, name) {
  if (!data?.ok || !name) return null;
  const key = String(name).replace(/\s+/g, '');
  return data.students.find((s) => s.name.replace(/\s+/g, '') === key) || null;
}
