export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// 공개 API (로그인 불필요): 교육생이 질문 게시판을 보고 글을 남기는 용도
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('questions').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

export async function POST(req) {
  const { studentId, studentName, question } = await req.json();
  if (!question || !question.trim()) {
    return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('questions')
    .insert({
      student_id: studentId || null,
      student_name: (studentName || '').trim() || '익명',
      question: question.trim()
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}
