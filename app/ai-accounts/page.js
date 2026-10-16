import { redirect } from 'next/navigation';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { getSettings } from '../../lib/settings';
import { getAuthorizedAdmin } from '../../lib/adminAuth';
import { getAuthorizedStudent } from '../../lib/studentAuth';
import { getAiConfig, viewFor } from '../../lib/aiAccounts';
import { SecretRow } from './AccountsClient';

export const dynamic = 'force-dynamic';

// 교육생은 로그인한 본인에게 배정된 계정만 볼 수 있음. 관리자는 ?id= 로 교육생 화면을 미리보기.
export default async function AiAccountsPage({ searchParams }) {
  const sp = await searchParams;
  const [admin, student] = await Promise.all([getAuthorizedAdmin(), getAuthorizedStudent()]);

  let target = student;
  let preview = false;
  if (!target && admin && sp?.id) {
    const { data } = await supabaseAdmin().from('students').select('id,name').eq('id', sp.id).maybeSingle();
    target = data;
    preview = true;
  }
  if (!target) redirect(admin ? '/admin' : '/login');

  const [cfg, settings] = await Promise.all([getAiConfig(), getSettings()]);
  const view = viewFor(cfg, target.id);
  const empty = !view.common && view.tools.length === 0 && !view.hasGoogleSection;

  return (
    <div className="page">
      <div className="topbar">
        <span className="badge-mode">생성형 AI 계정</span>
        <a href={preview ? '/?id=' + target.id : '/'}>← Home</a>
      </div>
      <div className="banner">
        <div>
          <h1>{settings.courseTitle}</h1>
          <div className="sub">{target.name}님의 생성형 AI 계정{preview ? ' (관리자 미리보기)' : ''}</div>
        </div>
      </div>

      {empty && <div className="panel"><div className="empty">아직 등록된 안내가 없습니다.</div></div>}

      {view.common && (
        <div className="notice-box" style={{ marginBottom: 16 }}>
          <b>공통 안내</b>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{view.common}</div>
        </div>
      )}

      {(view.google || view.hasGoogleSection) && (
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>구글 계정</h2>
          <div className="small-dim" style={{ marginBottom: 10 }}>아래 서비스에는 모두 이 구글 계정으로 로그인해서 사용합니다.</div>
          <div className="acc-box">
            {view.google ? (
              <>
                {view.google.kind === 'shared' && <div className="small-dim" style={{ marginBottom: 6 }}>모든 교육생이 함께 쓰는 공용 계정입니다.</div>}
                <SecretRow label="아이디" value={view.google.loginId} />
                <SecretRow label="비밀번호" value={view.google.password} secret />
                {view.google.note && <div className="acc-row"><span className="acc-label">이용 기간</span><span className="acc-value">{view.google.note}</span></div>}
              </>
            ) : (
              <div className="small-dim">아직 배정된 계정이 없습니다. 운영 담당자에게 문의해 주세요.</div>
            )}
          </div>
          {view.mailUrl && (
            <div style={{ marginTop: 10 }}>
              <a className="btn small" href={view.mailUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>로그인 코드 메일함 열기 →</a>
              <div className="small-dim" style={{ marginTop: 6 }}>로그인할 때 인증 코드가 필요하면 이 메일함에서 확인하세요. 메일함의 아이디·비밀번호는 위 구글 계정과 같습니다.</div>
            </div>
          )}
        </div>
      )}

      {view.tools.map((t) => (
        <div className="panel" key={t.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>{t.name || '(이름 없음)'}</h2>
            {t.url && <a className="btn small" href={t.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>열기 →</a>}
          </div>
          {t.purpose && <div className="small-dim" style={{ marginBottom: 10 }}>{t.purpose}</div>}
          {view.google && <div className="small-dim" style={{ marginBottom: 10 }}>로그인: 위의 구글 계정으로 <b>Google로 계속하기</b>를 선택하세요.</div>}

          {t.cautions && (
            <div className="acc-caution">
              <b>⚠ 주의사항</b>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t.cautions}</div>
            </div>
          )}
        </div>
      ))}

      <div className="small-dim" style={{ textAlign: 'center' }}>계정 정보는 본인만 볼 수 있습니다. 다른 사람에게 알려주거나 캡처해서 공유하지 마세요.</div>
    </div>
  );
}
