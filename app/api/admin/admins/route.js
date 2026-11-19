export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashPassword } from '../../../../lib/adminAuth';
import { requireMasterAdmin, COURSE_ID_RE } from '../../../../lib/courses';

// 관리자 계정 관리는 마스터만 가능 (일반 관리자는 접근 불가)
const requireMaster = requireMasterAdmin;

// 존재하는 교육 id만 남긴다 (중복 제거)
async function cleanCourseIds(db, ids) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((c) => COURSE_ID_RE.test(c)))];
  if (!wanted.length) return [];
  const { data } = await db.from('courses').select('id').in('id', wanted);
  const ok = new Set((data || []).map((c) => c.id));
  return wanted.filter((c) => ok.has(c));
}

export async function GET() {
  const { error } = await requireMaster();
  if (error) return error;

  const db = supabaseAdmin();
  const { data, error: dbErr } = await db.from('admins').select('id,name,created_at,course_ids').order('created_at');
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ admins: data });
}

export async function POST(req) {
  const { error } = await requireMaster();
  if (error) return error;

  const { name, password, courseIds } = await req.json();
  if (!name || !name.trim() || !password || password.length < 4) {
    return NextResponse.json({ error: '이름과 4자 이상 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error: dbErr } = await db
    .from('admins')
    .insert({ name: name.trim(), password_hash: hashPassword(password), course_ids: await cleanCourseIds(db, courseIds) })
    .select('id,name,created_at,course_ids')
    .single();

  if (dbErr) {
    const msg = dbErr.code === '23505' ? '이미 있는 이름입니다.' : dbErr.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ admin: data });
}

// 담당 교육 지정. body: { id, courseIds }
export async function PUT(req) {
  const { error } = await requireMaster();
  if (error) return error;

  const { id, courseIds } = await req.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const clean = await cleanCourseIds(db, courseIds);
  const { error: dbErr } = await db.from('admins').update({ course_ids: clean }).eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, courseIds: clean });
}

export async function DELETE(req) {
  const { admin: me, error } = await requireMaster();
  if (error) return error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error: dbErr } = await db.from('admins').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
