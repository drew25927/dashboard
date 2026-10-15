export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';
import { getAiConfig, sanitizeConfig, saveAiConfig } from '../../../../lib/aiAccounts';

async function requireAdmin() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  return NextResponse.json({ config: await getAiConfig() });
}

export async function PUT(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const body = await req.json().catch(() => null);
  if (!body?.config) return NextResponse.json({ error: '저장할 내용이 없습니다.' }, { status: 400 });
  const clean = sanitizeConfig(body.config);
  try {
    await saveAiConfig(clean);
  } catch (e) {
    return NextResponse.json({ error: '저장하지 못했습니다: ' + e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: clean });
}
