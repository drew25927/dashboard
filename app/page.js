import { supabaseAdmin } from '../lib/supabaseAdmin';
import { computeStats, isDone, STATUS_LABEL } from '../lib/calc';
import { COURSE_TITLE, COURSE_SUB } from '../lib/config';

export const dynamic = 'force-dynamic';

const BUTTON_ORDER = ['zoom', 'venue', 'office', 'submit', 'notice', 'replay'];
const BUTTON_STYLE = { zoom: '', venue: '', office: 'alt', submit: 'alt', notice: 'warn', replay: 'alt' };

function h(x) {
  return Math.round((x || 0) * 10) / 10 + 'h';
}
function pct(x) {
  return Math.round((x || 0) * 100) + '%';
}

async function getStudentData(id) {
  const db = supabaseAdmin();
  const [{ data: student }, { data: sessions }, { data: attendanceRows }, { data: links }, { data: qrCodes }, { data: noticeRow }] = await Promise.all([
    db.from('students').select('*').eq('id', id).maybeSingle(),
    db.from('sessions').select('*').order('n'),
    db.from('attendance').select('*').eq('student_id', id),
    db.from('links').select('*'),
    db.from('qr_codes').select('*'),
    db.from('notice').select('*').eq('id', 'main').maybeSingle()
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

  const linksByKey = new Map((links || []).map((l) => [l.key, l]));
  const sortedLinks = BUTTON_ORDER.map((key) => linksByKey.get(key)).filter(Boolean);

  return { student, stats, rows, links: sortedLinks, qrCodes: qrCodes || [], notice: noticeRow?.content || '' };
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

  const { student, stats, rows, links, qrCodes, notice } = data;
  const qrByKey = new Map(qrCodes.map((q) => [q.key, q]));
  const attendanceQr = qrByKey.get('attendance');
  const submitQr = qrByKey.get('submit');
  const lb = STATUS_LABEL[stats.status];

  return (
    <div className="page split-page">
      <div className="banner">
        <div>
          <h1>{COURSE_TITLE} 출결 현황판</h1>
          <div className="sub">{COURSE_SUB}</div>
        </div>
      </div>

      <div className="split">
        <div className="split-col">
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

          {notice && (
            <div className="notice-box">{notice}</div>
          )}

          <div className="buttons">
            {links.map((l) => {
              const href = l.type === 'board' ? '/board?id=' + student.id
                : l.type === 'page' ? '/page/' + l.key + '?id=' + student.id
                : l.url;
              return (
                <a key={l.key} className={'btn-tile' + (BUTTON_STYLE[l.key] ? ' ' + BUTTON_STYLE[l.key] : '')} href={href}>{l.label}</a>
              );
            })}
          </div>

          <div className="qr-row">
            <div className="qr">
              {attendanceQr?.image_url
                ? <img src={attendanceQr.image_url} alt="출석체크 QR" style={{ width: 60, height: 60, objectFit: 'contain', margin: '0 auto 6px' }} />
                : <div className="box" />}
              <div className="cap">출석체크 QR<br />회차마다 갱신</div>
            </div>
            <div className="qr">
              {submitQr?.image_url
                ? <img src={submitQr.image_url} alt="만족도 조사 QR" style={{ width: 60, height: 60, objectFit: 'contain', margin: '0 auto 6px' }} />
                : <div className="box" />}
              <div className="cap">만족도 조사 QR<br />회차 종료 후 제출</div>
            </div>
          </div>
        </div>

        <div className="split-col">
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

          <div className="table-wrap tall">
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
      </div>
    </div>
  );
}
