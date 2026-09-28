import { redirect } from 'next/navigation';

// 예전 링크 형식(/id=101) 호환용 — 루트(/)로 리다이렉트해서
// 로그인 여부에 따라 자동으로 처리되게 합니다.
export default async function LegacyIdRedirect({ params }) {
  const { idparam } = await params;
  const decoded = decodeURIComponent(idparam || '');
  const match = /^id=(.+)$/.exec(decoded);
  const id = match ? match[1] : null;
  redirect(id ? '/?id=' + encodeURIComponent(id) : '/login');
}
