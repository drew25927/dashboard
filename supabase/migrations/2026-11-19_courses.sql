-- 교육(과정)별 운영: 교육 구분 칸(course_id) 추가
-- 기존 데이터는 전부 'main' 교육(= AI 영상 제작 전문가 과정)으로 이어집니다.
-- 이전 코드도 그대로 동작하도록(칸 기본값 'main') 만든 변경입니다. 새 코드 배포 뒤 별도 SQL로 기본값을 제거합니다.

begin;

create table if not exists courses (
  id text primary key,
  name text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
alter table courses enable row level security;

insert into courses (id, name, sort)
  select 'main', coalesce(nullif(course_title, ''), 'AI 영상 제작 전문가 과정'), 0 from settings where id = 'main'
  on conflict (id) do nothing;
insert into courses (id, name, sort) values ('main', 'AI 영상 제작 전문가 과정', 0) on conflict (id) do nothing;

-- 과정명·공지는 id = 교육 id 로 한 행씩
alter table settings drop constraint if exists settings_course_fk;
alter table settings add constraint settings_course_fk foreign key (id) references courses(id) on delete cascade;
alter table notice drop constraint if exists notice_course_fk;
alter table notice add constraint notice_course_fk foreign key (id) references courses(id) on delete cascade;

-- 교육생: 번호(id)는 전체에서 유일하게 유지, 어느 교육 소속인지만 추가
alter table students add column if not exists course_id text not null default 'main' references courses(id) on delete cascade;
create index if not exists students_course_idx on students (course_id);

-- 회차: (교육, 회차번호)가 기본키
alter table sessions add column if not exists course_id text not null default 'main' references courses(id) on delete cascade;
alter table attendance add column if not exists course_id text not null default 'main';
alter table attendance drop constraint if exists attendance_session_n_fkey;
alter table sessions drop constraint if exists sessions_pkey;
alter table sessions add primary key (course_id, n);
alter table attendance drop constraint if exists attendance_session_fkey;
alter table attendance add constraint attendance_session_fkey
  foreign key (course_id, session_n) references sessions (course_id, n) on delete cascade;

-- 안내 버튼 · QR
alter table links add column if not exists course_id text not null default 'main' references courses(id) on delete cascade;
alter table links drop constraint if exists links_pkey;
alter table links add primary key (course_id, key);
alter table qr_codes add column if not exists course_id text not null default 'main' references courses(id) on delete cascade;
alter table qr_codes drop constraint if exists qr_codes_pkey;
alter table qr_codes add primary key (course_id, key);

-- 질문 게시판
alter table questions add column if not exists course_id text not null default 'main' references courses(id) on delete cascade;
create index if not exists questions_course_idx on questions (course_id, created_at);

-- 관리자별 담당 교육 (마스터는 전체 접근이라 이 칸을 쓰지 않음). 기존 관리자는 기존 교육 담당.
alter table admins add column if not exists course_ids text[] not null default '{}';
update admins set course_ids = '{main}' where course_ids = '{}';

commit;

-- (같은 날 추가) 교육별 구글 드라이브 과제 폴더 ID. 'main' 은 비워 두면 기존 기본 폴더를 사용.
alter table courses add column if not exists drive_folder_id text not null default '';
