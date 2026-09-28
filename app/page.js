import { redirect } from 'next/navigation';
import StudentDashboard from './_components/StudentDashboard';
import { getAuthorizedAdmin } from '../lib/adminAuth';
import { getAuthorizedStudent } from '../lib/studentAuth';

export const dynamic = 'force-dynamic';

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

  if (admin && previewId) {
    return <StudentDashboard id={previewId} previewMode />;
  }

  redirect('/login');
}
