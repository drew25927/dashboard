import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSettings } from '../../../lib/settings';

export const dynamic = 'force-dynamic';

export default async function ContentPage({ params, searchParams }) {
  const { key } = await params;
  const sp = await searchParams;
  const studentId = sp?.id;

  const db = supabaseAdmin();
  const [{ data: link }, settings] = await Promise.all([
    db.from('links').select('*').eq('key', key).maybeSingle(),
    getSettings()
  ]);

  if (!link) {
    return (
      <div className="page">
        <div className="state"><h2>페이지를 찾을 수 없습니다</h2></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <span className="badge-mode">안내</span>
        {studentId && <a href={'/id=' + studentId}>← 내 출결 현황으로</a>}
      </div>
      <div className="banner"><div><h1>{settings.courseTitle}</h1><div className="sub">{link.label}</div></div></div>
      <div className="panel">
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.8 }}>{link.content || '아직 작성된 내용이 없습니다.'}</div>
      </div>
    </div>
  );
}
