// PocketBase 인증. 토큰·유저 정보는 eq.auth로 이 기기에만 저장.
// 기본 주소는 같은 도메인의 /pb (nginx 프록시). 개발 시 localStorage eq.pbUrl로 재정의 가능.
export const PB_BASE = localStorage.getItem('eq.pbUrl') || '/pb';
const BASE = PB_BASE;

const readAuth = () => {
  try {
    return JSON.parse(localStorage.getItem('eq.auth')) || null;
  } catch {
    return null;
  }
};
const writeAuth = (a) =>
  a ? localStorage.setItem('eq.auth', JSON.stringify(a)) : localStorage.removeItem('eq.auth');

export const auth = {
  user: () => readAuth(),
  isLoggedIn: () => !!readAuth(),
};

// 자주 만나는 PocketBase 에러의 한국어 안내
const KO_MSG = {
  'Value must be unique.': '이미 사용 중인 아이디예요.',
  'Failed to authenticate.': '아이디 또는 비밀번호가 맞지 않아요.',
  'Cannot be blank.': '필수 항목이 비어 있어요.',
};

// PocketBase REST 호출. 실패 시 필드 에러 메시지를 뽑아 Error로 던짐.
export async function api(path, { method = 'GET', body, authed = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const a = readAuth();
  if (authed && a) headers.Authorization = a.token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      const field = err.data && Object.values(err.data)[0];
      msg = (field && field.message) || err.message || msg;
    } catch { /* JSON 아님 — 상태코드 메시지 유지 */ }
    const e = new Error(KO_MSG[msg] || msg);
    e.status = res.status;
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

export async function signup(username, password) {
  await api('/api/collections/users/records', {
    method: 'POST',
    authed: false,
    body: { username, password, passwordConfirm: password },
  });
  return login(username, password);
}

export async function login(username, password) {
  const d = await api('/api/collections/users/auth-with-password', {
    method: 'POST',
    authed: false,
    body: { identity: username, password },
  });
  writeAuth({ token: d.token, id: d.record.id, username: d.record.username });
  return d.record;
}

export function logout() {
  writeAuth(null);
}

// 앱 시작 시 토큰 갱신. 토큰이 무효면 로그아웃, 네트워크 오류(오프라인)면 로그인 유지.
export async function refreshAuth() {
  if (!readAuth()) return false;
  try {
    const d = await api('/api/collections/users/auth-refresh', { method: 'POST' });
    writeAuth({ token: d.token, id: d.record.id, username: d.record.username });
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) writeAuth(null);
  }
  return !!readAuth();
}
