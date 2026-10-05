export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyPassword } from '../../../lib/adminAuth';

// 통합 로그인: 이름+비밀번호 하나로 관리자/교육생을 자동 구분합니다.
// 순서: ① 마스터(이름 비움 + ADMIN_PASSWORD) ② 관리자 계정 ③ 교육생 계정
export async function POST(req) {
  const { name, password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const trimmedName = (name || '').trim();

  // ① 마스터 관리자
  if (!trimmedName) {
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    return setAdminSession('master');
  }

  const db = supabaseAdmin();

  // ② 관리자 계정
  const { data: admin, error: adminErr } = await db.from('admins').select('*').eq('name', trimmedName).maybeSingle();
  if (adminErr) return NextResponse.json({ error: adminErr.message }, { status: 500 });
  if (admin) {
    if (!verifyPassword(password, admin.password_hash)) {
      return NextResponse.json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    return setAdminSession(admin.id);
  }

  // ③ 교육생 계정
  const { data: matches, error: stuErr } = await db.from('students').select('*').eq('name', trimmedName);
  if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 500 });

  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }
  if (matches.length > 1) {
    return NextResponse.json({ error: '동일한 이름의 교육생이 여러 명 있습니다. 관리자에게 문의해주세요.' }, { status: 409 });
  }

  const student = matches[0];
  if (!student.password_hash || !verifyPassword(password, student.password_hash)) {
    return NextResponse.json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: 'student' });
  res.cookies.set('student_sid', JSON.stringify({ id: student.id }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90
  });
  return res;
}

function setAdminSession(id) {
  const res = NextResponse.json({ ok: true, role: 'admin' });
  res.cookies.set('admin_session', JSON.stringify({ id }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}
