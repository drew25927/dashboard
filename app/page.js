import { redirect } from 'next/navigation';
import StudentDashboard from './_components/StudentDashboard';
import { getAuthorizedAdmin } from '../lib/adminAuth';
import { getAuthorizedStudent } from '../lib/studentAuth';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 하루 3번 시각이 지난 뒤 첫 접속 때 백그라운드로 드라이브를 읽음

// 접근 규칙:
// 1) 관리자로 로그인한 상태 + ?id= 가 있으면 → 해당 학생 화면 미리보기(관리자 전용)
// 2) 교육생으로 로그인한 상태 → 본인 화면 (URL의 id는 무시)
// 3) 둘 다 아니면 → 로그인 페이지로 이동
export default async function RootPage({ searchParams }) {
  const sp = await searchParams;
  const previewId = sp?.id;

  const [admin, student] = await Promise.all([getAuthorizedAdmin(), getAuthorizedStudent()]);

  if (student) {
    return <StudentDashboard id={student.id} />;
  }

  if (admin) {
    if (previewId) {
      // 담당 교육이 아닌 교육의 교육생 화면은 미리볼 수 없다 (마스터는 전부 가능)
      if (admin.id !== 'master') {
        const { data: s } = await supabaseAdmin().from('students').select('course_id').eq('id', String(previewId)).maybeSingle();
        if (!s || !(admin.course_ids || []).includes(s.course_id)) redirect('/admin');
      }
      return <StudentDashboard id={previewId} previewMode />;
    }
    redirect('/admin');
  }

  redirect('/login');
}
