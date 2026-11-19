import { supabaseAdmin } from './supabaseAdmin';
import { DEFAULT_COURSE_TITLE, DEFAULT_COURSE_SUB } from './config';

// 과정명·부제는 교육별로 한 행씩(settings.id = 교육 id)
export async function getSettings(courseId = 'main') {
  const db = supabaseAdmin();
  const { data } = await db.from('settings').select('*').eq('id', courseId).maybeSingle();
  // 기본 문구는 기존 교육(main)에만 쓴다. 새 교육이 다른 교육 이름·일정을 물려받아 보이지 않게.
  const isMain = courseId === 'main';
  return {
    courseTitle: data?.course_title || (isMain ? DEFAULT_COURSE_TITLE : ''),
    courseSub: data?.course_sub || (isMain ? DEFAULT_COURSE_SUB : '')
  };
}
