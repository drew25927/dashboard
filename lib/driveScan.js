// 구글 드라이브 "링크가 있는 모든 사용자" 공유 폴더를 API 키 없이 읽는다.
// 드라이브가 공개 폴더용으로 제공하는 임베드 목록 화면(embeddedfolderview)의 HTML을 읽어
// 폴더 안의 항목(이름·폴더 여부)을 얻는다.
//
// 폴더 구조: 02_과제 / 01_강영화 / 1회차 / (제출 파일, 하위 폴더 포함)
//  - 교육생 폴더 이름은 "번호_이름" → 이름으로 교육생 명단과 맞춘다.
//  - 회차 폴더 이름의 숫자("1회차")가 회차 번호. 폴더 안(하위 폴더 포함)에 파일이 1개 이상이면 제출.

export const DEFAULT_ROOT = '149C_fJPA22Q7o5DPC5gWT8KYR6eeseRR';
const LIMIT = 12; // 동시에 읽는 폴더 수
const MAX_DEPTH = 4; // 회차 폴더 아래 하위 폴더를 따라 들어가는 깊이

let running = 0;
const waiters = [];
async function withSlot(fn) {
  if (running >= LIMIT) await new Promise((r) => waiters.push(r));
  running++;
  try { return await fn(); } finally { running--; const next = waiters.shift(); if (next) next(); }
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
function decode(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function parseEntries(html) {
  const out = [];
  const parts = String(html).split('class="flip-entry"').slice(1);
  for (const part of parts) {
    const id = /id="entry-([A-Za-z0-9_-]+)"/.exec(part)?.[1];
    const href = /href="([^"]+)"/.exec(part)?.[1] || '';
    const title = /class="flip-entry-title">([\s\S]*?)<\/div>/.exec(part)?.[1];
    if (!id || title == null) continue;
    out.push({ id, name: decode(title).trim(), isFolder: href.includes('/drive/folders/') });
  }
  return out;
}

async function listFolder(id, attempt = 0) {
  try {
    return await withSlot(async () => {
      const res = await fetch('https://drive.google.com/embeddedfolderview?id=' + encodeURIComponent(id), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dashboard-sync)' }, cache: 'no-store', signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { const e = new Error('드라이브 응답 오류 (HTTP ' + res.status + ')'); e.status = res.status; throw e; }
      const html = await res.text();
      return { entries: parseEntries(html), html };
    });
  } catch (e) {
    if (attempt < 2 && e.status !== 404) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return listFolder(id, attempt + 1);
    }
    throw e;
  }
}

async function countFiles(id, depth) {
  const { entries } = await listFolder(id);
  let count = entries.filter((e) => !e.isFolder).length;
  if (depth < MAX_DEPTH) {
    const subs = entries.filter((e) => e.isFolder);
    const counts = await Promise.all(subs.map((s) => countFiles(s.id, depth + 1)));
    count += counts.reduce((a, b) => a + b, 0);
  }
  return count;
}

export function studentNameFromFolder(name) {
  return String(name || '').replace(/^\s*\d+\s*[_\-.\s]\s*/, '').trim();
}

export function sessionFromFolder(name) {
  const m = String(name || '').match(/(\d+)\s*회차/);
  return m ? Number(m[1]) : null;
}

// 결과: { fetchedAt, students:[{folder,name,sessions:{n:{count}}}] } (실패 시 예외)
export async function scanDrive(rootId = DEFAULT_ROOT) {
  const started = Date.now();
  const { entries: studentFolders, html } = await listFolder(rootId);
  const folders = studentFolders.filter((e) => e.isFolder);
  if (!folders.length) {
    const blocked = /ServiceLogin|accounts\.google\.com/.test(html);
    throw new Error(blocked ? '폴더 공유 설정이 "링크가 있는 모든 사용자 - 뷰어"가 아니어서 읽을 수 없습니다.' : '과제 폴더 안에 교육생 폴더가 없습니다.');
  }
  const students = await Promise.all(folders.map(async (sf) => {
    const { entries } = await listFolder(sf.id);
    const sessionFolders = entries.filter((e) => e.isFolder && sessionFromFolder(e.name));
    const sessions = {};
    await Promise.all(sessionFolders.map(async (sess) => {
      const n = sessionFromFolder(sess.name);
      sessions[n] = { count: await countFiles(sess.id, 1) };
    }));
    return { folder: sf.name, name: studentNameFromFolder(sf.name), sessions };
  }));
  return { fetchedAt: new Date().toISOString(), durationMs: Date.now() - started, students };
}
