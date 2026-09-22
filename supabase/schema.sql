-- AI 영상 제작 전문가 과정 출결 시스템 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor에 이 파일 내용을 통째로 붙여넣고 실행하세요.

create table if not exists students (
  id text primary key,
  name text not null default '',
  contact text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  n integer primary key,
  date date not null,
  type text not null,
  hours numeric not null,
  topic text not null default ''
);

create table if not exists attendance (
  student_id text not null references students(id) on delete cascade,
  session_n integer not null references sessions(n) on delete cascade,
  status text not null default '',
  recognized_hours numeric not null default 0,
  primary key (student_id, session_n)
);

-- 담당자별 로그인 계정 (이름 + 비밀번호 해시). 최초 마스터 로그인은 ADMIN_PASSWORD 환경변수로 계속 가능.
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- 학생용 페이지의 안내 버튼(Zoom, 장소 안내 등) — 관리자 화면에서 라벨/URL 수정 가능
create table if not exists links (
  key text primary key,
  label text not null,
  url text not null default '#'
);

-- RLS 활성화 + 정책 없음 = anon/public 키로는 아무것도 읽고 쓸 수 없음.
-- 앱 서버(Next.js API 라우트)가 service_role 키로만 접근하므로 이걸로 충분히 안전합니다.
alter table students enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;
alter table admins enable row level security;
alter table links enable row level security;

insert into links (key, label, url) values
  ('zoom',   '온라인 강의실 입장 (Zoom)', '#'),
  ('venue',  '오프라인 장소 안내', '#'),
  ('office', '운영사무국 문의', '#'),
  ('submit', '결과물 제출 안내', '#'),
  ('notice', '공지사항 · 자료실', '#'),
  ('replay', '강의 다시보기 (녹화본)', '#')
on conflict (key) do nothing;

-- 학생용 페이지의 QR 코드 이미지 (관리자 화면에서 업로드). image_url은 Supabase Storage 공개 URL.
create table if not exists qr_codes (
  key text primary key,
  label text not null,
  image_url text
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
  (1,  '2026-10-06', '온라인',   2, '멀티 AI 영상툴 심화 비교'),
  (2,  '2026-10-08', '온라인',   2, '씬 일관성·캐릭터 지속성 고급기법'),
  (3,  '2026-10-13', '온라인',   2, '카메라워크·구도 연출 문법'),
  (4,  '2026-10-15', '온라인',   2, '장르별 스토리텔링 기획'),
  (5,  '2026-10-17', '오프라인', 4, '통합실습 - 멀티툴 촬영(생성)'),
  (6,  '2026-10-20', '온라인',   2, '음악 생성 심화'),
  (7,  '2026-10-22', '온라인',   2, '보이스·더빙 심화'),
  (8,  '2026-10-27', '온라인',   2, '편집 워크플로우 자동화'),
  (9,  '2026-10-29', '온라인',   2, '색보정·사운드 믹싱'),
  (10, '2026-10-31', '오프라인', 4, '통합실습 - 사운드·편집'),
  (11, '2026-11-10', '온라인',   2, 'AI 업스케일링'),
  (12, '2026-11-12', '온라인',   2, '멀티포맷 최적화'),
  (13, '2026-11-17', '온라인',   2, '장르별 심화 연출'),
  (14, '2026-11-19', '온라인',   2, '최종 편집 점검 & 크로스 피드백'),
  (15, '2026-11-21', '오프라인', 4, '통합실습 - 최종 마무리'),
  (16, '2026-11-28', '오프라인', 4, '완성 및 발표')
on conflict (n) do nothing;
