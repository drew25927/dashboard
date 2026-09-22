import { supabaseAdmin } from './supabaseAdmin';
import { DEFAULT_COURSE_TITLE, DEFAULT_COURSE_SUB } from './config';

export async function getSettings() {
  const db = supabaseAdmin();
  const { data } = await db.from('settings').select('*').eq('id', 'main').maybeSingle();
  return {
    courseTitle: data?.course_title || DEFAULT_COURSE_TITLE,
    courseSub: data?.course_sub || DEFAULT_COURSE_SUB
  };
}
