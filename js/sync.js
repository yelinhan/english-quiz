// 서버 동기화 엔진. localStorage가 항상 원본(오프라인 우선)이고,
// 로그인 상태면 시작 시 서버와 병합(pull), 이후 변경 키만 debounce로 push.
// 서버 모델: user_data 컬렉션에 (user, key)당 레코드 1개, value는 JSON.
import { auth, api } from './auth.js';

const SYNC_KEYS = [
  'eq.srsVersion', 'eq.srs', 'eq.log', 'eq.custom', 'eq.overrides',
  'eq.deleted', 'eq.corrections', 'eq.writingDays', 'eq.goal',
];
const PUSH_DELAY = 1500;

// sync 자체의 로컬 읽기/쓰기는 store를 거치지 않음 (onWrite 재귀 방지)
const localGet = (k) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? undefined : JSON.parse(v);
  } catch {
    return undefined;
  }
};
const localSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// 정규화 직렬화: 객체 키를 정렬해서 비교. PocketBase가 JSON 저장 시
// 키를 알파벳순으로 재정렬하므로, 순서 민감한 비교는 왕복 후 오탐이 난다.
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const eq = (a, b) => canon(a) === canon(b);

// ---------- 키별 병합 규칙 ----------
// 타임스탬프가 없으므로 "잃어버리지 않는" 쪽으로 병합: 배열은 합집합, srs는 진행이 더 된 쪽.
// 같은 항목이 양쪽에 다 있을 때는 서버 우선(마지막으로 push한 기기가 최신일 확률이 높음).

// 다중집합 합집합: 항목별 등장 횟수를 max로 유지 (동기화로 인한 중복 방지 + 정당한 중복 보존)
function unionMultiset(a, b) {
  const cnt = new Map();
  for (const x of a) {
    const k = canon(x);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const seen = new Map();
  const out = [...a];
  for (const x of b) {
    const k = canon(x);
    seen.set(k, (seen.get(k) || 0) + 1);
    if (seen.get(k) > (cnt.get(k) || 0)) out.push(x);
  }
  return out;
}

// id 있는 카드 배열: 서버 순서 유지 + 로컬에만 있는 것 뒤에 붙임 (id 겹치면 서버 우선)
function mergeById(local, server) {
  const ids = new Set(server.map((c) => c.id));
  return [...server, ...local.filter((c) => !ids.has(c.id))];
}

function mergeKey(key, local, server) {
  if (server === undefined) return local;
  if (local === undefined) return server;
  switch (key) {
    case 'eq.srsVersion':
      return Math.max(local, server);
    case 'eq.srs': {
      // 카드별로 복습이 더 진행된 레코드 선택 (reps는 단조 증가)
      const out = { ...local };
      for (const [id, rec] of Object.entries(server)) {
        const l = out[id];
        if (!l) { out[id] = rec; continue; }
        const lr = l.reps || 0, sr = rec.reps || 0;
        if (sr > lr || (sr === lr && (rec.due || '') >= (l.due || ''))) out[id] = rec;
      }
      return out;
    }
    case 'eq.log':
      return unionMultiset(local, server)
        .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    case 'eq.writingDays':
      return [...new Set([...local, ...server])].sort();
    case 'eq.deleted':
      return [...new Set([...local, ...server])];
    case 'eq.custom':
      return mergeById(local, server);
    case 'eq.overrides':
      return { ...local, ...server };
    case 'eq.corrections':
      return unionMultiset(local, server)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 50);
    default:
      return server;
  }
}

// ---------- 동기화 엔진 ----------
const recordIds = {};   // key → 서버 레코드 id
const serverVals = {};  // key → 마지막으로 확인한 서버 값
const dirty = new Set();
let pushTimer = null;
let listeners = [];

export const sync = {
  state: { status: 'idle', error: null }, // idle | syncing | ok | error | offline

  subscribe(fn) {
    listeners.push(fn);
  },

  // 앱 시작·로그인 직후 1회: 서버 전체 pull → 키별 병합 → 달라진 것 push.
  // 병합으로 로컬이 바뀌었으면 onApplied() 호출 (화면 갱신용).
  async start(onApplied) {
    if (!auth.isLoggedIn()) return;
    setState('syncing');
    try {
      const list = await api('/api/collections/user_data/records?perPage=500&skipTotal=1');
      for (const rec of list.items) {
        recordIds[rec.key] = rec.id;
        serverVals[rec.key] = rec.value;
      }
      let changedLocal = false;
      for (const key of SYNC_KEYS) {
        const local = localGet(key);
        const server = serverVals[key];
        const merged = mergeKey(key, local, server);
        if (merged === undefined) continue;
        if (!eq(merged, local)) {
          localSet(key, merged);
          changedLocal = true;
        }
        if (!eq(merged, server)) dirty.add(key);
      }
      if (changedLocal && onApplied) onApplied();
      await flush();
      setState('ok');
    } catch (e) {
      setState(navigator.onLine === false || !e.status ? 'offline' : 'error', e.message);
    }
  },

  // store.js 쓰기 훅: 동기화 대상 키면 debounce 후 push
  onChange(key) {
    if (!auth.isLoggedIn() || !SYNC_KEYS.includes(key)) return;
    dirty.add(key);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => flush().catch(() => {}), PUSH_DELAY);
  },

  flush,

  // 로그아웃 시: 서버 상태 캐시 비움 (로컬 데이터는 그대로 둠)
  reset() {
    clearTimeout(pushTimer);
    dirty.clear();
    for (const k of Object.keys(recordIds)) delete recordIds[k];
    for (const k of Object.keys(serverVals)) delete serverVals[k];
    setState('idle');
  },
};

function setState(status, error = null) {
  sync.state = { status, error };
  for (const fn of listeners) fn(sync.state);
}

async function flush() {
  if (!auth.isLoggedIn() || !dirty.size) return;
  const keys = [...dirty];
  dirty.clear();
  try {
    for (const key of keys) {
      const value = localGet(key);
      if (value === undefined || eq(value, serverVals[key])) continue;
      if (recordIds[key]) {
        await api(`/api/collections/user_data/records/${recordIds[key]}`, {
          method: 'PATCH',
          body: { value },
        });
      } else {
        try {
          const rec = await api('/api/collections/user_data/records', {
            method: 'POST',
            body: { user: auth.user().id, key, value },
          });
          recordIds[key] = rec.id;
        } catch (e) {
          // (user, key) 유니크 충돌 — 다른 기기가 먼저 만듦 → id 찾아서 PATCH
          if (e.status !== 400) throw e;
          const list = await api(
            `/api/collections/user_data/records?perPage=1&skipTotal=1&filter=${encodeURIComponent(`key='${key}'`)}`);
          if (!list.items.length) throw e;
          recordIds[key] = list.items[0].id;
          await api(`/api/collections/user_data/records/${recordIds[key]}`, {
            method: 'PATCH',
            body: { value },
          });
        }
      }
      serverVals[key] = value;
    }
    if (sync.state.status !== 'syncing') setState('ok');
  } catch (e) {
    // 실패한 키는 다시 dirty로 — 다음 변경·재시작 때 재시도
    for (const k of keys) if (!eq(localGet(k), serverVals[k])) dirty.add(k);
    if (sync.state.status !== 'syncing') {
      setState(navigator.onLine === false || !e.status ? 'offline' : 'error', e.message);
    }
    throw e;
  }
}

// 화면을 벗어날 때 미뤄둔 push를 바로 시도
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty.size) {
      clearTimeout(pushTimer);
      flush().catch(() => {});
    }
  });
}
