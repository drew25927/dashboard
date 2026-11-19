// 과제 관련 공통 규칙 (브라우저·서버 양쪽에서 가져다 씀)
// 교육별로 "필수 과제가 없는 회차". 기존 교육(main)은 16회차가 해당, 다른 교육은 모든 회차에 과제가 있는 것으로 본다.
const NO_ASSIGNMENT = { main: [16] };

export function hasAssignment(sessionN, courseId = 'main') {
  return !(NO_ASSIGNMENT[courseId] || []).includes(Number(sessionN));
}
