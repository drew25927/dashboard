import { supabaseAdmin } from './supabaseAdmin';
import { DEFAULT_COURSE_TITLE, DEFAULT_COURSE_SUB } from './config';

// 과정명·부제는 교육별로 한 행씩(settings.id = 교육 id)
export async function getSettings(courseId = 'main') {
  const db = supabaseAdmin();
  const { data } = await db.from('settings').select('*').eq('id', courseId).maybeSingle();
  return {
    courseTitle: data?.course_title || DEFAULT_COURSE_TITLE,
    courseSub: data?.course_sub || DEFAULT_COURSE_SUB
  };
}
