import { redirect } from 'next/navigation';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { getSettings } from '../../lib/settings';
import { getAuthorizedAdmin } from '../../lib/adminAuth';
import { getAuthorizedStudent } from '../../lib/studentAuth';
import { getAiConfig, viewFor, viewForStaff } from '../../lib/aiAccounts';
import { getMenuFlags } from '../../lib/menus';
import { SecretRow } from './AccountsClient';
import { COURSE_ID_RE, MAIN_COURSE } from '../../lib/courses';

export const dynamic = 'force-dynamic';

// **굵게** 로 감싼 부분은 빨간색 굵은 글씨로 강조해서 보여줌
function Emph({ text }) {
  return String(text).split('**').map((part, i) => (i % 2 === 1 ? <strong key={i} style={{ color: 'var(--danger)' }}>{part}</strong> : <span key={i}>{part}</span>));
}

// 교육생은 로그인한 본인에게 배정된 계정만 볼 수 있음. 관리자는 ?id= 로 교육생 화면을 미리보기.
export default async function AiAccountsPage({ searchParams }) {
  const sp = await searchParams;
  const [admin, student] = await Promise.all([getAuthorizedAdmin(), getAuthorizedStudent()]);

  const canOpen = (cid) => admin && (admin.id === 'master' || (admin.course_ids || []).includes(cid));
  let target = student;
  let preview = false;
  if (!target && admin && sp?.id) {
    const { data } = await supabaseAdmin().from('students').select('id,name,course_id').eq('id', sp.id).maybeSingle();
    target = data && canOpen(data.course_id) ? data : null; // 담당 교육의 교육생만 미리보기
    preview = true;
  }
  // 관리자(강사)가 ?id= 없이 열면 운영진 계정 화면 (?course= 로 교육 지정)
  const staffMode = !target && Boolean(admin) && !sp?.id;
  if (!target && !staffMode) redirect(admin ? '/admin' : '/login');

  const staffCourse = COURSE_ID_RE.test(sp?.course || '') && canOpen(sp.course) ? sp.course : (admin?.id === 'master' ? MAIN_COURSE : (admin?.course_ids || [])[0] || MAIN_COURSE);
  const courseId = staffMode ? staffCourse : target.course_id;
  const [cfg, settings, menus] = await Promise.all([getAiConfig(courseId), getSettings(courseId), getMenuFlags(courseId)]);
  // 생성형 AI를 제공하지 않는 교육은 이 화면을 열지 않는다
  if (menus.hideAi) redirect(admin && !student ? '/admin' : '/');
  const view = staffMode ? viewForStaff(cfg, admin.name) : viewFor(cfg, target.id);
  const empty = !view.common && view.tools.length === 0 && !view.hasGoogleSection && !view.guide && !view.help && !(view.staff && view.staff.length);

  return (
    <div className="page">
      <div className="topbar">
        <span className="badge-mode">생성형 AI 계정</span>
        <a href={staffMode ? '/admin' : preview ? '/?id=' + target.id : '/'}>{staffMode ? '← 관리자 화면' : '← Home'}</a>
      </div>
      <div className="banner">
        <div>
          <h1>{settings.courseTitle}</h1>
          <div className="sub">{staffMode ? '운영진(관리자·강사) 생성형 AI 계정' : target.name + '님의 생성형 AI 계정' + (preview ? ' (관리자 미리보기)' : '')}</div>
        </div>
      </div>

      {empty && <div className="panel"><div className="empty">아직 등록된 안내가 없습니다.</div></div>}

      {view.common && (
        <div className="notice-box" style={{ marginBottom: 16 }}>
          <b>공통 안내</b>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{view.common}</div>
        </div>
      )}

      {staffMode && (
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>운영진 구글 계정</h2>
          <div className="small-dim" style={{ marginBottom: 10 }}>관리자·강사용 계정입니다. 교육생에게는 보이지 않습니다. 아래 서비스에는 모두 이 구글 계정으로 로그인합니다.</div>
          {view.staff.length === 0 && <div className="empty">등록된 계정이 없습니다.</div>}
          {view.staff.map((s) => (
            <div key={s.id} className="acc-box">
              <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 13.5 }}>{s.name}{s.mine && <span className="badge-status ok" style={{ marginLeft: 8 }}>내 계정</span>}</div>
              <SecretRow label="아이디" value={s.loginId} />
              <SecretRow label="비밀번호" value={s.password} secret />
              {s.period && <div className="acc-row"><span className="acc-label">이용 기간</span><span className="acc-value">{s.period}</span></div>}
            </div>
          ))}
          {view.mailUrl && (
            <div style={{ marginTop: 10 }}>
              <a className="btn small" href={view.mailUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>로그인 코드 메일함 열기 →</a>
            </div>
          )}
        </div>
      )}

      {!staffMode && (view.google || view.hasGoogleSection) && (
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>구글 계정</h2>
          <div className="small-dim" style={{ marginBottom: 10 }}>아래 서비스에는 모두 이 구글 계정으로 로그인해서 사용합니다.</div>
          <div className="acc-box">
            {view.google ? (
              <>
                {view.google.kind === 'shared' && <div className="small-dim" style={{ marginBottom: 6 }}>모든 교육생이 함께 쓰는 공용 계정입니다.</div>}
                <SecretRow label="아이디" value={view.google.loginId} />
                <SecretRow label="비밀번호" value={view.google.password} secret />
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

      {view.guide && (
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>생성형 AI 계정 사용 방법</h2>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.9 }}><Emph text={view.guide} /></div>
        </div>
      )}

      {view.help && (
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>구글 로그인 인증 시 해결 방법</h2>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.9 }}><Emph text={view.help} /></div>
        </div>
      )}

      {view.tools.map((t) => (
        <div className="panel" key={t.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>{t.name || '(이름 없음)'}</h2>
            {t.url && <a className="btn small" href={t.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>열기 →</a>}
          </div>
          {t.purpose && <div className="small-dim" style={{ marginBottom: 10 }}>{t.purpose}</div>}
          {t.loginHow
            ? <div style={{ marginBottom: 10, fontSize: 13 }}><b>로그인 방법</b>: {t.loginHow}</div>
            : (view.google || staffMode) && <div className="small-dim" style={{ marginBottom: 10 }}>로그인: 위의 구글 계정으로 <b>Google로 계속하기</b>를 선택하세요.</div>}

          {(t.cautions || view.period) && (
            <div className="acc-caution">
              <b>⚠ 주의사항</b>
              {view.period && <div style={{ marginTop: 4 }}><strong>이용 기간: {view.period}</strong></div>}
              {t.cautions && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Emph text={t.cautions} /></div>}
            </div>
          )}
        </div>
      ))}

      <div className="small-dim" style={{ textAlign: 'center' }}>{staffMode ? '운영진 계정 정보입니다. 교육생에게 알려주거나 캡처해서 공유하지 마세요.' : '계정 정보는 본인만 볼 수 있습니다. 다른 사람에게 알려주거나 캡처해서 공유하지 마세요.'}</div>
    </div>
  );
}
