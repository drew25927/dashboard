import StudentDashboard from './_components/StudentDashboard';

export const dynamic = 'force-dynamic';

// 새 링크 형식은 /id=101 (경로 방식)입니다. 이전에 배포된 ?id=101 형식 링크도
// 계속 동작하도록 쿼리 파라미터를 하위 호환으로 지원합니다.
export default async function RootPage({ searchParams }) {
  const sp = await searchParams;
  return <StudentDashboard id={sp?.id} />;
}
