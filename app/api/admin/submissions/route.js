export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';
import { getSubmissionData } from '../../../../lib/drive';

// 구글 드라이브 과제 폴더를 읽은 제출 현황 (관리자 전용). ?refresh=1 이면 캐시를 무시하고 다시 읽음.
export async function GET(req) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  const data = await getSubmissionData({ refresh });
  return NextResponse.json(data);
}
