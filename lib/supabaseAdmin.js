import { createClient } from '@supabase/supabase-js';

let client = null;

// Next.js는 fetch() 호출을 기본적으로 캐싱할 수 있는데, supabase-js도 내부적으로
// fetch를 사용하므로 명시적으로 캐시를 끄지 않으면 관리자 화면에 오래된(빈) 데이터가
// 보일 수 있습니다. cache: 'no-store'로 항상 최신 데이터를 가져오도록 강제합니다.
function noStoreFetch(url, options = {}) {
  return fetch(url, { ...options, cache: 'no-store' });
}

export function supabaseAdmin() {
  if (client) return client;
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch }
  });
  return client;
}
