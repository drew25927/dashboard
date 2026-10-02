'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_COURSE_TITLE } from '../../lib/config';

export default function StudentLoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseTitle, setCourseTitle] = useState(DEFAULT_COURSE_TITLE);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => { if (j.courseTitle) setCourseTitle(j.courseTitle); })
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    setLoading(false);
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      router.push(j.role === 'admin' ? '/admin' : '/');
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || '로그인에 실패했습니다.');
    }
  }

  return (
    <div className="page">
      <div className="login-card">
        <h1>{courseTitle} 대시보드</h1>
        {error && <div className="err">{error}</div>}
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="이름 (마스터 관리자는 비워두세요)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn" type="submit" disabled={loading}>{loading ? '확인 중…' : '로그인'}</button>
        </form>
        <p className="small-dim" style={{ marginTop: 12, textAlign: 'center' }}>로그인 정보를 잊으셨다면 운영진에게 문의해주세요.</p>
      </div>
    </div>
  );
}
