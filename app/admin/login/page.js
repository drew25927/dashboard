'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_COURSE_TITLE } from '../../../lib/config';

export default function LoginPage() {
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
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || '로그인에 실패했습니다.');
    }
  }

  return (
    <div className="page">
      <div className="login-card">
        <h1>{courseTitle} 관리자</h1>
        {error && <div className="err">{error}</div>}
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="이름 (마스터 로그인은 비워두세요)"
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
      </div>
    </div>
  );
}
