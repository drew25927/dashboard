export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse } from '../../../../lib/courses';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('notice').select('*').eq('id', courseId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data?.content || '' });
}

export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { content } = await req.json();
  const db = supabaseAdmin();
  const { error } = await db.from('notice').update({ content: content || '' }).eq('id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
