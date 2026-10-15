'use client';
import { useState } from 'react';

async function copyText(text, setMsg) {
  try {
    await navigator.clipboard.writeText(text);
    setMsg('복사했어요');
  } catch {
    setMsg('복사하지 못했어요');
  }
  setTimeout(() => setMsg(''), 1500);
}

// 아이디/비밀번호 한 줄: 값 + 복사, 비밀번호는 [보기]를 눌러야 보임
export function SecretRow({ label, value, secret }) {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  if (!value) return null;
  return (
    <div className="acc-row">
      <span className="acc-label">{label}</span>
      <span className="acc-value mono">{secret && !show ? '••••••••••' : value}</span>
      {secret && (
        <button type="button" className="btn small ghost" onClick={() => setShow((s) => !s)}>{show ? '숨기기' : '보기'}</button>
      )}
      <button type="button" className="btn small ghost" onClick={() => copyText(value, setMsg)}>복사</button>
      {msg && <span className="small-dim">{msg}</span>}
    </div>
  );
}
