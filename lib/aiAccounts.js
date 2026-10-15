// 생성형 AI 서비스 안내(서비스별 주의사항)와 교육생별 계정 정보.
// 저장 위치: Storage app-data/ai-accounts.json
// 형태: { common: '공통 주의사항', tools: [{ id, name, url, purpose, cautions, shared: { loginId, password } }],
//        accounts: { [toolId]: { [studentId]: { loginId, password } } } }
import { readJson, writeJson } from './appData';

const FILE = 'ai-accounts.json';

export function emptyConfig() {
  return { common: '', tools: [], accounts: {} };
}

export async function getAiConfig() {
  const cfg = await readJson(FILE);
  return cfg && Array.isArray(cfg.tools) ? { ...emptyConfig(), ...cfg } : emptyConfig();
}

export async function saveAiConfig(cfg) {
  await writeJson(FILE, cfg);
}

const str = (v, max) => String(v ?? '').slice(0, max);

// 관리자 화면에서 받은 값을 안전한 형태로 정리 (길이 제한, 알 수 없는 항목 제거)
export function sanitizeConfig(input) {
  const out = emptyConfig();
  out.common = str(input?.common, 3000);
  const seen = new Set();
  for (const t of (Array.isArray(input?.tools) ? input.tools : []).slice(0, 20)) {
    const id = str(t?.id, 40).replace(/[^A-Za-z0-9_-]/g, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let url = str(t?.url, 300).trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    out.tools.push({
      id,
      name: str(t?.name, 60).trim(),
      url,
      purpose: str(t?.purpose, 200).trim(),
      cautions: str(t?.cautions, 3000),
      shared: { loginId: str(t?.shared?.loginId, 200).trim(), password: str(t?.shared?.password, 200) }
    });
  }
  for (const toolId of seen) {
    const rows = input?.accounts?.[toolId];
    if (!rows || typeof rows !== 'object') continue;
    const clean = {};
    for (const [sid, a] of Object.entries(rows).slice(0, 500)) {
      const loginId = str(a?.loginId, 200).trim();
      const password = str(a?.password, 200);
      if (!loginId && !password) continue;
      clean[str(sid, 20)] = { loginId, password };
    }
    if (Object.keys(clean).length) out.accounts[toolId] = clean;
  }
  return out;
}

// 교육생 한 명에게 보여줄 내용만 골라낸다 (다른 교육생의 계정은 절대 포함하지 않음)
export function viewFor(cfg, studentId) {
  const tools = cfg.tools.map((t) => {
    const own = cfg.accounts?.[t.id]?.[studentId];
    const shared = t.shared && (t.shared.loginId || t.shared.password) ? t.shared : null;
    const account = own && (own.loginId || own.password) ? { ...own, kind: 'own' } : shared ? { ...shared, kind: 'shared' } : null;
    return { id: t.id, name: t.name, url: t.url, purpose: t.purpose, cautions: t.cautions, account };
  });
  return { common: cfg.common, tools };
}
