export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';
import { coursesForAdmin, requireMasterAdmin, newCourseId, storeName, DEFAULT_LINKS, DEFAULT_QR, MAIN_COURSE } from '../../../../lib/courses';
import { kstToday } from '../../../../lib/lesson';

// 로그인한 관리자가 열 수 있는 교육 목록 (마스터는 전체). 관리자 화면 맨 위 "교육 선택"에 쓴다.
export async function GET() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const courses = (await coursesForAdmin(admin)).map(({ id, name }) => ({ id, name }));
  return NextResponse.json({ courses, isMaster: admin.id === 'master' });
}

// 새 교육 만들기 (마스터 전용). body: { name, sessionCount? }
// 교육 정보·공지·안내 버튼·QR 칸을 기본값으로 채우고, sessionCount 만큼 빈 회차를 만든다.
export async function POST(req) {
  const { error } = await requireMasterAdmin();
  if (error) return error;

  const { name, sessionCount } = await req.json();
  const title = String(name || '').trim().slice(0, 80);
  if (!title) return NextResponse.json({ error: '교육 이름을 입력해주세요.' }, { status: 400 });
  const count = Math.max(0, Math.min(40, Number(sessionCount) || 0));

  const db = supabaseAdmin();
  const { data: existing } = await db.from('courses').select('sort');
  const sort = (existing || []).reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1;
  const id = newCourseId();

  const { error: cErr } = await db.from('courses').insert({ id, name: title, sort });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const today = kstToday();
  const steps = [
    db.from('settings').insert({ id, course_title: title, course_sub: '' }),
    db.from('notice').insert({ id, content: '' }),
    db.from('links').insert(DEFAULT_LINKS.map((l) => ({ ...l, course_id: id }))),
    db.from('qr_codes').insert(DEFAULT_QR.map((q) => ({ ...q, course_id: id })))
  ];
  if (count) {
    steps.push(db.from('sessions').insert(Array.from({ length: count }, (_, i) => ({ course_id: id, n: i + 1, date: today, type: '온라인', hours: 2, topic: '' }))));
  }
  const results = await Promise.all(steps);
  const failed = results.find((r) => r.error);
  if (failed) {
    await db.from('courses').delete().eq('id', id); // 연결된 행은 함께 지워진다
    return NextResponse.json({ error: '교육을 만들지 못했습니다: ' + failed.error.message }, { status: 500 });
  }
  return NextResponse.json({ course: { id, name: title } });
}

// 교육 이름 바꾸기 (마스터 전용). body: { id, name }
export async function PUT(req) {
  const { error } = await requireMasterAdmin();
  if (error) return error;

  const { id, name } = await req.json();
  const title = String(name || '').trim().slice(0, 80);
  if (!id || !title) return NextResponse.json({ error: 'id와 이름이 필요합니다.' }, { status: 400 });

  const { error: dbErr } = await supabaseAdmin().from('courses').update({ name: title }).eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 교육 삭제 (마스터 전용). 교육생·출석·질문·피드백·일정이 모두 함께 사라진다. 기존 교육(main)은 삭제할 수 없다.
export async function DELETE(req) {
  const { error } = await requireMasterAdmin();
  if (error) return error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  if (id === MAIN_COURSE) return NextResponse.json({ error: '기존 교육은 삭제할 수 없습니다.' }, { status: 400 });

  const db = supabaseAdmin();
  const { error: dbErr } = await db.from('courses').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // 관리자 담당 목록에서 제거, 교육별 저장 파일·QR 이미지 정리 (실패해도 삭제 자체는 완료)
  const { data: admins } = await db.from('admins').select('id,course_ids');
  for (const a of admins || []) {
    if ((a.course_ids || []).includes(id)) {
      await db.from('admins').update({ course_ids: a.course_ids.filter((c) => c !== id) }).eq('id', a.id);
    }
  }
  await db.storage.from('app-data').remove([storeName('ai-accounts', id), storeName('submissions', id)]).catch(() => {});
  const { data: qrFiles } = await db.storage.from('qr-codes').list('', { search: id + '-' }).catch(() => ({ data: [] }));
  const qrNames = (qrFiles || []).map((f) => f.name).filter((n) => n.startsWith(id + '-'));
  if (qrNames.length) await db.storage.from('qr-codes').remove(qrNames).catch(() => {});
  return NextResponse.json({ ok: true });
}
