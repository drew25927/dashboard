import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyPassword } from '../../../../lib/adminAuth';

export async function POST(req) {
  const { name, password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 401 });
  }

  // 이름 없이 마스터 비밀번호만 입력하면 마스터 계정으로 로그인
  if (!name || !name.trim()) {
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    return setSessionCookie({ id: 'master' });
  }

  const db = supabaseAdmin();
  const { data: admin, error } = await db.from('admins').select('*').eq('name', name.trim()).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return NextResponse.json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  return setSessionCookie({ id: admin.id });
}

function setSessionCookie(payload) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', JSON.stringify(payload), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}
