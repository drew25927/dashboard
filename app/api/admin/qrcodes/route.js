export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminCourse } from '../../../../lib/courses';

const BUCKET = 'qr-codes';

export async function GET(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const db = supabaseAdmin();
  const { data, error } = await db.from('qr_codes').select('*').eq('course_id', courseId).order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ qrCodes: data });
}

// QR 클릭 시 이동할 링크 저장. 스킴이 없으면 https://를 붙이고, http(s) 외 스킴은 막습니다.
export async function PUT(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

  const { key, linkUrl } = await req.json();
  if (!key) return NextResponse.json({ error: 'key가 필요합니다.' }, { status: 400 });

  let value = (linkUrl || '').trim();
  if (value && !/^https?:\/\//i.test(value)) value = 'https://' + value;

  const db = supabaseAdmin();
  const { error } = await db.from('qr_codes').update({ link_url: value || null }).eq('course_id', courseId).eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, linkUrl: value || null });
}

// multipart/form-data: fields "key" (attendance|submit), "file" (image)
export async function POST(req) {
  const { error: authErr, courseId } = await requireAdminCourse(req);
  if (authErr) return authErr;

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
  // 교육별로 파일이 겹치지 않게 (기존 교육은 예전 이름 그대로)
  const path = courseId === 'main' ? `${key}.${ext}` : `${courseId}-${key}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  // 캐시 우회용 타임스탬프를 붙여서, 같은 파일명으로 재업로드해도 브라우저가 즉시 새 이미지를 보여주게 합니다.
  const imageUrl = pub.publicUrl + '?t=' + Date.now();

  const { error: dbErr } = await db.from('qr_codes').update({ image_url: imageUrl }).eq('course_id', courseId).eq('key', key);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, imageUrl });
}
