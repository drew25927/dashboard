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
  const { data, error } = await db.from('questions').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

// 관리자가 직접 등록하는 자주하는 질문(FAQ)
export async function POST(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { question, answer } = await req.json();
  if (!question || !question.trim()) {
    return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('questions')
    .insert({
      student_name: '운영사무국',
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
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { id, answer, question } = await req.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const update = { answer, answered_at: new Date().toISOString() };
  if (typeof question === 'string') update.question = question;

  const db = supabaseAdmin();
  const { error } = await db.from('questions').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('questions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
