// 교육(과정)별 운영 공통 모듈.
// - 교육 id: 기존 교육은 'main', 새 교육은 'c-xxxxxx'. 파일 이름에도 쓰므로 영문 소문자·숫자·하이픈만 허용.
// - 관리자 API는 요청 헤더 x-course(또는 ?course=)로 교육을 고르고, 그 관리자가 접근 가능한 교육인지 서버에서 검사한다.
// - 교육생은 본인이 속한 교육(students.course_id)만 본다.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';
import { getAuthorizedAdmin } from './adminAuth';
import { getAuthorizedStudent } from './studentAuth';

export const MAIN_COURSE = 'main';
export const COURSE_ID_RE = /^[a-z0-9-]{1,40}$/;

export function newCourseId() {
  return 'c-' + Math.random().toString(36).slice(2, 8);
}

// 저장소(JSON 파일) 이름: 기존 교육은 예전 이름 그대로, 새 교육은 교육 id를 붙인다.
export function storeName(base, courseId) {
  return !courseId || courseId === MAIN_COURSE ? base + '.json' : base + '-' + courseId + '.json';
}

export async function listCourses() {
  const { data } = await supabaseAdmin().from('courses').select('id,name,sort,created_at,drive_folder_id').order('sort').order('created_at');
  return data || [];
}

export async function getCourse(courseId) {
  const { data } = await supabaseAdmin().from('courses').select('id,name,sort,drive_folder_id').eq('id', courseId).maybeSingle();
  return data || null;
}

// 이 관리자가 열 수 있는 교육 목록 (마스터는 전체)
export async function coursesForAdmin(admin) {
  const all = await listCourses();
  if (!admin || admin.id === 'master') return all;
  const mine = new Set(admin.course_ids || []);
  return all.filter((c) => mine.has(c.id));
}

// 관리자 API 공통 시작부: 로그인 확인 + 교육 선택 확인.
// 반환: { admin, courseId } 또는 { error: NextResponse }
export async function requireAdminCourse(req) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const asked = req.headers.get('x-course') || new URL(req.url).searchParams.get('course') || '';
  const isMaster = admin.id === 'master';
  const mine = admin.course_ids || [];
  const courseId = asked || (isMaster ? MAIN_COURSE : mine[0] || '');

  if (!courseId || !COURSE_ID_RE.test(courseId)) {
    return { error: NextResponse.json({ error: '담당 교육이 지정되지 않았습니다. 마스터에게 문의해 주세요.' }, { status: 403 }) };
  }
  if (!isMaster && !mine.includes(courseId)) {
    return { error: NextResponse.json({ error: '이 교육에 접근할 수 없습니다.' }, { status: 403 }) };
  }
  return { admin, courseId };
}

// 마스터 전용 API 시작부
export async function requireMasterAdmin() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (admin.id !== 'master') return { error: NextResponse.json({ error: '마스터 계정만 접근할 수 있습니다.' }, { status: 403 }) };
  return { admin };
}

// 이 학생이 해당 교육 소속인지 (관리자 API에서 다른 교육 학생을 건드리지 못하게 막는 용도)
export async function studentInCourse(studentId, courseId) {
  if (!studentId) return false;
  const { data } = await supabaseAdmin().from('students').select('id').eq('id', String(studentId)).eq('course_id', courseId).maybeSingle();
  return Boolean(data);
}

// 화면(서버 컴포넌트·공개 API)에서 "지금 보는 사람의 교육"을 정한다.
// 우선순위: 로그인한 교육생 → ?id=(교육생 번호) → 관리자가 고른 ?course= → 기존 교육
export async function viewerCourse({ studentId, courseParam } = {}) {
  const student = await getAuthorizedStudent();
  if (student?.course_id) return student.course_id;

  if (studentId) {
    const { data } = await supabaseAdmin().from('students').select('course_id').eq('id', String(studentId)).maybeSingle();
    if (data?.course_id) return data.course_id;
  }

  if (courseParam && COURSE_ID_RE.test(courseParam)) {
    const admin = await getAuthorizedAdmin();
    if (admin && (admin.id === 'master' || (admin.course_ids || []).includes(courseParam))) return courseParam;
  }
  return MAIN_COURSE;
}

// 새 교육의 기본 안내 버튼 · QR (기존 교육과 같은 구성)
export const DEFAULT_LINKS = [
  { key: 'zoom', label: '온라인 강의실 입장 (Zoom)', url: '#', type: 'link', content: '' },
  { key: 'venue', label: '오프라인 장소 안내', url: '#', type: 'link', content: '' },
  { key: 'office', label: '관리자 문의', url: '#', type: 'board', content: '' },
  { key: 'submit', label: '결과물 제출 안내', url: '#', type: 'page', content: '결과물 제출 방법을 안내합니다.' },
  { key: 'notice', label: '공지사항 · 자료실', url: '#', type: 'page', content: '공지사항과 자료실 안내입니다.' },
  { key: 'replay', label: '강의 다시보기 (녹화본)', url: '#', type: 'page', content: '지난 강의 다시보기 방법을 안내합니다.' },
  { key: 'feedback', label: '과제 피드백', url: '#', type: 'feedback', content: '' }
];
export const DEFAULT_QR = [
  { key: 'attendance', label: '출석체크 QR' },
  { key: 'submit', label: '만족도 조사 QR' }
];

// 구글 드라이브 폴더 주소(또는 ID)에서 폴더 ID만 뽑는다. 알아볼 수 없으면 ''.
export function parseDriveFolderId(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(s) || /[?&]id=([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : '';
}
