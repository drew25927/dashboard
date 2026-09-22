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
  const { data, error } = await db.from('students').select('*').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

export async function POST() {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const db = supabaseAdmin();
  const { data: existing, error: readErr } = await db.from('students').select('id');
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const ids = existing.map((s) => Number(s.id)).filter((n) => !Number.isNaN(n));
  const nextId = String(ids.length ? Math.max(...ids) + 1 : 101);

  const { data, error } = await db
    .from('students')
    .insert({ id: nextId, name: '', contact: '', email: '' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student: data });
}

export async function PUT(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const { id, field, value } = await req.json();
  if (!id || !field) return NextResponse.json({ error: 'id, field가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('students').update({ [field]: value }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('students').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
