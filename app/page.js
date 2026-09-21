import { supabaseAdmin } from '../lib/supabaseAdmin';
import { computeStats, isDone, STATUS_LABEL } from '../lib/calc';
import { COURSE_TITLE, COURSE_SUB, LINKS } from '../lib/config';

export const dynamic = 'force-dynamic';

function h(x) {
  return Math.round((x || 0) * 10) / 10 + 'h';
}
function pct(x) {
  return Math.round((x || 0) * 100) + '%';
}

async function getStudentData(id) {
  const db = supabaseAdmin();
  const [{ data: student }, { data: sessions }, { data: attendanceRows }] = await Promise.all([
    db.from('students').select('*').eq('id', id).maybeSingle(),
    db.from('sessions').select('*').order('n'),
    db.from('attendance').select('*').eq('student_id', id)
  ]);

  if (!student) return null;

  const stats = computeStats(sessions || [], attendanceRows || []);
  const bySession = new Map((attendanceRows || []).map((a) => [a.session_n, a]));

  const rows = (sessions || []).map((s) => {
    const a = bySession.get(s.n);
    return {
      n: s.n,
      date: s.date,
      type: s.type,
      done: isDone(s),
      status: a ? a.status : '',
      recognizedHours: a ? a.recognized_hours : 0
    };
  });

  return { student, stats, rows };
}

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.getMonth() + 1 + '.' + dt.getDate();
}

export default async function StudentPage({ searchParams }) {
  const sp = await searchParams;
  const id = sp?.id;

  if (!id) {
    return (
      <div className="page">
        <div className="state">
          <h2>개인 링크로 접속해주세요</h2>
          <p>문자 또는 이메일로 받은 링크의 주소 끝에 본인 고유ID가 포함되어 있습니다.</p>
        </div>
      </div>
    );
  }

  const data = await getStudentData(id);

  if (!data) {
    return (
      <div className="page">
        <div className="state">
          <h2>고유ID를 찾을 수 없습니다</h2>
          <p>
            <span className="mono">{id}</span> — 링크를 다시 확인해주세요. 문제가 계속되면 운영사무국에 문의해주세요.
          </p>
        </div>
      </div>
    );
  }

  const { student, stats, rows } = data;
  const lb = STATUS_LABEL[stats.status];

  return (
    <div className="page">
      <div className="banner">
        <div>
          <h1>{COURSE_TITLE} 출결 현황판</h1>
          <div className="sub">{COURSE_SUB}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="lbl">이름</div>
          <div className="val">{student.name || '(미입력)'}</div>
        </div>
        <div className="card">
          <div className="lbl">고유ID</div>
          <div className="val">{student.id}</div>
        </div>
      </div>

      <div className="buttons">
        <a className="btn-tile" href={LINKS.zoom}>온라인 강의실<br />입장(Zoom)</a>
        <a className="btn-tile" href={LINKS.venue}>오프라인 장소<br />안내</a>
        <a className="btn-tile alt" href={LINKS.office}>운영사무국<br />문의</a>
        <a className="btn-tile alt" href={LINKS.submit}>결과물 제출<br />안내</a>
        <a className="btn-tile warn" href={LINKS.notice}>공지사항 ·<br />자료실</a>
        <a className="btn-tile alt" href={LINKS.replay}>강의 다시보기<br />(녹화본)</a>
      </div>

      <div className="qr-row">
        <div className="qr">
          <div className="box" />
          <div className="cap">출석체크 QR<br />회차마다 갱신</div>
        </div>
        <div className="qr">
          <div className="box" />
          <div className="cap">결과물 제출 QR<br />클릭 시 폼 이동</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lbl">진행 회차</div>
          <div className="val">{stats.doneCount} / {stats.totalSessions}</div>
        </div>
        <div className="stat">
          <div className="lbl">개인 출석</div>
          <div className="val">{stats.attendedCount} / {stats.totalSessions}</div>
        </div>
        <div className="stat">
          <div className="lbl">현재 출석률</div>
          <div className="val">{pct(stats.attendanceRate)}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="lbl">누적 인정시간</div>
          <div className="val">{h(stats.recognizedHours)} / {h(stats.completionHours)}</div>
          <span className={'badge-status ' + lb.cls}>{lb.icon} {lb.text}</span>
        </div>
        <div className="card">
          <div className="lbl">수료까지 남은시간</div>
          <div className="val">{h(stats.stillNeeded)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>결석 허용 여유 {h(stats.slack)}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>회차</th><th>일자</th><th>구분</th><th>출석</th><th>인정</th></tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              !r.done ? (
                <tr className="future" key={r.n}>
                  <td>{r.n}</td><td>{fmtDate(r.date)}</td><td>{r.type}</td><td>-</td><td>-</td>
                </tr>
              ) : (
                <tr key={r.n}>
                  <td>{r.n}</td><td>{fmtDate(r.date)}</td><td>{r.type}</td>
                  <td className={r.status === '출석' ? 'att-ok' : 'att-no'}>{r.status || '미입력'}</td>
                  <td>{h(r.recognizedHours)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="foot">데이터 마지막 업데이트: {new Date().toLocaleString('ko-KR')}</div>
    </div>
  );
}
