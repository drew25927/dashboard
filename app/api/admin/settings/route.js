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
  const { data, error } = await db.from('settings').select('*').eq('id', 'main').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courseTitle: data?.course_title || '', courseSub: data?.course_sub || '' });
}

export async function PUT(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { courseTitle, courseSub } = await req.json();
  const db = supabaseAdmin();
  const { error } = await db
    .from('settings')
    .update({ course_title: courseTitle || '', course_sub: courseSub || '' })
    .eq('id', 'main');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
