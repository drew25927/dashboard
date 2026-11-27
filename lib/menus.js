// 교육별 메뉴 표시 설정. 생성형 AI 계정 데이터와 따로 저장해, 메뉴를 숨겨도 입력한 내용은 지워지지 않는다.
// 저장 위치: Storage app-data/menu.json (새 교육은 menu-<id>.json)
import { readJson, writeJson } from './appData';
import { storeName } from './courses';

export async function getMenuFlags(courseId = 'main') {
  const v = await readJson(storeName('menu', courseId));
  return { hideAi: Boolean(v?.hideAi) };
}

export async function saveMenuFlags(courseId, flags) {
  await writeJson(storeName('menu', courseId), { hideAi: Boolean(flags.hideAi) });
}
