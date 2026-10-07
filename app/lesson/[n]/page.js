import { redirect } from 'next/navigation';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSettings } from '../../../lib/settings';
import { getAuthorizedAdmin } from '../../../lib/adminAuth';
import { getAuthorizedStudent } from '../../../lib/studentAuth';
import { fmtKoreanDate, isLessonOpen, lessonOpenDate, lessonTimeRange, parseDetail } from '../../../lib/lesson';

export const dynamic = 'force-dynamic';

// 수업 하루 전 0시(한국 시간)부터 교육생에게 공개. 관리자는 미리보기로 언제든 열람 가능.
export default async function LessonPage({ params }) {
  const { n } = await params;
  const num = Number(n);

  const [admin, student] = await Promise.all([getAuthorizedAdmin(), getAuthorizedStudent()]);
  if (!admin && !student) redirect('/login');

  const db = supabaseAdmin();
  const [{ data: session }, settings] = await Promise.all([
    Number.isInteger(num) ? db.from('sessions').select('*').eq('n', num).maybeSingle() : Promise.resolve({ data: null }),
    getSettings()
  ]);

  const shell = (children) => (
    <div className="page">
      <div className="topbar">
        <span className="badge-mode">수업 안내</span>
        <a href="/">← Home</a>
      </div>
      {children}
    </div>
  );

  if (!session) {
    return shell(<div className="state"><h2>수업을 찾을 수 없습니다</h2></div>);
  }

  const open = Boolean(admin) || isLessonOpen(session.date);
  const banner = (sub) => (
    <div className="banner"><div><h1>{settings.courseTitle}</h1><div className="sub">{sub}</div></div></div>
  );

  if (!open) {
    return shell(
      <>
        {banner(`${session.n}회차 · ${fmtKoreanDate(session.date)} ${session.type}`)}
        <div className="panel">
          <div className="empty">
            이 수업의 세부 내용은 수업 하루 전({fmtKoreanDate(lessonOpenDate(session.date))})부터 확인하실 수 있습니다.
          </div>
        </div>
      </>
    );
  }

  const sections = parseDetail(session.detail);
  const time = lessonTimeRange(session.detail || '');

  return shell(
    <>
      {banner(`${session.n}회차 · ${fmtKoreanDate(session.date)} ${session.type}${time ? ' ' + time : ''}`)}
      {admin && !student && <div className="small-dim" style={{ marginBottom: 10 }}>관리자 미리보기 — 교육생에게는 수업 하루 전({fmtKoreanDate(lessonOpenDate(session.date))})부터 공개됩니다.</div>}

      <div className="panel">
        <h2>{session.topic}</h2>
        {!sections.length && <div className="empty">아직 등록된 세부 내용이 없습니다.</div>}

        {sections.map((sec, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 4 : 18 }}>
            {sec.title && <h3 style={{ fontSize: 13, color: 'var(--accent-ink)', marginBottom: 6 }}>{sec.title}</h3>}
            {sec.paragraphs.map((p, j) => (
              <div key={j} style={{ fontSize: 13.5, lineHeight: 1.8, overflowWrap: 'anywhere', marginBottom: 2 }}>{p}</div>
            ))}
            {sec.rows.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: 'none', marginBottom: 0 }}>
                <table className="lesson-table">
                  <colgroup><col className="c-time" /><col /><col className="c-method" /></colgroup>
                  <thead><tr><th>시간</th><th>세부 내용</th><th>방식</th></tr></thead>
                  <tbody>
                    {sec.rows.map((r, k) => {
                      const rest = r.method === '휴식';
                      return (
                        <tr key={k} style={rest ? { color: 'var(--text-dim)' } : undefined}>
                          <td className="mono c-time-cell">{r.start}~{r.end}</td>
                          <td>{r.items.map((t, m) => <div key={m}>{t}</div>)}</td>
                          <td>{r.method}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {sections.length > 0 && (
          <div className="small-dim" style={{ marginTop: 16 }}>
            ※ 과제 내용·분량·제출 일정은 수업 및 개인별 제작 진행 상황에 따라 변경될 수 있습니다.
          </div>
        )}
      </div>
    </>
  );
}
