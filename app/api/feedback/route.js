export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAuthorizedStudent } from '../../../lib/studentAuth';

const MAX_BODY = 2000;

// 교육생이 관리자 피드백에 남기는 답글 (본인 스레드에만 작성 가능)
export async function POST(req) {
  const student = await getAuthorizedStudent();
  if (!student) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { body } = await req.json();
  const text = (body || '').trim();
  if (!text) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  if (text.length > MAX_BODY) return NextResponse.json({ error: `내용은 ${MAX_BODY}자 이하로 입력해주세요.` }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('feedback')
    .insert({ student_id: student.id, title: '', body: text, author_role: 'student', author_name: student.name })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}
