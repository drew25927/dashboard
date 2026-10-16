// 생성형 AI 서비스 안내(서비스별 주의사항)와 교육생별 구글 계정 정보.
// 모든 서비스에 같은 구글 계정으로 로그인하는 구조라서, 계정은 서비스별이 아니라 교육생별로 하나씩 저장한다.
// 저장 위치: Storage app-data/ai-accounts.json
// 형태: { common: '공통 주의사항',
//        google: { mailUrl, shared: { loginId, password }, students: { [studentId]: { loginId, password, note } } },
//        tools: [{ id, name, url, purpose, cautions }] }
import { readJson, writeJson } from './appData';

const FILE = 'ai-accounts.json';

export function emptyConfig() {
  return { common: '', google: { mailUrl: '', shared: { loginId: '', password: '' }, students: {} }, tools: [] };
}

export async function getAiConfig() {
  const cfg = await readJson(FILE);
  if (!cfg || !Array.isArray(cfg.tools)) return emptyConfig();
  const base = emptyConfig();
  return { ...base, ...cfg, google: { ...base.google, ...(cfg.google || {}) } };
}

export async function saveAiConfig(cfg) {
  await writeJson(FILE, cfg);
}

const str = (v, max) => String(v ?? '').slice(0, max);

// 관리자 화면에서 받은 값을 안전한 형태로 정리 (길이 제한, 알 수 없는 항목 제거)
export function sanitizeConfig(input) {
  const out = emptyConfig();
  out.common = str(input?.common, 3000);
  let mailUrl = str(input?.google?.mailUrl, 300).trim();
  if (mailUrl && !/^https?:\/\//i.test(mailUrl)) mailUrl = 'https://' + mailUrl;
  out.google.mailUrl = mailUrl;
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
    out.tools.push({ id, name: str(t?.name, 60).trim(), url, purpose: str(t?.purpose, 200).trim(), cautions: str(t?.cautions, 3000) });
  }
  return out;
}

// 교육생 한 명에게 보여줄 내용만 골라낸다 (다른 교육생의 계정은 절대 포함하지 않음)
export function viewFor(cfg, studentId) {
  const own = cfg.google?.students?.[studentId];
  const shared = cfg.google?.shared;
  // note(이용 기간·메모)는 관리자용이라 교육생에게 내려보내지 않는다
  const google = own && (own.loginId || own.password) ? { loginId: own.loginId, password: own.password, kind: 'own' }
    : shared && (shared.loginId || shared.password) ? { loginId: shared.loginId, password: shared.password, kind: 'shared' } : null;
  const tools = cfg.tools.map((t) => ({ id: t.id, name: t.name, url: t.url, purpose: t.purpose, cautions: t.cautions }));
  return { common: cfg.common, google, mailUrl: cfg.google?.mailUrl || '', tools, hasGoogleSection: Boolean(google) || Object.keys(cfg.google?.students || {}).length > 0 };
}
