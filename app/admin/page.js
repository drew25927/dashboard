'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { computeStats, isDone, recognizedHoursFor, STATUS_LABEL } from '../../lib/calc';
import { COURSE_TITLE, COURSE_SUB } from '../../lib/config';

const STATUS_OPTIONS = ['출석', '결석', '지각', '조퇴'];

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.getMonth() + 1 + '.' + dt.getDate();
}
function h(x) { return Math.round((x || 0) * 10) / 10 + 'h'; }
function pct(x) { return Math.round((x || 0) * 100) + '%'; }

async function apiCall(url, options) {
  const res = await fetch(url, options);
  let json = null;
  try { json = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((json && json.error) || ('요청 실패 (' + res.status + ')'));
  }
  return json;
}

export default function AdminPage() {
  const [tab, setTab] = useState('attend');
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [studentPageUrl, setStudentPageUrl] = useState('');
  const router = useRouter();

  useEffect(() => {
    setStudentPageUrl(window.location.origin);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [sJson, stJson, aJson] = await Promise.all([
        apiCall('/api/admin/sessions'),
        apiCall('/api/admin/students'),
        apiCall('/api/admin/attendance')
      ]);
      setSessions((sJson.sessions || []).sort((a, b) => a.n - b.n));
      setStudents((stJson.students || []).sort((a, b) => Number(a.id) - Number(b.id)));
      setAttendance(aJson.attendance || []);
    } catch (err) {
      showToast('데이터 불러오기 실패: ' + err.message);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  if (loading) {
    return (
      <div className="page wide">
        <div className="state"><div className="spinner" /><p>불러오는 중…</p></div>
      </div>
    );
  }

  return (
    <div className="page wide">
      <div className="banner">
        <div>
          <h1>{COURSE_TITLE} — 관리자</h1>
          <div className="sub">{COURSE_SUB}</div>
        </div>
        <button className="btn ghost small" onClick={logout}>로그아웃</button>
      </div>

      <div className="hint">💡 여기서 저장하면 학생용 페이지에 <b>즉시 반영</b>됩니다 (별도 갱신 요청 필요 없음).</div>

      <div className="tabs">
        {[['attend', '출석체크'], ['students', '교육생 명단'], ['sessions', '회차 일정'], ['overview', '전체 현황']].map(([k, label]) => (
          <button key={k} className={'tab-btn' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'attend' && (
        <AttendPanel sessions={sessions} students={students} attendance={attendance} loadAll={loadAll} showToast={showToast} />
      )}
      {tab === 'students' && (
        <StudentsPanel students={students} loadAll={loadAll} showToast={showToast} />
      )}
      {tab === 'sessions' && (
        <SessionsPanel sessions={sessions} loadAll={loadAll} showToast={showToast} />
      )}
      {tab === 'overview' && (
        <OverviewPanel students={students} sessions={sessions} attendance={attendance} studentPageUrl={studentPageUrl} showToast={showToast} />
      )}

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}

function AttendPanel({ sessions, students, attendance, loadAll, showToast }) {
  const defaultSession = (() => {
    const past = sessions.filter(isDone);
    if (past.length) return past[past.length - 1].n;
    return sessions.length ? sessions[0].n : null;
  })();
  const [selected, setSelected] = useState(defaultSession);
  const [picks, setPicks] = useState({}); // studentId -> status (local unsaved state)
  const [saving, setSaving] = useState(false);

  if (!sessions.length) return <div className="panel"><div className="empty">회차 일정이 아직 없습니다.</div></div>;

  const session = sessions.find((s) => s.n === selected) || sessions[0];

  function statusFor(studentId) {
    if (picks[studentId] !== undefined) return picks[studentId];
    const a = attendance.find((x) => x.student_id === String(studentId) && x.session_n === session.n);
    return a ? a.status : '';
  }

  async function save() {
    setSaving(true);
    const rows = students.map((st) => ({
      studentId: st.id,
      sessionN: session.n,
      status: statusFor(st.id),
      recognizedHours: recognizedHoursFor(statusFor(st.id), session.hours)
    }));
    try {
      await apiCall('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      setPicks({});
      await loadAll();
      showToast('저장했습니다');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>회차별 출석체크</h2>
      <div className="row">
        <select value={selected} onChange={(e) => { setSelected(Number(e.target.value)); setPicks({}); }}>
          {sessions.map((s) => (
            <option key={s.n} value={s.n}>{s.n}회차 · {fmtDate(s.date)} ({s.type}, {s.hours}h) — {s.topic}</option>
          ))}
        </select>
        <span className="small-dim">{isDone(session) ? '진행됨' : '예정'}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>출석상태</th></tr></thead>
          <tbody>
            {students.length === 0 && (
              <tr><td colSpan={3} className="empty">교육생 명단이 비어있습니다. &quot;교육생 명단&quot; 탭에서 먼저 추가하세요.</td></tr>
            )}
            {students.map((st) => (
              <tr key={st.id}>
                <td>{st.id}</td>
                <td>{st.name || '(미입력)'}</td>
                <td>
                  <div className="status-pick">
                    {STATUS_OPTIONS.map((v) => (
                      <label key={v} className={statusFor(st.id) === v ? 'checked' : ''} onClick={() => setPicks((p) => ({ ...p, [st.id]: v }))}>
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {students.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      )}
    </div>
  );
}

function StudentsPanel({ students, loadAll, showToast }) {
  async function addStudent() {
    try {
      await apiCall('/api/admin/students', { method: 'POST' });
      await loadAll();
      showToast('학생을 추가했습니다');
    } catch (err) {
      showToast('추가 실패: ' + err.message);
    }
  }
  async function updateField(id, field, value) {
    try {
      await apiCall('/api/admin/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value })
      });
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    }
  }
  async function removeStudent(id) {
    if (!confirm('학생(ID ' + id + ')을 삭제할까요? 출결 기록도 함께 사라집니다.')) return;
    try {
      await apiCall('/api/admin/students?id=' + encodeURIComponent(id), { method: 'DELETE' });
      await loadAll();
      showToast('삭제했습니다');
    } catch (err) {
      showToast('삭제 실패: ' + err.message);
    }
  }

  return (
    <div className="panel">
      <h2>교육생 명단 ({students.length}명)</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>이메일</th><th></th></tr></thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={5} className="empty">교육생이 없습니다. 아래 버튼으로 추가하세요.</td></tr>}
            {students.map((st) => (
              <tr key={st.id}>
                <td className="mono">{st.id}</td>
                <td><input type="text" defaultValue={st.name} onBlur={(e) => updateField(st.id, 'name', e.target.value)} /></td>
                <td><input type="text" defaultValue={st.contact} onBlur={(e) => updateField(st.id, 'contact', e.target.value)} /></td>
                <td><input type="text" defaultValue={st.email} onBlur={(e) => updateField(st.id, 'email', e.target.value)} /></td>
                <td><button className="btn small danger" onClick={() => removeStudent(st.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={addStudent}>+ 학생 추가</button>
      </div>
    </div>
  );
}

function SessionsPanel({ sessions, loadAll, showToast }) {
  async function updateField(n, field, value) {
    try {
      await apiCall('/api/admin/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n, field, value })
      });
      await loadAll();
      showToast('저장됨');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    }
  }

  return (
    <div className="panel">
      <h2>회차 일정 (총 {sessions.reduce((s, x) => s + Number(x.hours), 0)}h)</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>회차</th><th>일자</th><th>구분</th><th>시간(h)</th><th>주제</th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.n}>
                <td className="mono">{s.n}</td>
                <td><input type="date" defaultValue={s.date} onBlur={(e) => updateField(s.n, 'date', e.target.value)} /></td>
                <td>
                  <select defaultValue={s.type} onChange={(e) => updateField(s.n, 'type', e.target.value)}>
                    <option>온라인</option>
                    <option>오프라인</option>
                  </select>
                </td>
                <td><input type="number" step="0.5" style={{ width: 60 }} defaultValue={s.hours} onBlur={(e) => updateField(s.n, 'hours', Number(e.target.value))} /></td>
                <td><input type="text" style={{ minWidth: 220 }} defaultValue={s.topic} onBlur={(e) => updateField(s.n, 'topic', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewPanel({ students, sessions, attendance, studentPageUrl, showToast }) {
  if (!students.length) return <div className="panel"><div className="empty">교육생이 없습니다.</div></div>;

  function copyLink(link) {
    navigator.clipboard?.writeText(link).then(() => showToast('링크를 복사했습니다')).catch(() => showToast(link));
  }

  return (
    <div className="panel">
      <h2>전체 현황</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>진행</th><th>출석</th><th>출석률</th><th>인정시간</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {students.map((st) => {
              const mine = attendance.filter((a) => a.student_id === String(st.id));
              const stat = computeStats(sessions, mine);
              const lb = STATUS_LABEL[stat.status];
              const link = studentPageUrl + '/?id=' + st.id;
              return (
                <tr key={st.id}>
                  <td className="mono">{st.id}</td>
                  <td>{st.name || <span className="small-dim">(이름 미입력)</span>}</td>
                  <td>{stat.doneCount}/{stat.totalSessions}</td>
                  <td>{stat.attendedCount}/{stat.doneCount}</td>
                  <td>{pct(stat.attendanceRate)}</td>
                  <td>{h(stat.recognizedHours)}/{h(stat.completionHours)}</td>
                  <td><span className={'badge-status ' + lb.cls}>{lb.icon} {lb.text}</span></td>
                  <td><button className="btn small ghost" onClick={() => copyLink(link)}>링크 복사</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
