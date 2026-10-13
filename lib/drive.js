// 구글 드라이브 과제 폴더를 읽어 교육생별·회차별 과제 제출 현황을 자동으로 만든다.
//
// 폴더 구조(운영 중인 "02_과제" 폴더 기준):
//   02_과제 / 01_강영화 / 1회차 / (제출 파일들)
//                       / 2회차 / ...
// - 교육생 폴더 이름은 "번호_이름" 형태이고, 이름으로 교육생 명단과 맞춘다.
// - 회차 폴더 이름의 숫자("1회차")가 회차 번호이고, 그 안에 파일이 1개 이상 있으면 제출한 것으로 본다.
// - 폴더가 "링크가 있는 모든 사용자 - 뷰어"로 공유돼 있으면 API 키만으로 읽을 수 있다.
//
// 환경변수: GOOGLE_API_KEY (필수), DRIVE_SUBMISSION_FOLDER_ID (선택, 기본값은 02_과제 폴더)

const DEFAULT_ROOT = '149C_fJPA22Q7o5DPC5gWT8KYR6eeseRR';
const FOLDER = 'application/vnd.google-apps.folder';
const CACHE_MS = 5 * 60 * 1000;
const NO_ASSIGNMENT = [16]; // 16회차는 별도 필수 과제 없음

let cache = null; // { at, data }

export function submissionConfigured() {
  return Boolean(process.env.GOOGLE_API_KEY);
}

export function hasAssignment(sessionN) {
  return !NO_ASSIGNMENT.includes(Number(sessionN));
}

function studentNameFromFolder(name) {
  return String(name || '').replace(/^\s*\d+\s*[_\-.\s]\s*/, '').trim();
}

function sessionFromFolder(name) {
  const m = String(name || '').match(/(\d+)\s*회차/);
  return m ? Number(m[1]) : null;
}

async function listFiles(q, fields) {
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q, fields: `nextPageToken,files(${fields})`, pageSize: '1000', key: process.env.GOOGLE_API_KEY,
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    out.push(...(json.files || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

function chunk(arr, n) {
  const res = [];
  for (let i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n));
  return res;
}

const inParents = (ids) => '(' + ids.map((id) => `'${id}' in parents`).join(' or ') + ')';

async function scan() {
  const root = process.env.DRIVE_SUBMISSION_FOLDER_ID || DEFAULT_ROOT;
  const studentFolders = await listFiles(`'${root}' in parents and mimeType='${FOLDER}' and trashed=false`, 'id,name');

  const sessionFolders = [];
  for (const ids of chunk(studentFolders.map((f) => f.id), 20)) {
    sessionFolders.push(...await listFiles(`${inParents(ids)} and mimeType='${FOLDER}' and trashed=false`, 'id,name,parents'));
  }

  const filesByFolder = new Map(); // 회차 폴더 id -> { count, last }
  for (const ids of chunk(sessionFolders.map((f) => f.id), 25)) {
    const files = await listFiles(`${inParents(ids)} and mimeType!='${FOLDER}' and trashed=false`, 'id,name,parents,modifiedTime');
    for (const f of files) {
      const pid = (f.parents || [])[0];
      const cur = filesByFolder.get(pid) || { count: 0, last: '' };
      cur.count += 1;
      if (f.modifiedTime && f.modifiedTime > cur.last) cur.last = f.modifiedTime;
      filesByFolder.set(pid, cur);
    }
  }

  const sessionsByStudent = new Map();
  for (const sf of sessionFolders) {
    const n = sessionFromFolder(sf.name);
    if (!n) continue;
    const pid = (sf.parents || [])[0];
    const info = filesByFolder.get(sf.id) || { count: 0, last: '' };
    const map = sessionsByStudent.get(pid) || {};
    map[n] = { count: info.count, last: info.last };
    sessionsByStudent.set(pid, map);
  }

  const students = studentFolders.map((f) => ({
    folder: f.name,
    name: studentNameFromFolder(f.name),
    sessions: sessionsByStudent.get(f.id) || {}
  }));
  return { fetchedAt: new Date().toISOString(), students };
}

// 결과: { ok:true, fetchedAt, students:[{folder,name,sessions:{n:{count,last}}}] } 또는 { ok:false, reason, error }
export async function getSubmissionData({ refresh = false } = {}) {
  if (!submissionConfigured()) return { ok: false, reason: 'not_configured', error: 'GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.' };
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const data = { ok: true, ...(await scan()) };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    // 일시 오류면 직전 성공 결과를 그대로 보여줌
    if (cache) return { ...cache.data, stale: true, error: e.message };
    return { ok: false, reason: e.status === 403 || e.status === 400 ? 'access' : 'error', error: e.message };
  }
}

export function findStudent(data, name) {
  if (!data?.ok || !name) return null;
  const key = String(name).replace(/\s+/g, '');
  return data.students.find((s) => s.name.replace(/\s+/g, '') === key) || null;
}
