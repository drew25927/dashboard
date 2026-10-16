'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { computeStats, isDone, recognizedHoursFor, STATUS_LABEL } from '../../lib/calc';
import { DEFAULT_COURSE_TITLE, DEFAULT_COURSE_SUB } from '../../lib/config';
import { kstToday } from '../../lib/lesson';
import { hasAssignment } from '../../lib/assignments';

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
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [studentPageUrl, setStudentPageUrl] = useState('');
  const [settings, setSettings] = useState({ courseTitle: DEFAULT_COURSE_TITLE, courseSub: DEFAULT_COURSE_SUB });
  const [pendingQ, setPendingQ] = useState(0);
  const [qAlert, setQAlert] = useState('');
  const [notifPerm, setNotifPerm] = useState('unsupported');
  const lastPendingRef = useRef(null);
  const baseTitleRef = useRef('');
  const router = useRouter();

  const loadSettings = useCallback(() => {
    apiCall('/api/admin/settings')
      .then((j) => setSettings({ courseTitle: j.courseTitle || DEFAULT_COURSE_TITLE, courseSub: j.courseSub || DEFAULT_COURSE_SUB }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setStudentPageUrl(window.location.origin);
    fetch('/api/admin/me').then((r) => r.json()).then((j) => setMe(j.admin)).catch(() => {});
    loadSettings();
  }, [loadSettings]);

  // 답변 대기 중인 학생 질문 수를 30초마다 확인해서, 새 질문이 오면 알림을 띄웁니다.
  useEffect(() => {
    baseTitleRef.current = document.title;
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
    let stop = false;
    async function check() {
      try {
        const j = await apiCall('/api/admin/questions');
        if (stop) return;
        const n = (j.questions || []).filter((q) => !q.is_faq && !(q.answer || '').trim()).length;
        setPendingQ(n);
        const prev = lastPendingRef.current;
        if (prev === null) {
          if (n > 0) setQAlert('답변을 기다리는 질문이 ' + n + '건 있습니다');
        } else if (n > prev) {
          const msg = '새 질문이 ' + (n - prev) + '건 등록되었습니다';
          setQAlert(msg);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification('질문 게시판', { body: msg }); } catch (e) { /* 알림 실패는 무시 */ }
          }
        }
        lastPendingRef.current = n;
      } catch (e) { /* 일시적 오류는 다음 확인 때 다시 시도 */ }
    }
    check();
    const id = setInterval(check, 30000);
    window.addEventListener('questions-changed', check);
    return () => { stop = true; clearInterval(id); window.removeEventListener('questions-changed', check); };
  }, []);

  useEffect(() => {
    if (!baseTitleRef.current) return;
    document.title = (pendingQ > 0 ? '(' + pendingQ + ') ' : '') + baseTitleRef.current;
  }, [pendingQ]);

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
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="page wide">
        <div className="state"><div className="spinner" /><p>불러오는 중…</p></div>
      </div>
    );
  }

  const isMaster = me?.id === 'master';

  return (
    <div className="page wide">
      <div className="banner">
        <div>
          <h1>{settings.courseTitle} — 관리자</h1>
          <div className="sub">{settings.courseSub}{me ? ' · ' + me.name + '님' : ''}</div>
        </div>
        <button className="btn ghost small" onClick={logout}>로그아웃</button>
      </div>

      {qAlert && (
        <div className="q-alert" role="alert">
          <span>🔔 {qAlert}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn small" onClick={() => { setTab('questions'); setQAlert(''); }}>확인하기</button>
            <button className="btn small ghost" onClick={() => setQAlert('')}>닫기</button>
          </span>
        </div>
      )}

      <div className="hint">
        💡 여기서 저장하면 학생용 페이지에 <b>즉시 반영</b>됩니다 (별도 갱신 요청 필요 없음).
        {notifPerm === 'default' && (
          <> <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={() => Notification.requestPermission().then(setNotifPerm)}>🔔 새 질문 브라우저 알림 켜기</button></>
        )}
      </div>

      <div className="tabs">
        {[
          ['attend', '출석체크'], ['students', '교육생 명단'], ['sessions', '회차 일정'], ['course', '과정 정보'],
          ['notice', '공지사항'], ['links', '링크 설정'], ['questions', '질문 게시판'], ['submissions', '과제 제출 현황'], ['feedback', '과제 피드백'], ['aiaccounts', '생성형 AI 계정'],
          ...(isMaster ? [['admins', '관리자 계정']] : []),
          ['overview', '전체 현황']
        ].map(([k, label]) => (
          <button key={k} className={'tab-btn' + (tab === k ? ' active' : '')} onClick={() => { setTab(k); if (k === 'questions') setQAlert(''); }}>
            {label}
            {k === 'questions' && pendingQ > 0 && <span className="new-count">{pendingQ}</span>}
          </button>
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
      {tab === 'course' && (
        <CoursePanel settings={settings} loadSettings={loadSettings} showToast={showToast} />
      )}
      {tab === 'notice' && (
        <NoticePanel showToast={showToast} />
      )}
      {tab === 'links' && (
        <>
          <LinksPanel showToast={showToast} />
          <QrPanel showToast={showToast} />
        </>
      )}
      {tab === 'questions' && (
        <QuestionsPanel showToast={showToast} />
      )}
      {tab === 'submissions' && (
        <SubmissionsPanel students={students} sessions={sessions} showToast={showToast} />
      )}
      {tab === 'aiaccounts' && (
        <AiAccountsPanel students={students} showToast={showToast} />
      )}
      {tab === 'feedback' && (
        <FeedbackPanel students={students} showToast={showToast} />
      )}
      {tab === 'admins' && isMaster && (
        <AdminsPanel me={me} showToast={showToast} />
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
  const [pwDrafts, setPwDrafts] = useState({});
  async function setPassword(id) {
    const value = pwDrafts[id];
    if (!value || value.length < 4) { showToast('비밀번호는 4자 이상 입력해주세요'); return; }
    try {
      await apiCall('/api/admin/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field: 'password', value })
      });
      setPwDrafts((d) => ({ ...d, [id]: '' }));
      await loadAll();
      showToast('비밀번호를 설정했습니다');
    } catch (err) {
      showToast('설정 실패: ' + err.message);
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
      <p className="small-dim" style={{ marginBottom: 12 }}>교육생은 <b>이름 + 비밀번호</b>로 로그인합니다. 이름이 같은 교육생이 있으면 로그인이 안 되니 겹치지 않게 입력해주세요.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>이메일</th><th>비밀번호</th><th></th></tr></thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={6} className="empty">교육생이 없습니다. 아래 버튼으로 추가하세요.</td></tr>}
            {students.map((st) => (
              <tr key={st.id}>
                <td className="mono">{st.id}</td>
                <td><input type="text" defaultValue={st.name} onBlur={(e) => updateField(st.id, 'name', e.target.value)} /></td>
                <td><input type="text" defaultValue={st.contact} onBlur={(e) => updateField(st.id, 'contact', e.target.value)} /></td>
                <td><input type="text" defaultValue={st.email} onBlur={(e) => updateField(st.id, 'email', e.target.value)} /></td>
                <td>
                  <div className="row" style={{ marginBottom: 0, flexWrap: 'nowrap' }}>
                    <span className={'badge-status ' + (st.hasPassword ? 'ok' : 'warn')} style={{ flexShrink: 0 }}>{st.hasPassword ? '설정됨' : '미설정'}</span>
                    <input
                      type="text" placeholder="새 비밀번호" style={{ width: 100 }}
                      value={pwDrafts[st.id] || ''}
                      onChange={(e) => setPwDrafts((d) => ({ ...d, [st.id]: e.target.value }))}
                    />
                    <button className="btn small ghost" onClick={() => setPassword(st.id)}>설정</button>
                  </div>
                </td>
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
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  function openEditor(s) {
    setEditing(s.n);
    setDraft(s.detail || '');
  }

  async function saveDetail() {
    setSavingDetail(true);
    try {
      await apiCall('/api/admin/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: editing, field: 'detail', value: draft })
      });
      await loadAll();
      showToast('세부 내용을 저장했습니다');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    } finally {
      setSavingDetail(false);
    }
  }

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
          <thead><tr><th>회차</th><th>일자</th><th>구분</th><th>시간(h)</th><th>주제</th><th>세부 내용</th></tr></thead>
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className={'btn small ' + (editing === s.n ? '' : 'ghost')} onClick={() => openEditor(s)}>{s.detail ? '보기·수정' : '작성'}</button>
                  {s.detail && <a className="small-dim" style={{ marginLeft: 8 }} href={'/lesson/' + s.n} target="_blank" rel="noreferrer">미리보기</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing != null && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 14, marginBottom: 6 }}>{editing}회차 세부 내용</h2>
          <p className="small-dim" style={{ marginBottom: 8 }}>
            교육생에게는 수업 하루 전 0시(한국 시간)부터 공개됩니다. 형식: <b>## 제목</b> 줄 아래에 내용을 쓰고, 시간표는 한 줄에 <span className="mono">시작~끝 | 내용</span> 으로 적습니다(내용 안의 줄바꿈은 <span className="mono"> / </span>). 그 뒤에 <span className="mono">| 진행 방식</span>이 붙어 있어도 화면에는 표시하지 않습니다.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={22}
            style={{ width: '100%', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, lineHeight: 1.6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={saveDetail} disabled={savingDetail}>{savingDetail ? '저장 중…' : '저장'}</button>
            <button className="btn ghost" onClick={() => setEditing(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CoursePanel({ settings, loadSettings, showToast }) {
  const [title, setTitle] = useState(settings.courseTitle);
  const [sub, setSub] = useState(settings.courseSub);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTitle(settings.courseTitle); setSub(settings.courseSub); }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await apiCall('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseTitle: title, courseSub: sub })
      });
      loadSettings();
      showToast('저장했습니다');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>과정 정보</h2>
      <p className="small-dim" style={{ marginBottom: 12 }}>학생용 페이지·질문 게시판·설명 페이지 상단 배너에 표시되는 제목/부제입니다.</p>
      <div className="row"><label style={{ minWidth: 60 }} className="small-dim">제목</label><input type="text" style={{ flex: 1, minWidth: 240 }} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="row"><label style={{ minWidth: 60 }} className="small-dim">부제</label><input type="text" style={{ flex: 1, minWidth: 240 }} value={sub} onChange={(e) => setSub(e.target.value)} /></div>
      <button className="btn" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
    </div>
  );
}

function NoticePanel({ showToast }) {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/notice')
      .then((j) => setContent(j.content || ''))
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await apiCall('/api/admin/notice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      showToast('저장했습니다');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <h2>공지사항</h2>
        <div className="empty">
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={load}>다시 시도</button></div>
        </div>
      </div>
    );
  }

  if (content === null) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  return (
    <div className="panel">
      <h2>공지사항</h2>
      <p className="small-dim" style={{ marginBottom: 12 }}>출석 인정 기준, 유의사항 등을 자유롭게 작성하세요. 학생용 페이지 좌측 상단에 그대로 표시됩니다(줄바꿈 유지).</p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        style={{
          width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
          borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
        }}
      />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}

function LinksPanel({ showToast }) {
  const [links, setLinks] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/links')
      .then((j) => setLinks(j.links || []))
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateField(key, field, value) {
    try {
      await apiCall('/api/admin/links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, field, value })
      });
      showToast('저장됨');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <h2>학생용 페이지 안내 버튼</h2>
        <div className="empty">
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={load}>다시 시도</button></div>
        </div>
      </div>
    );
  }

  if (!links) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  const TYPE_LABEL = { link: '외부 링크', page: '설명 페이지', board: '질문 게시판', feedback: '과제 피드백' };

  return (
    <div className="panel">
      <h2>학생용 페이지 안내 버튼</h2>
      <p className="small-dim" style={{ marginBottom: 12 }}>
        <b>외부 링크</b>: Zoom 등 바깥 사이트로 이동 · <b>설명 페이지</b>: 이 안에서 글을 써서 보여줌 · <b>질문 게시판</b>: 학생이 질문 남기고 관리자가 답변 (아래 &quot;질문 게시판&quot; 탭에서 답변)
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {links.map((l) => (
          <div key={l.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div className="row" style={{ marginBottom: l.type === 'link' || l.type === 'page' ? 10 : 0 }}>
              <span className="mono small-dim">{l.key}</span>
              <input type="text" style={{ minWidth: 200, flex: 1 }} defaultValue={l.label} onBlur={(e) => updateField(l.key, 'label', e.target.value)} />
              <select defaultValue={l.type} onChange={(e) => updateField(l.key, 'type', e.target.value)}>
                {Object.entries(TYPE_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            {l.type === 'link' && (
              <input type="text" placeholder="https://..." style={{ width: '100%' }} defaultValue={l.url} onBlur={(e) => updateField(l.key, 'url', e.target.value)} />
            )}
            {l.type === 'page' && (
              <>
                <textarea
                  defaultValue={l.content}
                  rows={5}
                  placeholder="학생에게 보여줄 안내 내용을 입력하세요"
                  onBlur={(e) => updateField(l.key, 'content', e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
                    borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', marginBottom: 8
                  }}
                />
                <input
                  type="text" placeholder="바로가기 링크 (선택, 예: 제출용 구글폼 URL)" style={{ width: '100%' }}
                  defaultValue={l.url === '#' ? '' : l.url}
                  onBlur={(e) => updateField(l.key, 'url', e.target.value || '#')}
                />
              </>
            )}
            {l.type === 'board' && (
              <p className="small-dim">질문·답변은 상단 &quot;질문 게시판&quot; 탭에서 관리합니다.</p>
            )}
            {l.type === 'feedback' && (
              <p className="small-dim">교육생이 로그인해서 본인 피드백을 보는 페이지로 연결됩니다. 피드백 작성은 상단 &quot;과제 피드백&quot; 탭에서 합니다.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QrPanel({ showToast }) {
  const [qrCodes, setQrCodes] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState({});

  const load = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/qrcodes')
      .then((j) => setQrCodes(j.qrCodes || []))
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(key, file) {
    if (!file) return;
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const form = new FormData();
      form.append('key', key);
      form.append('file', file);
      const res = await fetch('/api/admin/qrcodes', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '업로드 실패');
      showToast('이미지를 업로드했습니다');
      load();
    } catch (err) {
      showToast('업로드 실패: ' + err.message);
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  }

  async function saveLink(key, value) {
    try {
      await apiCall('/api/admin/qrcodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, linkUrl: value })
      });
      showToast('링크를 저장했습니다');
      load();
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <h2>QR 코드 이미지</h2>
        <div className="empty">
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={load}>다시 시도</button></div>
        </div>
      </div>
    );
  }

  if (!qrCodes) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  return (
    <div className="panel">
      <h2>QR 코드 이미지</h2>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        {qrCodes.map((q) => (
          <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{
              width: 120, height: 120, border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              {q.image_url
                ? <img src={q.image_url} alt={q.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span className="small-dim">이미지 없음</span>}
            </div>
            <div className="small-dim">{q.label}</div>
            <label className="btn small ghost" style={{ cursor: 'pointer' }}>
              {uploading[q.key] ? '업로드 중…' : (q.image_url ? '이미지 교체' : '이미지 업로드')}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={uploading[q.key]}
                onChange={(e) => upload(q.key, e.target.files?.[0])}
              />
            </label>
            <input
              key={q.key + ':' + (q.link_url || '')}
              type="text"
              placeholder="클릭 시 이동할 링크 (https://...)"
              defaultValue={q.link_url || ''}
              onBlur={(e) => { if ((e.target.value || '') !== (q.link_url || '')) saveLink(q.key, e.target.value); }}
              style={{ width: 200 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmissionsPanel({ students, sessions, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = kstToday();

  const load = useCallback((refresh) => {
    setLoading(true);
    apiCall('/api/admin/submissions' + (refresh ? '?refresh=1' : ''))
      .then((j) => setData(j))
      .catch((err) => setData({ ok: false, reason: 'error', error: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  const cols = sessions.filter((s) => hasAssignment(s.n));
  const norm = (s) => String(s || '').replace(/\s+/g, '');
  const driveByName = new Map((data?.students || []).map((d) => [norm(d.name), d]));
  const matchedNames = new Set(students.map((s) => norm(s.name)));
  const unmatched = (data?.students || []).filter((d) => !matchedNames.has(norm(d.name)));

  return (
    <div className="panel">
      <h2>과제 제출 현황</h2>
      <p className="small-dim" style={{ marginBottom: 10 }}>
        구글 드라이브 과제 폴더(교육생별 폴더 → 회차 폴더)를 하루 3번(오전 9시·오후 3시·저녁 7시) 자동으로 확인해, 회차 폴더 안(하위 폴더 포함)에 파일이 하나라도 있으면 제출로 표시합니다. 교육생 대시보드에도 본인 현황이 같은 방식으로 표시됩니다.
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn small" onClick={() => load(true)} disabled={loading}>{loading ? '확인 중…' : '지금 다시 확인'}</button>
        {data?.ok && <span className="small-dim">마지막 확인 {new Date(data.fetchedAt).toLocaleString('ko-KR')}{data.scanning ? ' · 지금 다시 확인하는 중…' : ''}</span>}
      </div>

      {data && !data.ok && (
        <div className="q-alert" role="alert" style={{ display: 'block' }}>
          {data.reason === 'pending'
            ? '처음 확인을 진행 중입니다. 잠시 뒤 [지금 다시 확인]을 눌러 주세요.'
            : '과제 폴더를 읽지 못했습니다: ' + data.error}
        </div>
      )}
      {data?.ok && data.error && (
        <div className="q-alert" role="alert" style={{ display: 'block' }}>
          가장 최근 확인이 실패해 직전 결과를 보여줍니다: {data.error}
        </div>
      )}

      {data?.ok && (
        <>
          <div className="table-wrap" style={{ maxHeight: 520 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>이름</th><th>제출</th>
                  {cols.map((s) => <th key={s.n} title={fmtDate(s.date)}>{s.n}회</th>)}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 && <tr><td colSpan={3 + cols.length} className="empty">교육생이 없습니다.</td></tr>}
                {students.map((st) => {
                  const d = driveByName.get(norm(st.name));
                  const due = cols.filter((s) => s.date <= today);
                  const done = d ? due.filter((s) => (d.sessions[s.n]?.count || 0) > 0).length : 0;
                  return (
                    <tr key={st.id}>
                      <td className="mono">{st.id}</td>
                      <td>{st.name || <span className="small-dim">(이름 미입력)</span>}</td>
                      <td>{d ? <span className={'badge-status ' + (done === due.length ? 'ok' : 'warn')}>{done}/{due.length}</span> : <span className="small-dim" title="드라이브에 이 이름의 폴더가 없습니다">폴더 없음</span>}</td>
                      {cols.map((s) => {
                        const info = d?.sessions[s.n];
                        const isDue = s.date <= today;
                        if (!d) return <td key={s.n} className="small-dim">-</td>;
                        if (info && info.count > 0) return <td key={s.n} className="att-ok" title={info.count + '개 파일'}>✓{info.count}</td>;
                        return <td key={s.n} className={isDue ? 'att-no' : 'small-dim'}>{isDue ? '미제출' : '-'}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small-dim" style={{ marginTop: 8 }}>✓숫자 = 제출된 파일 수 · "-" = 아직 해당 회차가 지나지 않음 · 16회차는 필수 과제가 없어 제외했습니다. 결과는 5분 동안 보관되며 [지금 다시 확인]으로 바로 갱신할 수 있습니다.</p>
          {unmatched.length > 0 && (
            <div className="small-dim" style={{ marginTop: 6 }}>
              ⚠ 명단과 이름이 맞지 않는 드라이브 폴더: {unmatched.map((u) => u.folder).join(', ')} (폴더 이름의 "번호_" 뒤 이름이 교육생 명단 이름과 같아야 합니다)
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AiAccountsPanel({ students, showToast }) {
  const [cfg, setCfg] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTool, setActiveTool] = useState('');
  const [paste, setPaste] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');

  useEffect(() => {
    apiCall('/api/admin/ai-accounts')
      .then((j) => { setCfg(j.config); setActiveTool(j.config.tools[0]?.id || ''); })
      .catch((err) => setLoadError(err.message));
  }, []);

  function update(fn) {
    setCfg((c) => { const next = JSON.parse(JSON.stringify(c)); fn(next); return next; });
    setDirty(true);
  }
  const newId = () => 't' + Math.random().toString(36).slice(2, 10);

  function addTool() {
    const id = newId();
    update((c) => { c.tools.push({ id, name: '', url: '', purpose: '', cautions: '' }); });
    setActiveTool(id);
  }
  function addDefaults() {
    const presets = [
      { name: 'Higgsfield', url: 'https://higgsfield.ai', purpose: '이미지·영상 생성 (센터 라이선스 제공)' },
      { name: 'Suno', url: 'https://suno.com', purpose: '음악 생성 (센터 라이선스 제공)' },
      { name: 'CapCut', url: 'https://www.capcut.com', purpose: '영상 편집·자막·색보정·믹싱 (센터 라이선스 제공)' }
    ];
    let first = '';
    update((c) => {
      for (const p of presets) {
        const id = newId();
        if (!first) first = id;
        c.tools.push({ id, name: p.name, url: p.url, purpose: p.purpose, cautions: '' });
      }
    });
    setActiveTool(first);
  }
  function removeTool(id) {
    if (!confirm('이 서비스를 삭제할까요?')) return;
    update((c) => { c.tools = c.tools.filter((t) => t.id !== id); });
    setActiveTool((cur) => (cur === id ? '' : cur));
  }
  function setToolField(id, field, value) {
    update((c) => { c.tools.find((x) => x.id === id)[field] = value; });
  }
  function setGoogle(studentId, field, value) {
    update((c) => {
      const a = c.google.students[studentId] || { loginId: '', password: '', note: '' };
      a[field] = value;
      c.google.students[studentId] = a;
    });
  }

  function applyPaste() {
    const norm = (s) => String(s || '').replace(/\s+/g, '');
    let ok = 0; const miss = [];
    update((c) => {
      for (const line of paste.split('\n')) {
        if (!line.trim()) continue;
        const cols = line.split(/\t|,/).map((x) => x.trim());
        const [key, loginId, password, note] = cols;
        const st = students.find((s) => s.id === key || norm(s.name) === norm(key));
        if (!st || (!loginId && !password)) { miss.push(key || '(빈 줄)'); continue; }
        c.google.students[st.id] = { loginId: loginId || '', password: password || '', note: note || '' };
        ok++;
      }
    });
    setPasteMsg(ok + '명 반영' + (miss.length ? ' · 찾지 못한 이름: ' + miss.join(', ') : '') + ' — 아래 [저장]을 눌러야 적용됩니다.');
    setPaste('');
  }

  async function save() {
    setSaving(true);
    try {
      const j = await apiCall('/api/admin/ai-accounts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg })
      });
      setCfg(j.config);
      setDirty(false);
      showToast('저장했습니다');
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <div className="panel"><h2>생성형 AI 계정</h2><div className="empty">불러오지 못했습니다: {loadError}</div></div>;
  if (!cfg) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  const taStyle = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
  };
  const tool = cfg.tools.find((t) => t.id === activeTool);

  return (
    <>
      <div className="panel">
        <h2>생성형 AI 계정 · 주의사항</h2>
        <p className="small-dim" style={{ marginBottom: 12 }}>
          교육생 대시보드에 <b>"생성형 AI 계정"</b> 버튼이 생기고, 교육생은 <b>본인 구글 계정</b>과 서비스별 주의사항을 볼 수 있습니다(비밀번호는 [보기]를 눌러야 보임, 다른 교육생 계정은 보이지 않음). 모든 서비스에 같은 구글 계정으로 로그인하는 구조라서 계정은 교육생당 하나만 입력합니다. 입력한 뒤 아래 <b>[저장]</b>을 눌러야 적용됩니다.
        </p>
        <label className="small-dim">공통 안내 · 주의사항 (맨 위에 표시)</label>
        <textarea rows={4} style={{ ...taStyle, marginTop: 6 }} maxLength={3000} placeholder="예) 계정은 본인만 사용하세요. 비밀번호를 바꾸거나 다른 사람과 공유하지 마세요." value={cfg.common} onChange={(e) => update((c) => { c.common = e.target.value; })} />
      </div>

      <div className="panel">
        <h2>구글 계정 (모든 서비스 공통)</h2>
        <label className="small-dim">로그인 코드 메일함 주소 (선택 — 교육생 화면에 [로그인 코드 메일함 열기] 버튼으로 표시)</label>
        <input type="text" style={{ width: '100%', margin: '6px 0 12px' }} placeholder="https://…" value={cfg.google.mailUrl || ''} onChange={(e) => update((c) => { c.google.mailUrl = e.target.value; })} />
        <label className="small-dim">공용 계정 (선택 — 교육생별 계정이 없는 사람에게 대신 보여줍니다)</label>
        <div className="row" style={{ marginTop: 6 }}>
          <input type="text" placeholder="공용 구글 아이디" autoComplete="off" value={cfg.google.shared.loginId} onChange={(e) => update((c) => { c.google.shared.loginId = e.target.value; })} />
          <input type="text" placeholder="공용 비밀번호" autoComplete="off" value={cfg.google.shared.password} onChange={(e) => update((c) => { c.google.shared.password = e.target.value; })} />
        </div>
        <p className="small-dim" style={{ margin: '10px 0 6px' }}>교육생별 계정 — 엑셀에서 복사해 붙여넣을 수 있습니다. 한 줄에 <b>이름(또는 ID) ↹ 아이디 ↹ 비밀번호 ↹ (선택) 이용 기간·메모</b> 형식입니다.</p>
        <textarea rows={3} style={taStyle} placeholder={'강영화\tkang@gmail.com\tpassword123'} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small ghost" onClick={applyPaste} disabled={!paste.trim()}>붙여넣은 내용 반영</button>
          {pasteMsg && <span className="small-dim">{pasteMsg}</span>}
        </div>
        <div className="table-wrap" style={{ maxHeight: 460, marginTop: 10 }}>
          <table>
            <thead><tr><th>ID</th><th>이름</th><th>구글 아이디</th><th>비밀번호</th><th>이용 기간 · 메모 (관리자 전용)</th></tr></thead>
            <tbody>
              {students.map((st) => {
                const a = cfg.google.students[st.id] || { loginId: '', password: '', note: '' };
                return (
                  <tr key={st.id}>
                    <td className="mono">{st.id}</td>
                    <td>{st.name || <span className="small-dim">(이름 미입력)</span>}</td>
                    <td><input type="text" style={{ minWidth: 200 }} autoComplete="off" value={a.loginId} onChange={(e) => setGoogle(st.id, 'loginId', e.target.value)} /></td>
                    <td><input type="text" style={{ minWidth: 150 }} autoComplete="off" value={a.password} onChange={(e) => setGoogle(st.id, 'password', e.target.value)} /></td>
                    <td><input type="text" style={{ minWidth: 190 }} placeholder="예) 2026.10.14 ~ 2026.12.13" value={a.note || ''} onChange={(e) => setGoogle(st.id, 'note', e.target.value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>서비스별 안내 · 주의사항</h2>
        {cfg.tools.length === 0 && (
          <div className="empty">
            등록된 서비스가 없습니다.
            <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={addDefaults}>기본 서비스 3개 추가 (Higgsfield · Suno · CapCut)</button></div>
          </div>
        )}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {cfg.tools.map((t) => (
            <button key={t.id} className={'tab-btn' + (t.id === activeTool ? ' active' : '')} onClick={() => setActiveTool(t.id)}>{t.name || '(이름 없음)'}</button>
          ))}
          <button className="btn small ghost" onClick={addTool}>+ 서비스 추가</button>
        </div>

        {tool && (
          <div style={{ marginTop: 14 }}>
            <div className="row">
              <input type="text" placeholder="서비스 이름 (예: Higgsfield)" style={{ minWidth: 180 }} maxLength={60} value={tool.name} onChange={(e) => setToolField(tool.id, 'name', e.target.value)} />
              <input type="text" placeholder="접속 주소 (https://…)" style={{ flex: 1, minWidth: 220 }} maxLength={300} value={tool.url} onChange={(e) => setToolField(tool.id, 'url', e.target.value)} />
              <button className="btn small danger" onClick={() => removeTool(tool.id)}>서비스 삭제</button>
            </div>
            <div className="row"><input type="text" placeholder="용도 (예: 이미지·영상 생성)" style={{ width: '100%' }} maxLength={200} value={tool.purpose} onChange={(e) => setToolField(tool.id, 'purpose', e.target.value)} /></div>
            <label className="small-dim">이 서비스의 주의사항 (<span className="mono">**강조할 문구**</span>처럼 별표 두 개로 감싸면 교육생 화면에서 빨간 굵은 글씨로 보입니다)</label>
            <textarea rows={5} style={{ ...taStyle, marginTop: 6 }} maxLength={3000} placeholder="예) 크레딧은 1인당 한도가 있습니다. 핵심 컷부터 생성하세요. 실존 인물·브랜드 무단 사용 금지." value={tool.cautions} onChange={(e) => setToolField(tool.id, 'cautions', e.target.value)} />
          </div>
        )}
      </div>

      <div className="panel" style={{ position: 'sticky', bottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={save} disabled={saving || !dirty}>{saving ? '저장 중…' : '저장'}</button>
        <span className="small-dim">{dirty ? '저장하지 않은 변경이 있습니다.' : '변경 사항이 모두 저장되었습니다.'} 계정 정보(비밀번호 포함)는 서버의 비공개 저장소에 보관되며 관리자와 해당 교육생 본인에게만 보입니다.</span>
      </div>
    </>
  );
}

function FeedbackPanel({ students, showToast }) {
  const [summary, setSummary] = useState(null);
  const [titles, setTitles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(null); // { id, title, body }

  const fmt = (d) => new Date(d).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const loadSummary = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/feedback')
      .then((j) => {
        setSummary(Object.fromEntries((j.summary || []).map((s) => [s.studentId, s])));
        setTitles(j.titles || []);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const loadThread = useCallback((sid) => {
    setThread(null);
    apiCall('/api/admin/feedback?studentId=' + encodeURIComponent(sid))
      .then((j) => setThread(j.feedback || []))
      .catch((err) => showToast('불러오기 실패: ' + err.message));
  }, [showToast]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (selected) loadThread(selected); }, [selected, loadThread]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) { showToast('피드백 내용을 입력해주세요'); return; }
    setSending(true);
    try {
      await apiCall('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selected, title, body })
      });
      setBody('');
      showToast('피드백을 등록했습니다');
      loadThread(selected);
      loadSummary();
    } catch (err) {
      showToast('등록 실패: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    try {
      await apiCall('/api/admin/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing)
      });
      setEditing(null);
      showToast('수정했습니다');
      loadThread(selected);
    } catch (err) {
      showToast('수정 실패: ' + err.message);
    }
  }

  async function remove(id) {
    if (!confirm('이 글을 삭제할까요?')) return;
    try {
      await apiCall('/api/admin/feedback?id=' + encodeURIComponent(id), { method: 'DELETE' });
      showToast('삭제했습니다');
      loadThread(selected);
      loadSummary();
    } catch (err) {
      showToast('삭제 실패: ' + err.message);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <h2>과제 피드백</h2>
        <div className="empty">
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={loadSummary}>다시 시도</button></div>
        </div>
      </div>
    );
  }
  if (!summary) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  const sel = students.find((s) => s.id === selected);
  const taStyle = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
  };

  return (
    <>
      <div className="panel">
        <h2>과제 피드백</h2>
        <p className="small-dim" style={{ marginBottom: 12 }}>과제 파일은 구글 드라이브에서 확인하고, 여기서는 학생별 피드백만 남깁니다. 학생은 대시보드의 &quot;과제 피드백&quot; 버튼에서 본인 피드백을 보고 답글을 남길 수 있습니다.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>이름</th><th>글 수</th><th>마지막 활동</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={6} className="empty">교육생이 없습니다.</td></tr>}
              {students.map((st) => {
                const s = summary[st.id];
                return (
                  <tr key={st.id} style={selected === st.id ? { background: 'var(--accent-dim)' } : undefined}>
                    <td className="mono">{st.id}</td>
                    <td>{st.name || <span className="small-dim">(이름 미입력)</span>}</td>
                    <td>{s ? s.total : 0}</td>
                    <td className="small-dim">{s ? fmt(s.lastAt) : '-'}</td>
                    <td>{s && s.lastRole === 'student' ? <span className="badge-status warn">학생 답글</span> : (s ? <span className="small-dim">발송됨</span> : <span className="small-dim">-</span>)}</td>
                    <td><button className="btn small ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => { setSelected(st.id); setEditing(null); }}>{s ? '열기' : '작성'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <h2>{sel ? sel.name || ('ID ' + sel.id) : selected} 님 피드백</h2>
          {thread === null && <div className="empty">불러오는 중…</div>}
          {thread && thread.length === 0 && <div className="empty">아직 남긴 피드백이 없습니다.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {thread?.map((r) => {
              const admin = r.author_role === 'admin';
              return (
                <div key={r.id} style={{
                  border: '1px solid var(--border)', borderLeft: '3px solid ' + (admin ? 'var(--accent)' : 'var(--text-dim)'),
                  borderRadius: 8, padding: '10px 12px', background: admin ? 'var(--accent-dim)' : 'var(--surface)'
                }}>
                  <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{admin ? '관리자(' + (r.author_name || '-') + ')' : '학생'}</b>
                    {r.title && <span className="badge-status ok">{r.title}</span>}
                    <span className="small-dim">{fmt(r.created_at)}</span>
                  </div>
                  {editing?.id === r.id ? (
                    <>
                      <input type="text" placeholder="과제명 (선택)" style={{ width: '100%', marginBottom: 6 }} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      <textarea rows={4} style={{ ...taStyle, marginBottom: 6 }} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                      <div className="row" style={{ marginBottom: 0 }}>
                        <button className="btn small" onClick={saveEdit}>저장</button>
                        <button className="btn small ghost" onClick={() => setEditing(null)}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 8 }}>{r.body}</div>
                      <div className="row" style={{ marginBottom: 0 }}>
                        {admin && <button className="btn small ghost" onClick={() => setEditing({ id: r.id, title: r.title, body: r.body })}>수정</button>}
                        <button className="btn small danger" onClick={() => remove(r.id)}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={send}>
            <div className="row">
              <input type="text" list="feedback-titles" placeholder="과제명 (선택, 예: 사전과제 기획서)" style={{ flex: 1, minWidth: 200 }} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
              <datalist id="feedback-titles">{titles.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <textarea rows={5} style={{ ...taStyle, marginBottom: 8 }} maxLength={3000} placeholder="피드백 내용 (예: 01:23 구간 자막이 작아요 …)" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="btn" type="submit" disabled={sending}>{sending ? '등록 중…' : '피드백 등록'}</button>
          </form>
        </div>
      )}
    </>
  );
}

function QuestionsPanel({ showToast }) {
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/questions')
      .then((j) => { setQuestions(j.questions || []); window.dispatchEvent(new Event('questions-changed')); })
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function answer(id, original) {
    try {
      await apiCall('/api/admin/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, answer: drafts[id]?.answer ?? original.answer ?? '', question: drafts[id]?.question })
      });
      showToast('저장했습니다');
      load();
    } catch (err) {
      showToast('저장 실패: ' + err.message);
    }
  }

  async function createFaq(e) {
    e.preventDefault();
    if (!faqQuestion.trim()) { showToast('질문 내용을 입력해주세요'); return; }
    setCreating(true);
    try {
      await apiCall('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: faqQuestion, answer: faqAnswer })
      });
      setFaqQuestion(''); setFaqAnswer('');
      showToast('자주하는 질문을 추가했습니다');
      load();
    } catch (err) {
      showToast('추가 실패: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id) {
    if (!confirm('삭제할까요?')) return;
    try {
      await apiCall('/api/admin/questions?id=' + encodeURIComponent(id), { method: 'DELETE' });
      showToast('삭제했습니다');
      load();
    } catch (err) {
      showToast('삭제 실패: ' + err.message);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <h2>질문 게시판</h2>
        <div className="empty">
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={load}>다시 시도</button></div>
        </div>
      </div>
    );
  }

  if (!questions) return <div className="panel"><div className="empty">불러오는 중…</div></div>;

  const faqs = questions.filter((q) => q.is_faq);
  const asked = questions.filter((q) => !q.is_faq);

  function questionCard(q, { faq }) {
    return (
      <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 12.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          {faq && <span className="badge-status ok">FAQ</span>}
          <b>{q.student_name || '익명'}</b>
          {q.student_id && <span className="small-dim">· ID {q.student_id}</span>}
          <span className="small-dim">{new Date(q.created_at).toLocaleString('ko-KR')}</span>
        </div>
        {faq ? (
          <textarea
            defaultValue={q.question}
            rows={2}
            onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: { ...d[q.id], question: e.target.value } }))}
            style={{
              width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 7, padding: 8, fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical', marginBottom: 8, fontWeight: 600
            }}
          />
        ) : (
          <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{q.question}</div>
        )}
        <textarea
          defaultValue={q.answer || ''}
          placeholder="답변을 입력하세요"
          rows={3}
          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: { ...d[q.id], answer: e.target.value } }))}
          style={{
            width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
            borderRadius: 7, padding: 8, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', marginBottom: 8
          }}
        />
        <div className="row" style={{ marginBottom: 0 }}>
          <button className="btn small" onClick={() => answer(q.id, q)}>저장</button>
          <button className="btn small danger" onClick={() => remove(q.id)}>삭제</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>자주하는 질문 (FAQ) 등록</h2>
        <p className="small-dim" style={{ marginBottom: 12 }}>미리 등록하면 학생이 질문을 남기기 전에도 게시판 상단에서 바로 볼 수 있습니다.</p>
        <form onSubmit={createFaq}>
          <div className="row">
            <input type="text" placeholder="자주 묻는 질문" style={{ flex: 1, minWidth: 240 }} value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} />
          </div>
          <div className="row">
            <textarea
              placeholder="답변 (비워두면 '답변 대기중'으로 표시됩니다)"
              value={faqAnswer}
              onChange={(e) => setFaqAnswer(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
                borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
              }}
            />
          </div>
          <button className="btn" type="submit" disabled={creating}>{creating ? '추가 중…' : '+ FAQ 추가'}</button>
        </form>
      </div>

      <div className="panel">
        <h2>자주하는 질문 목록 ({faqs.length}건)</h2>
        {faqs.length === 0 && <div className="empty">등록된 FAQ가 없습니다.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {faqs.map((q) => questionCard(q, { faq: true }))}
        </div>
      </div>

      <div className="panel">
        <h2>학생 질문 ({asked.length}건)</h2>
        {asked.length === 0 && <div className="empty">등록된 질문이 없습니다.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {asked.map((q) => questionCard(q, { faq: false }))}
        </div>
      </div>
    </>
  );
}

function AdminsPanel({ me, showToast }) {
  const [admins, setAdmins] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    apiCall('/api/admin/admins').then((j) => setAdmins(j.admins || [])).catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createAdmin(e) {
    e.preventDefault();
    if (!name.trim() || password.length < 4) {
      showToast('이름과 4자 이상 비밀번호를 입력해주세요');
      return;
    }
    setCreating(true);
    try {
      await apiCall('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      setName(''); setPassword('');
      load();
      showToast('관리자를 추가했습니다');
    } catch (err) {
      showToast('추가 실패: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function removeAdmin(id) {
    if (!confirm('이 관리자 계정을 삭제할까요?')) return;
    try {
      await apiCall('/api/admin/admins?id=' + encodeURIComponent(id), { method: 'DELETE' });
      load();
      showToast('삭제했습니다');
    } catch (err) {
      showToast('삭제 실패: ' + err.message);
    }
  }

  return (
    <div className="panel">
      <h2>관리자 계정</h2>
      <p className="small-dim" style={{ marginBottom: 12 }}>이름 없이 마스터 비밀번호로 로그인하면 &quot;마스터관리자&quot;로 표시됩니다. 담당자별 계정은 아래에서 추가하세요.</p>
      {loadError && (
        <div className="empty" style={{ marginBottom: 12 }}>
          불러오지 못했습니다: {loadError}
          <div style={{ marginTop: 10 }}><button className="btn small ghost" onClick={load}>다시 시도</button></div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>이름</th><th>생성일</th><th></th></tr></thead>
          <tbody>
            {admins === null && !loadError && <tr><td colSpan={3} className="empty">불러오는 중…</td></tr>}
            {admins?.length === 0 && <tr><td colSpan={3} className="empty">추가된 담당자 계정이 없습니다.</td></tr>}
            {admins?.map((a) => (
              <tr key={a.id}>
                <td>{a.name}{me?.id === a.id ? ' (나)' : ''}</td>
                <td className="small-dim">{new Date(a.created_at).toLocaleDateString('ko-KR')}</td>
                <td>{me?.id !== a.id && <button className="btn small danger" onClick={() => removeAdmin(a.id)}>삭제</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={createAdmin} className="row" style={{ marginTop: 12 }}>
        <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="password" placeholder="비밀번호 (4자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn" type="submit" disabled={creating}>{creating ? '추가 중…' : '+ 관리자 추가'}</button>
      </form>
    </div>
  );
}

function OverviewPanel({ students, sessions, attendance, studentPageUrl }) {
  if (!students.length) return <div className="panel"><div className="empty">교육생이 없습니다.</div></div>;

  return (
    <div className="panel">
      <h2>전체 현황</h2>
      <p className="small-dim" style={{ marginBottom: 12 }}>교육생은 이제 <a href="/login" target="_blank" rel="noreferrer">로그인 페이지</a>에서 본인 이름+비밀번호로 직접 접속합니다. 아래 "미리보기"는 관리자가 확인용으로 보는 화면입니다.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>비밀번호</th><th>진행</th><th>출석</th><th>출석률</th><th>교육시간</th><th>상태</th><th></th></tr></thead>
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
                  <td><span className={'badge-status ' + (st.hasPassword ? 'ok' : 'warn')}>{st.hasPassword ? '설정됨' : '미설정'}</span></td>
                  <td>{stat.doneCount}/{stat.totalSessions}</td>
                  <td>{stat.attendedCount}/{stat.doneCount}</td>
                  <td>{pct(stat.attendanceRate)}</td>
                  <td>{h(stat.recognizedHours)}/{h(stat.totalHours)}</td>
                  <td><span className={'badge-status ' + lb.cls}>{lb.icon} {lb.text}</span></td>
                  <td><a className="btn small ghost" href={link} target="_blank" rel="noreferrer">미리보기</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
