import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('attendance').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

// body: { rows: [{ studentId, sessionN, status, recognizedHours }, ...] }
export async function POST(req) {
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
