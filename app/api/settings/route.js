export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSettings } from '../../../lib/settings';

// 공개 API: 클라이언트 컴포넌트(질문 게시판 등)에서 과정명 표시용으로 사용
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}
