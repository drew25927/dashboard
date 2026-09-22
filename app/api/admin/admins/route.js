export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedAdmin, hashPassword } from '../../../../lib/adminAuth';

// 관리자 계정 관리는 마스터만 가능 (일반 관리자는 접근 불가)
async function requireMaster() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (admin.id !== 'master') return { error: NextResponse.json({ error: '마스터 계정만 접근할 수 있습니다.' }, { status: 403 }) };
  return { admin };
}

export async function GET() {
  const { error } = await requireMaster();
  if (error) return error;

  const db = supabaseAdmin();
  const { data, error: dbErr } = await db.from('admins').select('id,name,created_at').order('created_at');
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ admins: data });
}

export async function POST(req) {
  const { error } = await requireMaster();
  if (error) return error;

  const { name, password } = await req.json();
  if (!name || !name.trim() || !password || password.length < 4) {
    return NextResponse.json({ error: '이름과 4자 이상 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error: dbErr } = await db
    .from('admins')
    .insert({ name: name.trim(), password_hash: hashPassword(password) })
    .select('id,name,created_at')
    .single();

  if (dbErr) {
    const msg = dbErr.code === '23505' ? '이미 있는 이름입니다.' : dbErr.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ admin: data });
}

export async function DELETE(req) {
  const { admin: me, error } = await requireMaster();
  if (error) return error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error: dbErr } = await db.from('admins').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
