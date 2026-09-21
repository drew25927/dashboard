import { NextResponse } from 'next/server';

export function proxy(req) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get('admin_session')?.value;
  const authorized = cookie === process.env.ADMIN_PASSWORD;

  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (!authorized) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!authorized) {
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
