import StudentDashboard from '../_components/StudentDashboard';

export const dynamic = 'force-dynamic';

// 링크 형식: https://.../id=101  (물음표 없는 경로 방식)
export default async function StudentByPathPage({ params }) {
  const { idparam } = await params;
  const decoded = decodeURIComponent(idparam || '');
  const match = /^id=(.+)$/.exec(decoded);
  const id = match ? match[1] : null;
  return <StudentDashboard id={id} />;
}
