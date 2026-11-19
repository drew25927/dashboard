// 생성형 AI 서비스 안내(서비스별 주의사항)와 교육생별 구글 계정 정보.
// 모든 서비스에 같은 구글 계정으로 로그인하는 구조라서, 계정은 서비스별이 아니라 교육생별로 하나씩 저장한다.
// 저장 위치: Storage app-data/ai-accounts.json
// 형태: { common: '공통 주의사항',
//        google: { mailUrl, finalEnd, shared: { loginId, password }, students: { [studentId]: { loginId, password, note } } },
//        staff: [{ id, name, loginId, password, note }]  // 관리자·강사 계정(관리자 화면 전용)
//        guide: '사용 방법', help: '구글 로그인 인증 시 해결 방법',
//        tools: [{ id, name, url, purpose, loginHow, cautions }] }
import { readJson, writeJson } from './appData';
import { kstToday } from './lesson';
import { storeName } from './courses';

// 교육별로 파일 하나씩 (기존 교육은 예전 이름 그대로)
const fileFor = (courseId) => storeName('ai-accounts', courseId);

export function emptyConfig() {
  return { common: '', guide: '', help: '', google: { mailUrl: '', finalEnd: '', shared: { loginId: '', password: '' }, students: {} }, staff: [], tools: [] };
}

export async function getAiConfig(courseId = 'main') {
  const cfg = await readJson(fileFor(courseId));
  if (!cfg || !Array.isArray(cfg.tools)) return emptyConfig();
  const base = emptyConfig();
  return { ...base, ...cfg, google: { ...base.google, ...(cfg.google || {}) } };
}

export async function saveAiConfig(courseId, cfg) {
  await writeJson(fileFor(courseId), cfg);
}

const str = (v, max) => String(v ?? '').slice(0, max);

// ── 이용 기간 표시 (매월 기준) ──
// 교육생별 메모(note)의 첫 날짜를 이용 시작일로 보고, 첫 달 기간은 시작일~한 달 뒤 전날까지 보여준다.
// 첫 달이 끝나면 그다음 기간은 (첫 달 끝 다음 날) ~ 모든 교육생 공통 최종 종료일(finalEnd)로 보여준다.
export function parseYmd(v) {
  const m = String(v || '').match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
export function fmtYmd(d) {
  return d.getUTCFullYear() + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + String(d.getUTCDate()).padStart(2, '0');
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export function periodFor(note, finalEnd, today = kstToday()) {
  const start = parseYmd(note);
  if (!start) return '';
  const end1 = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() - 1));
  const t = parseYmd(today);
  const fin = parseYmd(finalEnd);
  if (!fin || (t && t <= end1)) return fmtYmd(start) + ' ~ ' + fmtYmd(end1);
  return fmtYmd(addDays(end1, 1)) + ' ~ ' + fmtYmd(fin);
}

// 관리자 화면에서 받은 값을 안전한 형태로 정리 (길이 제한, 알 수 없는 항목 제거)
export function sanitizeConfig(input) {
  const out = emptyConfig();
  out.common = str(input?.common, 3000);
  out.guide = str(input?.guide, 3000);
  out.help = str(input?.help, 3000);
  let mailUrl = str(input?.google?.mailUrl, 300).trim();
  if (mailUrl && !/^https?:\/\//i.test(mailUrl)) mailUrl = 'https://' + mailUrl;
  out.google.mailUrl = mailUrl;
  const fe = parseYmd(input?.google?.finalEnd);
  out.google.finalEnd = fe ? fmtYmd(fe) : '';
  for (const s of (Array.isArray(input?.staff) ? input.staff : []).slice(0, 30)) {
    const name = str(s?.name, 60).trim();
    const loginId = str(s?.loginId, 200).trim();
    const password = str(s?.password, 200);
    if (!name && !loginId) continue;
    out.staff.push({ id: str(s?.id, 40).replace(/[^A-Za-z0-9_-]/g, '') || 's' + out.staff.length, name, loginId, password, note: str(s?.note, 200).trim() });
  }
  out.google.shared = { loginId: str(input?.google?.shared?.loginId, 200).trim(), password: str(input?.google?.shared?.password, 200) };
  const rows = input?.google?.students;
  if (rows && typeof rows === 'object') {
    for (const [sid, a] of Object.entries(rows).slice(0, 500)) {
      const loginId = str(a?.loginId, 200).trim();
      const password = str(a?.password, 200);
      const note = str(a?.note, 200).trim();
      if (!loginId && !password) continue;
      out.google.students[str(sid, 20)] = { loginId, password, note };
    }
  }
  const seen = new Set();
  for (const t of (Array.isArray(input?.tools) ? input.tools : []).slice(0, 20)) {
    const id = str(t?.id, 40).replace(/[^A-Za-z0-9_-]/g, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let url = str(t?.url, 300).trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    out.tools.push({ id, name: str(t?.name, 60).trim(), url, purpose: str(t?.purpose, 200).trim(), loginHow: str(t?.loginHow, 200).trim(), cautions: str(t?.cautions, 3000) });
  }
  return out;
}

// 관리자(강사)로 로그인한 사람에게 보여줄 내용: 운영진 계정 전체(본인 것은 맨 위) + 사용 방법 + 서비스 안내
export function viewForStaff(cfg, adminName) {
  const norm = (s) => String(s || '').replace(/\s+/g, '');
  const staff = (cfg.staff || []).map((s) => ({
    id: s.id, name: s.name, loginId: s.loginId, password: s.password,
    period: periodFor(s.note, cfg.google?.finalEnd), mine: Boolean(adminName) && norm(s.name) === norm(adminName)
  }));
  staff.sort((a, b) => Number(b.mine) - Number(a.mine));
  const me = staff.find((s) => s.mine);
  const tools = cfg.tools.map((t) => ({ id: t.id, name: t.name, url: t.url, purpose: t.purpose, loginHow: t.loginHow || '', cautions: t.cautions }));
  return { common: cfg.common, guide: cfg.guide || '', help: cfg.help || '', mailUrl: cfg.google?.mailUrl || '', staff, period: me ? me.period : '', tools };
}

// 교육생 한 명에게 보여줄 내용만 골라낸다 (다른 교육생의 계정은 절대 포함하지 않음)
export function viewFor(cfg, studentId) {
  const own = cfg.google?.students?.[studentId];
  const shared = cfg.google?.shared;
  // note 원문(메모)은 내려보내지 않고, 계산된 이용 기간(period)만 보낸다. 관리자(강사) 계정(staff)은 교육생에게 절대 보내지 않는다.
  const google = own && (own.loginId || own.password) ? { loginId: own.loginId, password: own.password, kind: 'own' }
    : shared && (shared.loginId || shared.password) ? { loginId: shared.loginId, password: shared.password, kind: 'shared' } : null;
  const tools = cfg.tools.map((t) => ({ id: t.id, name: t.name, url: t.url, purpose: t.purpose, loginHow: t.loginHow || '', cautions: t.cautions }));
  return { common: cfg.common, period: own ? periodFor(own.note, cfg.google?.finalEnd) : '', guide: cfg.guide || '', help: cfg.help || '', google, mailUrl: cfg.google?.mailUrl || '', tools, hasGoogleSection: Boolean(google) || Boolean(cfg.guide) || Boolean(cfg.help) || Object.keys(cfg.google?.students || {}).length > 0 };
}
