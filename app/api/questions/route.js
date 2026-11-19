export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { viewerCourse } from '../../../lib/courses';

// 공개 API (로그인 불필요): 교육생이 질문 게시판을 보고 글을 남기는 용도
// 교육별로 게시판이 따로 있어서, 로그인한 교육생 또는 ?id=(교육생 번호)가 속한 교육의 글만 돌려준다.
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const courseId = await viewerCourse({ studentId: sp.get('id'), courseParam: sp.get('course') });

  const db = supabaseAdmin();
  const { data, error } = await db.from('questions').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

export async function POST(req) {
  const { studentId, studentName, question } = await req.json();
  if (!question || !question.trim()) {
    return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 });
  }

  const courseId = await viewerCourse({ studentId });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('questions')
    .insert({
      course_id: courseId,
      student_id: studentId || null,
      student_name: (studentName || '').trim() || '익명',
      question: question.trim()
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}
