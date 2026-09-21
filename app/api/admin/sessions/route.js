import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('sessions').select('*').order('n');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function PUT(req) {
  const { n, field, value } = await req.json();
  if (!n || !field) return NextResponse.json({ error: 'n, field가 필요합니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('sessions').update({ [field]: value }).eq('n', n);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
