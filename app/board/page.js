'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { COURSE_TITLE } from '../../lib/config';

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="page"><div className="state"><div className="spinner" /></div></div>}>
      <BoardInner />
    </Suspense>
  );
}

function BoardInner() {
  const sp = useSearchParams();
  const studentId = sp.get('id');

  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch('/api/questions')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setQuestions(j.questions || []);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName: name, question })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '등록 실패');
      setQuestions((qs) => [json.question, ...(qs || [])]);
      setQuestion('');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <span className="badge-mode">질문 게시판</span>
        {studentId && <a href={'/?id=' + studentId}>← 내 출결 현황으로</a>}
      </div>
      <div className="banner"><div><h1>{COURSE_TITLE} 질문 게시판</h1><div className="sub">운영사무국에 궁금한 점을 남겨주세요</div></div></div>

      <div className="panel">
        <h2>질문 남기기</h2>
        <form onSubmit={submit}>
          <div className="row">
            <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 140 }} />
          </div>
          <div className="row">
            <textarea
              placeholder="질문 내용을 입력해주세요"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
                borderRadius: 7, padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical'
              }}
            />
          </div>
          {submitError && <div className="small-dim" style={{ color: 'var(--danger)', marginBottom: 8 }}>{submitError}</div>}
          <button className="btn" type="submit" disabled={submitting}>{submitting ? '등록 중…' : '질문 등록'}</button>
        </form>
      </div>

      <div className="panel">
        <h2>등록된 질문</h2>
        {loadError && <div className="empty">불러오지 못했습니다: {loadError}</div>}
        {!loadError && questions === null && <div className="empty">불러오는 중…</div>}
        {questions?.length === 0 && <div className="empty">아직 등록된 질문이 없습니다.</div>}
        {questions?.map((q) => (
          <div key={q.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, marginBottom: 4 }}>
              <b>{q.student_name || '익명'}</b>
              <span className="small-dim" style={{ marginLeft: 8 }}>{new Date(q.created_at).toLocaleString('ko-KR')}</span>
            </div>
            <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', marginBottom: q.answer ? 8 : 0 }}>{q.question}</div>
            {q.answer ? (
              <div style={{ background: 'var(--accent-dim)', borderLeft: '3px solid var(--accent)', borderRadius: 6, padding: '8px 10px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                <span className="small-dim" style={{ display: 'block', marginBottom: 4, color: 'var(--accent-ink)' }}>운영사무국 답변</span>
                {q.answer}
              </div>
            ) : (
              <div className="small-dim">답변 대기중</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
