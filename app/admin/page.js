'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { computeStats, isDone, recognizedHoursFor, STATUS_LABEL } from '../../lib/calc';
import { DEFAULT_COURSE_TITLE, DEFAULT_COURSE_SUB } from '../../lib/config';

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

      <div className="hint">💡 여기서 저장하면 학생용 페이지에 <b>즉시 반영</b>됩니다 (별도 갱신 요청 필요 없음).</div>

      <div className="tabs">
        {[
          ['attend', '출석체크'], ['students', '교육생 명단'], ['sessions', '회차 일정'], ['course', '과정 정보'],
          ['notice', '공지사항'], ['links', '링크 설정'], ['questions', '질문 게시판'],
          ...(isMaster ? [['admins', '관리자 계정']] : []),
          ['overview', '전체 현황']
        ].map(([k, label]) => (
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

  const TYPE_LABEL = { link: '외부 링크', page: '설명 페이지', board: '질문 게시판' };

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
              <textarea
                defaultValue={l.content}
                rows={5}
                placeholder="학생에게 보여줄 안내 내용을 입력하세요"
                onBlur={(e) => updateField(l.key, 'content', e.target.value)}
                style={{
                  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
                  borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
                }}
              />
            )}
            {l.type === 'board' && (
              <p className="small-dim">질문·답변은 상단 &quot;질문 게시판&quot; 탭에서 관리합니다.</p>
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
          </div>
        ))}
      </div>
    </div>
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
      .then((j) => setQuestions(j.questions || []))
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
              const link = studentPageUrl + '/id=' + st.id;
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
