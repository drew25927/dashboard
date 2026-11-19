export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminCourse } from '../../../../lib/courses';
import { getAiConfig, sanitizeConfig, saveAiConfig } from '../../../../lib/aiAccounts';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;
  return NextResponse.json({ config: await getAiConfig(courseId) });
}

export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;
  const body = await req.json().catch(() => null);
  if (!body?.config) return NextResponse.json({ error: '저장할 내용이 없습니다.' }, { status: 400 });
  const clean = sanitizeConfig(body.config);
  try {
    await saveAiConfig(courseId, clean);
  } catch (e) {
    return NextResponse.json({ error: '저장하지 못했습니다: ' + e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: clean });
}
