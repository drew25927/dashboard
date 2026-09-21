# AI 영상 제작 전문가 과정 — 출결 시스템

Next.js + Supabase 기반 출결 관리/조회 시스템.

- 관리자(`/admin`): 비밀번호 로그인 후 교육생 명단·회차 일정·출석체크·전체 현황 관리
- 교육생용(`/?id=고유ID`): 개인 출결 현황 실시간 조회 (관리자가 저장하면 즉시 반영)

## 처음 설정하기

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성
2. 왼쪽 메뉴 **SQL Editor** → `supabase/schema.sql` 내용을 통째로 붙여넣고 실행 (테이블 생성 + 16회차 시드)
3. **Project Settings → API**에서 아래 두 값 복사
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키(secret) → `SUPABASE_SERVICE_ROLE_KEY` (절대 외부 노출 금지)

### 2. 로컬 환경변수
`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.example .env.local
```

### 3. 의존성 설치 및 로컬 실행
```bash
npm install
npm run dev
```
http://localhost:3000/admin 에서 관리자 로그인 (`ADMIN_PASSWORD`로 설정한 값)

### 4. 배포 (Vercel)
1. 이 저장소를 GitHub에 push
2. Vercel에서 해당 저장소 Import
3. Vercel 프로젝트 **Settings → Environment Variables**에 `.env.local`과 동일한 3개 값 등록
4. Deploy

배포 후 `https://[프로젝트].vercel.app/?id=101` 형태로 학생별 링크가 만들어집니다.

## 폴더 구조
```
app/
  page.js              교육생용 개인 대시보드 (서버 컴포넌트, 실시간 조회)
  admin/
    login/page.js      관리자 로그인
    page.js            관리자 대시보드 (탭: 출석체크/명단/일정/전체현황)
  api/admin/*           관리자 전용 API (middleware.js가 쿠키로 보호)
lib/
  supabaseAdmin.js      서버 전용 Supabase 클라이언트 (service_role 키 사용)
  calc.js                출석률·수료기준 등 계산 로직 (수료기준 32시간은 여기서 수정)
  config.js              과정명, 안내 버튼 링크
supabase/schema.sql       테이블 정의 + 16회차 시드 데이터
middleware.js              /admin, /api/admin 경로 로그인 보호
```

## 수료 기준 등 상수 변경
`lib/calc.js`의 `COMPLETION_HOURS` (현재 32시간) 수정.

## 안내 버튼 링크 변경
`lib/config.js`의 `LINKS` 객체 수정.
