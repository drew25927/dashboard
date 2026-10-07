-- AI 영상 제작 전문가 과정 출결 시스템 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor에 이 파일 내용을 통째로 붙여넣고 실행하세요.

create table if not exists students (
  id text primary key,
  name text not null default '',
  contact text not null default '',
  email text not null default '',
  password_hash text,
  feedback_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  n integer primary key,
  date date not null,
  type text not null,
  hours numeric not null,
  topic text not null default ''
);

-- 회차별 세부 내용 (수업 하루 전부터 교육생에게 공개, 관리자 "회차 일정" 탭에서 작성)
alter table sessions add column if not exists detail text not null default '';

create table if not exists attendance (
  student_id text not null references students(id) on delete cascade,
  session_n integer not null references sessions(n) on delete cascade,
  status text not null default '',
  recognized_hours numeric not null default 0,
  primary key (student_id, session_n)
);

-- 과정명/부제 등 전역 설정 (관리자 화면 "과정 정보" 탭에서 수정)
create table if not exists settings (
  id text primary key default 'main',
  course_title text not null default '',
  course_sub text not null default ''
);
alter table settings enable row level security;

insert into settings (id, course_title, course_sub) values (
  'main',
  'AI 영상 제작 전문가 과정',
  '충북 AI 미디어 전문가 양성 프로그램 · 2026.10.6 ~ 11.28'
) on conflict (id) do nothing;

-- 담당자별 로그인 계정 (이름 + 비밀번호 해시). 최초 마스터 로그인은 ADMIN_PASSWORD 환경변수로 계속 가능.
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- 학생용 페이지의 안내 버튼(Zoom, 장소 안내 등) — 관리자 화면에서 라벨/URL 수정 가능
-- type: 'link'(외부 URL로 이동) | 'page'(사이트 내 설명 페이지) | 'board'(질문 게시판)
create table if not exists links (
  key text primary key,
  label text not null,
  url text not null default '#',
  type text not null default 'link',
  content text not null default ''
);

-- RLS 활성화 + 정책 없음 = anon/public 키로는 아무것도 읽고 쓸 수 없음.
-- 앱 서버(Next.js API 라우트)가 service_role 키로만 접근하므로 이걸로 충분히 안전합니다.
alter table students enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;
alter table admins enable row level security;
alter table links enable row level security;

insert into links (key, label, url, type, content) values
  ('zoom',   '온라인 강의실 입장 (Zoom)', '#', 'link', ''),
  ('venue',  '오프라인 장소 안내', '#', 'link', ''),
  ('office', '관리자 문의', '#', 'board', ''),
  ('submit', '결과물 제출 안내', '#', 'page', '결과물 제출 방법을 안내합니다.'),
  ('notice', '공지사항 · 자료실', '#', 'page', '공지사항과 자료실 안내입니다.'),
  ('replay', '강의 다시보기 (녹화본)', '#', 'page', '지난 강의 다시보기 방법을 안내합니다.'),
  ('feedback', '과제 피드백', '#', 'feedback', '')
on conflict (key) do nothing;

-- 질문 게시판 (관리자 문의)
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  student_id text,
  student_name text not null default '',
  question text not null,
  answer text,
  is_faq boolean not null default false,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table questions enable row level security;

-- 과제 피드백 (관리자가 학생별로 작성, 학생은 답글 가능). 과제 파일 자체는 구글 드라이브에서 받음.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  title text not null default '',
  body text not null,
  author_role text not null default 'admin', -- 'admin' | 'student'
  author_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists feedback_student_idx on feedback (student_id, created_at);
alter table feedback enable row level security;

-- 학생용 페이지의 QR 코드 이미지 (관리자 화면에서 업로드). image_url은 Supabase Storage 공개 URL.
create table if not exists qr_codes (
  key text primary key,
  label text not null,
  image_url text,
  link_url text
);
alter table qr_codes enable row level security;

insert into qr_codes (key, label, image_url) values
  ('attendance', '출석체크 QR', null),
  ('submit', '만족도 조사 QR', null)
on conflict (key) do nothing;

-- 학생용 페이지 상단 공지사항(출석 인정 기준 등). 항상 id='main' 한 행만 사용.
create table if not exists notice (
  id text primary key default 'main',
  content text not null default ''
);
alter table notice enable row level security;

insert into notice (id, content) values (
  'main',
  '[온라인 강의 출석체크]
1단계: QR 제출 + 2단계: ZOOM 캠 활성화 + 3단계: 만족도 조사(목요일)
3단계 요건이 모두 충족되어야 최종 인정

[오프라인 강의 출석체크]
1단계: 강의실 입구 수기 출석부 서명 + 2단계: 당일 현장 QR 제출 + 3단계: 종료 후 만족도 조사
3단계 요건이 모두 충족되어야 최종 인정'
) on conflict (id) do nothing;

-- 16회차 일정 시드 (계획서 기준, 필요하면 나중에 관리자 화면에서 수정 가능)
insert into sessions (n, date, type, hours, topic) values
  (1 , '2026-10-07', '온라인',  2, '오리엔테이션 · 업계 동향'),
  (2 , '2026-10-08', '온라인',  2, '샷·구도·영상문법 + 프롬프트 엔지니어링'),
  (3 , '2026-10-12', '온라인',  2, '아이디어를 영상 기획으로'),
  (4 , '2026-10-15', '온라인',  2, '스토리보드'),
  (5 , '2026-10-17', '오프라인',  4, '기획·스토리보드 실습'),
  (6 , '2026-10-19', '온라인',  2, 'AI 이미지 생성 · 캐릭터 시트'),
  (7 , '2026-10-22', '온라인',  2, 'AI 영상 생성 기초'),
  (8 , '2026-10-26', '온라인',  2, 'AI 영상 생성 심화'),
  (9 , '2026-10-29', '온라인',  2, 'AI 사운드 생성'),
  (10, '2026-10-31', '오프라인',  4, 'AI 생성 통합실습'),
  (11, '2026-11-09', '온라인',  2, '생성 소스 보완·정리'),
  (12, '2026-11-12', '온라인',  2, '편집 기초·가편집'),
  (13, '2026-11-16', '온라인',  2, '편집기술 심화'),
  (14, '2026-11-19', '온라인',  2, '최종 편집·후반'),
  (15, '2026-11-21', '오프라인',  4, '최종 편집 실습'),
  (16, '2026-11-28', '오프라인',  4, '상영·발표')
on conflict (n) do nothing;
