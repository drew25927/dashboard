'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 페이지를 연 뒤 "새 피드백" 표시를 지우기 위해 읽음 처리 (표시는 서버가 먼저 계산해서 이미 그려진 상태)
export function MarkSeen({ hasNew, upTo }) {
  useEffect(() => {
    if (!hasNew || !upTo) return;
    fetch('/api/feedback/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upTo })
    }).catch(() => {});
  }, [hasNew, upTo]);
  return null;
}

export function ReplyForm() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '등록하지 못했습니다.');
      setBody('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="피드백에 대한 답글이나 궁금한 점을 남겨주세요"
        style={{
          width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
          borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', marginBottom: 8
        }}
      />
      {error && <div className="small-dim" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
      <button className="btn" type="submit" disabled={sending}>{sending ? '등록 중…' : '답글 등록'}</button>
    </form>
  );
}
