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

export async function PUT(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { id, answer } = await req.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
