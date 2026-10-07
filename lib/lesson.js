// 회차별 세부 내용(sessions.detail) 공개 규칙과 표시용 파서.

// 한국 시간(Asia/Seoul) 기준 오늘 날짜 'YYYY-MM-DD'
export function kstToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function shiftDate(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// 수업 하루 전 0시(한국 시간)부터 공개
export function lessonOpenDate(sessionDate) {
  return shiftDate(sessionDate, -1);
}

export function isLessonOpen(sessionDate, today = kstToday()) {
  return today >= lessonOpenDate(sessionDate);
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export function fmtKoreanDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}.${d}(${wd})`;
}

const TIME_ROW = /^(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\s*\|([^|]*)(?:\|(.*))?$/;

// "## 제목" 로 구역을 나누고, "시작~끝 | 내용" 줄은 시간표로 해석합니다.
// 내용 칸 안의 " / " 는 줄바꿈으로 표시합니다. 세 번째 칸(진행 방식)이 있어도 화면에는 표시하지 않습니다.
export function parseDetail(text) {
  const sections = [];
  let cur = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    const head = line.match(/^##\s+(.+)$/);
    if (head) {
      cur = { title: head[1].trim(), paragraphs: [], rows: [] };
      sections.push(cur);
      continue;
    }
    if (!line.trim()) continue;
    if (!cur) {
      cur = { title: '', paragraphs: [], rows: [] };
      sections.push(cur);
    }
    const row = line.match(TIME_ROW);
    if (row) {
      cur.rows.push({
        start: row[1], end: row[2],
        items: row[3].split(' / ').map((s) => s.trim()).filter(Boolean),
        method: (row[4] || '').trim()
      });
    } else {
      cur.paragraphs.push(line.trim());
    }
  }
  return sections;
}

// 시간표의 첫 시작~마지막 종료 (예: "19:00~21:00"). 없으면 ''.
export function lessonTimeRange(text) {
  const rows = parseDetail(text).flatMap((s) => s.rows);
  if (!rows.length) return '';
  return `${rows[0].start}~${rows[rows.length - 1].end}`;
}
