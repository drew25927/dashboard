export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse } from '../../../../lib/courses';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('questions').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

// 관리자가 직접 등록하는 자주하는 질문(FAQ)
export async function POST(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { question, answer } = await req.json();
  if (!question || !question.trim()) {
    return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('questions')
    .insert({
      course_id: courseId,
      student_name: '관리자',
      question: question.trim(),
      answer: (answer || '').trim() || null,
      is_faq: true,
      answered_at: answer ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}

export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { id, answer, question } = await req.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const update = { answer, answered_at: new Date().toISOString() };
  if (typeof question === 'string') update.question = question;

  const db = supabaseAdmin();
  const { error } = await db.from('questions').update(update).eq('course_id', courseId).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('questions').delete().eq('course_id', courseId).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
