export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyPassword } from '../../../lib/adminAuth';

// 교육생 로그인 (이름 + 비밀번호)
export async function POST(req) {
  const { name, password } = await req.json();

  if (!name || !name.trim() || !password) {
    return NextResponse.json({ error: '이름과 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: matches, error } = await db.from('students').select('*').eq('name', name.trim());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  const res = NextResponse.json({ ok: true });
  res.cookies.set('student_session', JSON.stringify({ id: student.id }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90
  });
  return res;
}
