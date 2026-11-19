export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashPassword } from '../../../../lib/adminAuth';
import { requireAdminCourse } from '../../../../lib/courses';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('students').select('id,name,contact,email,password_hash,created_at').eq('course_id', courseId).order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 비밀번호 해시는 화면에 내려보내지 않고, 설정 여부만 전달
  const students = data.map(({ password_hash, ...rest }) => ({ ...rest, hasPassword: Boolean(password_hash) }));
  return NextResponse.json({ students });
}

export async function POST(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  // 교육생 번호(id)는 모든 교육을 통틀어 유일해야 해서, 교육과 상관없이 전체에서 다음 번호를 붙인다.
  const { data: existing, error: readErr } = await db.from('students').select('id');
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const ids = existing.map((s) => Number(s.id)).filter((n) => !Number.isNaN(n));
  const nextId = String(ids.length ? Math.max(...ids) + 1 : 101);

  const { data, error } = await db
    .from('students')
    .insert({ id: nextId, course_id: courseId, name: '', contact: '', email: '' })
    .select('id,name,contact,email,created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student: { ...data, hasPassword: false } });
}

export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { id, field, value } = await req.json();
  if (!id || !field) return NextResponse.json({ error: 'id, field가 필요합니다.' }, { status: 400 });
  // 교육·번호는 이 화면에서 바꾸지 못하게 막는다 (다른 교육으로 옮기거나 번호를 바꾸는 사고 방지)
  if (!['name', 'contact', 'email', 'password'].includes(field)) {
    return NextResponse.json({ error: '수정할 수 없는 항목입니다.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  if (field === 'password') {
    if (!value || value.length < 4) {
      return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
    }
    const { error } = await db.from('students').update({ password_hash: hashPassword(value) }).eq('id', id).eq('course_id', courseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.from('students').update({ [field]: value }).eq('id', id).eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('students').delete().eq('id', id).eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
