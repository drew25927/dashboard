export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSettings } from '../../../lib/settings';
import { viewerCourse } from '../../../lib/courses';

// 공개 API: 클라이언트 컴포넌트(질문 게시판 등)에서 과정명 표시용으로 사용
// ?id=교육생번호 → 그 교육생이 속한 교육의 과정명 (로그인한 교육생은 본인 교육)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const courseId = await viewerCourse({ studentId: sp.get('id'), courseParam: sp.get('course') });
  const settings = await getSettings(courseId);
  return NextResponse.json(settings);
}
