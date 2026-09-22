import { NextResponse } from 'next/server';

// 여기서는 "쿠키가 있는지"만 가볍게 확인해서 리다이렉트를 결정합니다.
// 실제 신원 확인(마스터 여부 / admins 테이블 조회)은 각 API 라우트가
// lib/adminAuth.js의 getAuthorizedAdmin()으로 수행합니다 (Edge에서는 DB 조회를 피하기 위함).
export function proxy(req) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get('admin_session')?.value);

  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (!hasCookie) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
