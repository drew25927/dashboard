'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      style={{
        background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', borderRadius: 999,
        padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
      }}
    >
      로그아웃
    </button>
  );
}
