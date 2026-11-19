-- 새 코드 배포 뒤: course_id 기본값('main')을 없앤다. 교육을 빠뜨린 저장이 조용히 기존 교육으로 들어가지 않고 오류로 드러나게 한다.
alter table students alter column course_id drop default;
alter table sessions alter column course_id drop default;
alter table attendance alter column course_id drop default;
alter table links alter column course_id drop default;
alter table qr_codes alter column course_id drop default;
alter table questions alter column course_id drop default;
