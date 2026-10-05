export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';

const MAX_BODY = 3000;
const MAX_TITLE = 100;

async function requireAdmin() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  return { admin };
}

// ?studentId=101 → 해당 학생의 피드백 스레드 / 없으면 학생별 요약(건수, 마지막 활동)
export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const db = supabaseAdmin();
  const studentId = new URL(req.url).searchParams.get('studentId');

  if (studentId) {
    const { data, error: dbErr } = await db.from('feedback').select('*').eq('student_id', studentId).order('created_at');
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ feedback: data });
  }

  const { data, error: dbErr } = await db.from('feedback').select('student_id,author_role,title,created_at').order('created_at');
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const byStudent = {};
  const titles = new Set();
  for (const r of data) {
    const s = (byStudent[r.student_id] ||= { studentId: r.student_id, total: 0, lastAt: null, lastRole: null });
    s.total += 1;
    s.lastAt = r.created_at;
    s.lastRole = r.author_role;
    if (r.title) titles.add(r.title);
  }
  // titles: 과제명 입력 시 자동완성 후보
  return NextResponse.json({ summary: Object.values(byStudent), titles: [...titles] });
}

// body: { studentId, title?, body }
export async function POST(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { studentId, title, body } = await req.json();
  if (!studentId) return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 });
  const text = (body || '').trim();
  if (!text) return NextResponse.json({ error: '피드백 내용을 입력해주세요.' }, { status: 400 });
  if (text.length > MAX_BODY) return NextResponse.json({ error: `내용은 ${MAX_BODY}자 이하로 입력해주세요.` }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error: dbErr } = await db
    .from('feedback')
    .insert({
      student_id: String(studentId),
      title: (title || '').trim().slice(0, MAX_TITLE),
      body: text,
      author_role: 'admin',
      author_name: admin.name
    })
    .select()
    .single();
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

// 관리자가 쓴 글의 오타 수정용 (학생이 쓴 글은 수정 불가)
export async function PUT(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, title, body } = await req.json();
  const text = (body || '').trim();
  if (!id || !text) return NextResponse.json({ error: 'id와 내용이 필요합니다.' }, { status: 400 });
  if (text.length > MAX_BODY) return NextResponse.json({ error: `내용은 ${MAX_BODY}자 이하로 입력해주세요.` }, { status: 400 });

  const db = supabaseAdmin();
  const { error: dbErr } = await db
    .from('feedback')
    .update({ title: (title || '').trim().slice(0, MAX_TITLE), body: text })
    .eq('id', id)
    .eq('author_role', 'admin');
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error: dbErr } = await db.from('feedback').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
