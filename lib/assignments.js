// 과제 관련 공통 규칙 (브라우저·서버 양쪽에서 가져다 씀)
const NO_ASSIGNMENT = [16]; // 16회차는 별도 필수 과제 없음

export function hasAssignment(sessionN) {
  return !NO_ASSIGNMENT.includes(Number(sessionN));
}
