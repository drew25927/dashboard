import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { verifySession } from './session';

// 현재 요청의 쿠키를 확인해 로그인된 교육생을 돌려줍니다. 없으면 null.
export async function getAuthorizedStudent() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('student_sid')?.value;
  if (!raw) return null;

  // 서명이 맞는 쿠키만 인정 (직접 만든 값은 null)
  const parsed = verifySession(raw);
  if (!parsed) return null;

  const db = supabaseAdmin();
  const { data } = await db.from('students').select('id,name,course_id').eq('id', parsed.id).maybeSingle();
  return data || null;
}
