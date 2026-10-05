export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedStudent } from '../../../../lib/studentAuth';

// 피드백 페이지에서 실제로 보여준 마지막 관리자 글(upTo)까지 읽음 처리.
// 서버 시계 대신 DB에 기록된 글 작성 시각을 그대로 읽음 기준으로 저장해서 시계 오차의 영향을 받지 않음.
export async function POST(req) {
  const student = await getAuthorizedStudent();
  if (!student) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { upTo } = await req.json().catch(() => ({}));
  if (!upTo) return NextResponse.json({ ok: true, skipped: true });

  const db = supabaseAdmin();
  const { data: row, error: findErr } = await db
    .from('feedback')
    .select('created_at')
    .eq('student_id', student.id)
    .eq('author_role', 'admin')
    .lte('created_at', upTo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: true, skipped: true });

  const { error } = await db.from('students').update({ feedback_seen_at: row.created_at }).eq('id', student.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
