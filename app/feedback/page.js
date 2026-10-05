import { redirect } from 'next/navigation';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { getAuthorizedStudent } from '../../lib/studentAuth';
import { getSettings } from '../../lib/settings';
import { MarkSeen, ReplyForm } from './FeedbackClient';

export const dynamic = 'force-dynamic';

function fmt(d) {
  return new Date(d).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function FeedbackPage() {
  const student = await getAuthorizedStudent();
  if (!student) redirect('/login');

  const db = supabaseAdmin();
  const [{ data: rows }, { data: me }, settings] = await Promise.all([
    db.from('feedback').select('*').eq('student_id', student.id).order('created_at'),
    db.from('students').select('feedback_seen_at').eq('id', student.id).maybeSingle(),
    getSettings()
  ]);

  const seenAt = me?.feedback_seen_at ? new Date(me.feedback_seen_at).getTime() : 0;
  const items = rows || [];
  const isNew = (r) => r.author_role === 'admin' && new Date(r.created_at).getTime() > seenAt;
  const hasNew = items.some(isNew);
  // 지금 화면에 보여주는 마지막 관리자 글의 작성 시각 (DB 값 그대로) — 여기까지를 읽음 처리
  const latestAdminAt = [...items].reverse().find((r) => r.author_role === 'admin')?.created_at || null;

  return (
    <div className="page">
      <MarkSeen hasNew={hasNew} upTo={latestAdminAt} />
      <div className="topbar">
        <span className="badge-mode">과제 피드백</span>
        <a href="/">← Home</a>
      </div>
      <div className="banner">
        <div>
          <h1>{settings.courseTitle}</h1>
          <div className="sub">{student.name}님의 과제 피드백</div>
        </div>
      </div>

      <div className="panel">
        <h2>피드백 ({items.length}건)</h2>
        {items.length === 0 && <div className="empty">아직 등록된 피드백이 없습니다. 과제를 제출하면 이곳에서 피드백을 확인할 수 있습니다.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((r) => {
            const admin = r.author_role === 'admin';
            return (
              <div
                key={r.id}
                style={{
                  border: '1px solid var(--border)', borderLeft: '3px solid ' + (admin ? 'var(--accent)' : 'var(--text-dim)'),
                  borderRadius: 8, padding: '10px 12px', background: admin ? 'var(--accent-dim)' : 'var(--surface)'
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{admin ? '관리자' : '나'}</b>
                  {r.title && <span className="badge-status ok">{r.title}</span>}
                  {isNew(r) && <span className="new-tag">NEW</span>}
                  <span className="small-dim">{fmt(r.created_at)}</span>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>답글 남기기</h2>
        <ReplyForm />
      </div>
    </div>
  );
}
