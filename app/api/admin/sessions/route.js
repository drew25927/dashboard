export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse } from '../../../../lib/courses';
import { kstToday } from '../../../../lib/lesson';

const FIELDS = ['date', 'type', 'hours', 'topic', 'detail'];

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('sessions').select('*').eq('course_id', courseId).order('n');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

// 회차 추가: 다음 번호로 빈 회차 하나를 만든다 (날짜 등은 화면에서 고침)
export async function POST(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data: rows, error: readErr } = await db.from('sessions').select('n').eq('course_id', courseId);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const n = rows.length ? Math.max(...rows.map((r) => r.n)) + 1 : 1;
  if (n > 99) return NextResponse.json({ error: '회차는 99회차까지 만들 수 있습니다.' }, { status: 400 });

  const { data, error } = await db
    .from('sessions')
    .insert({ course_id: courseId, n, date: kstToday(), type: '온라인', hours: 2, topic: '' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { n, field, value } = await req.json();
  if (!n || !field) return NextResponse.json({ error: 'n, field가 필요합니다.' }, { status: 400 });
  if (!FIELDS.includes(field)) return NextResponse.json({ error: '수정할 수 없는 항목입니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('sessions').update({ [field]: value }).eq('course_id', courseId).eq('n', n);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 회차 삭제: 그 회차의 출석 기록도 함께 사라진다.
export async function DELETE(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const n = Number(new URL(req.url).searchParams.get('n'));
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'n이 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('sessions').delete().eq('course_id', courseId).eq('n', n);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
