export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse } from '../../../../lib/courses';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('attendance').select('*').eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

// body: { rows: [{ studentId, sessionN, status, recognizedHours }, ...] }
export async function POST(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) {
    return NextResponse.json({ error: 'rows 배열이 필요합니다.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  // 이 교육의 교육생·회차만 저장할 수 있다 (다른 교육 기록을 건드리지 못하게)
  const [{ data: studs }, { data: sess }] = await Promise.all([
    db.from('students').select('id').eq('course_id', courseId),
    db.from('sessions').select('n').eq('course_id', courseId)
  ]);
  const okStudents = new Set((studs || []).map((s) => s.id));
  const okSessions = new Set((sess || []).map((s) => s.n));

  const payload = [];
  for (const r of rows) {
    const studentId = String(r.studentId);
    const sessionN = Number(r.sessionN);
    if (!okStudents.has(studentId) || !okSessions.has(sessionN)) {
      return NextResponse.json({ error: '이 교육에 없는 교육생 또는 회차가 포함되어 있습니다.' }, { status: 400 });
    }
    payload.push({
      student_id: studentId,
      session_n: sessionN,
      course_id: courseId,
      status: r.status || '',
      recognized_hours: Number(r.recognizedHours) || 0
    });
  }

  const { error } = await db.from('attendance').upsert(payload, { onConflict: 'student_id,session_n' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 출석 기록 초기화. ?session=N → 해당 회차만, ?all=1 → 이 교육의 전체 회차. 교육생 명단·회차 일정은 건드리지 않음.
export async function DELETE(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const db = supabaseAdmin();
  let q = db.from('attendance').delete({ count: 'exact' }).eq('course_id', courseId);
  if (searchParams.get('all') !== '1') {
    const n = Number(searchParams.get('session'));
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'session 또는 all=1 이 필요합니다.' }, { status: 400 });
    q = q.eq('session_n', n);
  }
  const { error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
