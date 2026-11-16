export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';

async function requireAdmin() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const db = supabaseAdmin();
  const { data, error } = await db.from('attendance').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

// body: { rows: [{ studentId, sessionN, status, recognizedHours }, ...] }
export async function POST(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) {
    return NextResponse.json({ error: 'rows 배열이 필요합니다.' }, { status: 400 });
  }

  const payload = rows.map((r) => ({
    student_id: String(r.studentId),
    session_n: Number(r.sessionN),
    status: r.status || '',
    recognized_hours: Number(r.recognizedHours) || 0
  }));

  const db = supabaseAdmin();
  const { error } = await db.from('attendance').upsert(payload, { onConflict: 'student_id,session_n' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 출석 기록 초기화. ?session=N → 해당 회차만, ?all=1 → 전체 회차. 교육생 명단·회차 일정은 건드리지 않음.
export async function DELETE(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const db = supabaseAdmin();
  let q = db.from('attendance').delete({ count: 'exact' });
  if (searchParams.get('all') === '1') {
    q = q.not('student_id', 'is', null);
  } else {
    const n = Number(searchParams.get('session'));
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'session 또는 all=1 이 필요합니다.' }, { status: 400 });
    q = q.eq('session_n', n);
  }
  const { error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
