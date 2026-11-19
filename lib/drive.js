// 구글 드라이브 과제 폴더의 제출 현황을 "하루 3번" 확인해 두고, 화면에서는 저장된 결과를 보여준다.
//
// - 확인 시각(한국 시간): 09:00 · 15:00 · 19:00. 해당 시각이 지난 뒤 처음 화면을 여는 사람이 있으면
//   그 순간 백그라운드로 드라이브를 다시 읽고(약 15초) 결과를 저장한다. 관리자 화면의 [지금 다시 확인]으로 즉시 갱신도 가능.
// - 결과는 Supabase Storage의 비공개 버킷(app-data/submissions.json, 새 교육은 submissions-<교육id>.json)에 JSON으로 저장한다(별도 DB 변경 불필요).
// - 드라이브 읽기는 API 키 없이 공개 공유 폴더를 읽는 lib/driveScan.js가 담당.

import { after } from 'next/server';
import { readJson, writeJson } from './appData';
import { DEFAULT_ROOT, scanDrive } from './driveScan';
import { getCourse, storeName, MAIN_COURSE } from './courses';

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

// 교육별로 결과 파일 하나씩, 드라이브 과제 폴더도 교육별로 다르다.
// 기존 교육(main)은 폴더를 따로 지정하지 않으면 예전 기본 폴더(환경변수 또는 기본값)를 쓴다.
const readStore = (courseId) => readJson(storeName('submissions', courseId));
const writeStore = (courseId, obj) => writeJson(storeName('submissions', courseId), obj);
const NO_FOLDER = { ok: false, reason: 'nofolder', error: '이 교육에는 구글 드라이브 과제 폴더가 설정되지 않았습니다. "과정 정보" 탭에서 폴더 주소를 입력해 주세요.' };

async function rootFor(courseId) {
  const c = await getCourse(courseId);
  if (c?.drive_folder_id) return c.drive_folder_id;
  return courseId === MAIN_COURSE ? (process.env.DRIVE_SUBMISSION_FOLDER_ID || DEFAULT_ROOT) : '';
}

// 드라이브를 읽어 결과를 저장한다. 실패하면 직전 결과는 그대로 두고 오류만 기록한다.
export async function refreshSubmissions(courseId = MAIN_COURSE) {
  const root = await rootFor(courseId);
  if (!root) return NO_FOLDER;
  const prev = await readStore(courseId).catch(() => null);
  await writeStore(courseId, { ...(prev || {}), scanningSince: Date.now() }).catch(() => {});
  try {
    const scan = await scanDrive(root);
    const next = { ok: true, ...scan, scanningSince: null, error: null };
    await writeStore(courseId, next);
    return next;
  } catch (e) {
    const failed = { ...(prev || {}), scanningSince: null, error: e.message, errorAt: new Date().toISOString() };
    await writeStore(courseId, failed).catch(() => {});
    return failed;
  }
}

// 화면에서 쓰는 조회 함수.
// 결과: { ok:true, fetchedAt, students, error?, scanning? } 또는 { ok:false, reason:'pending'|'error', error }
export async function getSubmissionData(courseId = MAIN_COURSE) {
  if (!(await rootFor(courseId))) return NO_FOLDER;
  let stored = null;
  try { stored = await readStore(courseId); } catch (e) { return { ok: false, reason: 'error', error: e.message }; }

  const fresh = stored?.fetchedAt && new Date(stored.fetchedAt).getTime() >= lastSlotStart();
  const locked = stored?.scanningSince && Date.now() - stored.scanningSince < LOCK_MS;
  const recentFail = stored?.errorAt && Date.now() - new Date(stored.errorAt).getTime() < 30 * 60 * 1000;
  if (!fresh && !locked && !recentFail) {
    // 응답은 바로 돌려주고, 드라이브 확인은 응답 뒤 백그라운드에서 진행
    try { after(() => refreshSubmissions(courseId)); } catch { /* after를 쓸 수 없는 환경이면 다음 접속 때 다시 시도 */ }
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
