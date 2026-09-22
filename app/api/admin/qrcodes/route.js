export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';

const BUCKET = 'qr-codes';

async function requireAdmin() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const db = supabaseAdmin();
  const { data, error } = await db.from('qr_codes').select('*').order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ qrCodes: data });
}

// multipart/form-data: fields "key" (attendance|submit), "file" (image)
export async function POST(req) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const form = await req.formData();
  const key = form.get('key');
  const file = form.get('file');

  if (!key || !file || typeof file === 'string') {
    return NextResponse.json({ error: 'key와 file이 필요합니다.' }, { status: 400 });
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'png';
  const path = `${key}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  // 캐시 우회용 타임스탬프를 붙여서, 같은 파일명으로 재업로드해도 브라우저가 즉시 새 이미지를 보여주게 합니다.
  const imageUrl = pub.publicUrl + '?t=' + Date.now();

  const { error: dbErr } = await db.from('qr_codes').update({ image_url: imageUrl }).eq('key', key);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, imageUrl });
}
