export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 드라이브 전체를 읽는 데 15초 안팎 걸림

import { NextResponse } from 'next/server';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';
import { getSubmissionData, refreshSubmissions } from '../../../../lib/drive';

// 과제 제출 현황 (관리자 전용). ?refresh=1 이면 드라이브를 바로 다시 읽어 저장한 뒤 돌려줌.
export async function GET(req) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  if (refresh) {
    const r = await refreshSubmissions();
    return NextResponse.json(r.students ? { ...r, ok: true } : { ok: false, reason: 'error', error: r.error || '확인에 실패했습니다.' });
  }
  return NextResponse.json(await getSubmissionData());
}
