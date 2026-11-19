import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { verifySession } from './session';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// 현재 요청의 쿠키를 확인해 로그인된 관리자를 돌려줍니다. 없으면 null.
export async function getAuthorizedAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('admin_session')?.value;
  if (!raw) return null;

  // 서명이 맞는 쿠키만 인정 (직접 만든 값은 null)
  const parsed = verifySession(raw);
  if (!parsed) return null;

  if (parsed.id === 'master') {
    if (!process.env.ADMIN_PASSWORD) return null;
    return { id: 'master', name: '마스터관리자', course_ids: null };
  }

  if (!parsed.id) return null;
  const db = supabaseAdmin();
  const { data } = await db.from('admins').select('id,name,course_ids').eq('id', parsed.id).maybeSingle();
  return data || null;
}
