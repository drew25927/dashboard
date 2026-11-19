export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse, getCourse, parseDriveFolderId, MAIN_COURSE } from '../../../../lib/courses';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const [{ data, error }, course] = await Promise.all([
    db.from('settings').select('*').eq('id', courseId).maybeSingle(),
    getCourse(courseId)
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    courseTitle: data?.course_title || '',
    courseSub: data?.course_sub || '',
    driveFolderId: course?.drive_folder_id || '',
    isMain: courseId === MAIN_COURSE
  });
}

// body: { courseTitle, courseSub, driveFolder? }  driveFolder: 구글 드라이브 과제 폴더 주소 또는 ID (비우면 지정 해제)
export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { courseTitle, courseSub, driveFolder } = await req.json();
  const db = supabaseAdmin();

  if (typeof driveFolder === 'string') {
    const folderId = parseDriveFolderId(driveFolder);
    if (driveFolder.trim() && !folderId) {
      return NextResponse.json({ error: '구글 드라이브 폴더 주소를 알아볼 수 없습니다. 폴더를 연 주소창의 주소를 그대로 붙여 주세요.' }, { status: 400 });
    }
    const { error: fErr } = await db.from('courses').update({ drive_folder_id: folderId }).eq('id', courseId);
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  }

  const { error } = await db
    .from('settings')
    .update({ course_title: courseTitle || '', course_sub: courseSub || '' })
    .eq('id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
