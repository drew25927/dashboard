'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
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
        <h1>AI영상 출결 관리자</h1>
        {error && <div className="err">{error}</div>}
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit" disabled={loading}>{loading ? '확인 중…' : '로그인'}</button>
        </form>
      </div>
    </div>
  );
}
