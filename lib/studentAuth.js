import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

// 현재 요청의 쿠키를 확인해 로그인된 교육생을 돌려줍니다. 없으면 null.
export async function getAuthorizedStudent() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('student_sid')?.value;
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed.id) return null;

  const db = supabaseAdmin();
  const { data } = await db.from('students').select('id,name').eq('id', parsed.id).maybeSingle();
  return data || null;
}
