// 초기화, 데이터 로드, 탭 라우팅, 헤더
import { store, setStoreListener } from './store.js';
import { auth, login, signup, logout, refreshAuth, PB_BASE } from './auth.js';
import { sync } from './sync.js';
import { migrate } from './srs.js';
import { todayCount, computeStreak } from './stats.js';
import * as home from './home.js';
import * as quiz from './quiz.js';
import * as cloze from './cloze.js';
import * as writing from './writing.js';
import * as lessons from './lessons.js';
import * as tutor from './tutor.js';
import * as browse from './browse.js';
import { initPicker } from './picker.js';

const views = { home, quiz, cloze, writing, lessons, tutor, browse };
const ctx = { cards: [], lessons: [], feedback: [], refreshHeader, reloadCards };
let vocabBase = [];
let currentView = 'home';

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// 기본 단어장(모두 공유)은 DB가 원본. 실패(오프라인 등) 시 마지막 캐시 → 번들 파일 순.
async function loadBaseVocab() {
  try {
    const items = [];
    let page = 1;
    for (;;) {
      const res = await fetch(`${PB_BASE}/api/collections/vocab/records?sort=ord&perPage=500&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      items.push(...d.items.map((r) => ({
        id: r.cid, type: r.wtype, ko: r.ko, en: r.en, example: r.example,
        example_ko: r.example_ko, category: r.category, added: r.added, source: r.source,
      })));
      if (page >= d.totalPages) break;
      page++;
    }
    if (items.length) {
      localStorage.setItem('eq.vocabCache', JSON.stringify(items));
      return items;
    }
  } catch { /* 오프라인 또는 DB 미시드 — 폴백으로 */ }
  try {
    const cached = JSON.parse(localStorage.getItem('eq.vocabCache'));
    if (cached && cached.length) return cached;
  } catch { /* 캐시 없음 */ }
  return loadJson('data/vocab.json', []);
}

function reloadCards() {
  // 기본 단어장에 로컬 수정(overrides)·삭제(deleted)를 덧입힌다 (단어장 탭에서 편집)
  const ov = store.overrides();
  const del = new Set(store.deleted());
  ctx.cards = [...vocabBase, ...store.custom()]
    .filter((c) => !del.has(c.id))
    .map((c) => (ov[c.id] ? { ...c, ...ov[c.id] } : c));
}

function refreshHeader() {
  const log = store.log();
  const goal = store.goal();
  const today = todayCount(log);
  document.getElementById('streak').textContent = `🔥 ${computeStreak(log)}일 연속`;
  document.getElementById('todayCount').textContent = `${today} / ${goal}`;
  document.getElementById('progBar').style.width = `${Math.min((today / goal) * 100, 100)}%`;
}

function show(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('on'));
  document.querySelectorAll('.tabbar button').forEach((b) =>
    b.classList.toggle('on', b.dataset.view === name));
  const el = document.getElementById(`view-${name}`);
  el.classList.add('on');
  views[name].render(el, ctx);
  document.getElementById('main').scrollTop = 0;
}

// 서버 pull로 로컬이 바뀌었을 때만 화면 갱신. 학습 세션(퀴즈·빈칸)이나
// 입력 중 화면을 리셋하지 않도록 홈에서만 다시 그린다.
function startSync() {
  return sync.start(() => {
    reloadCards();
    refreshHeader();
    if (currentView === 'home') show('home');
  });
}

const makeMsg = (id) => (t, isErr) => {
  const el = document.getElementById(id);
  el.textContent = t;
  el.classList.toggle('err', !!isErr);
};

// 설정 다이얼로그의 계정 섹션 표시 상태 (게이트·설정 양쪽에서 로그인하므로 모듈 레벨)
function refreshAccountUI() {
  const u = auth.user();
  document.getElementById('accountOut').hidden = !!u;
  document.getElementById('accountIn').hidden = !u;
  if (u) document.getElementById('authWho').textContent = u.username;
}

function showGate(on) {
  document.getElementById('authGate').hidden = !on;
}

// 로그인/회원가입 공통 처리. 성공하면 true.
async function authSubmit(fn, idEl, pwEl, btn, msg) {
  const id = idEl.value.trim();
  const pw = pwEl.value;
  if (!id || !pw) {
    msg('아이디와 비밀번호를 입력해 주세요', true);
    return false;
  }
  btn.disabled = true;
  msg('처리 중...');
  try {
    await fn(id, pw);
    msg('');
    refreshAccountUI();
    await startSync();
    return true;
  } catch (e) {
    msg(`⚠️ ${e.message}`, true);
    return false;
  } finally {
    btn.disabled = false;
  }
}

// 시작 화면: 로그인 전이면 게이트를 띄움. "로그인 없이 계속"은 이번 실행 동안만 기억.
function initAuthGate() {
  const msg = makeMsg('gateMsg');
  const idEl = document.getElementById('gateId');
  const pwEl = document.getElementById('gatePw');
  const loginBtn = document.getElementById('gateLoginBtn');
  const signupBtn = document.getElementById('gateSignupBtn');
  const submit = async (fn, btn) => {
    if (await authSubmit(fn, idEl, pwEl, btn, msg)) showGate(false);
  };
  loginBtn.onclick = () => submit(login, loginBtn);
  signupBtn.onclick = () => submit(signup, signupBtn);
  pwEl.onkeydown = (e) => { if (e.key === 'Enter') submit(login, loginBtn); };
  document.getElementById('gateSkip').onclick = () => {
    sessionStorage.setItem('eq.gateSkipped', '1');
    showGate(false);
  };
  if (!auth.isLoggedIn() && !sessionStorage.getItem('eq.gateSkipped')) showGate(true);
}

function initAccount() {
  const msg = makeMsg('authMsg');

  sync.subscribe((s) => {
    if (!auth.isLoggedIn()) return;
    const label = {
      syncing: '동기화 중...',
      ok: '✅ 서버와 동기화됨',
      offline: '📴 오프라인 — 이 기기에만 저장 중 (연결되면 자동 동기화)',
      error: `⚠️ 동기화 오류: ${s.error || ''}`,
    }[s.status];
    if (label !== undefined) msg(label, s.status === 'error');
  });

  const idEl = document.getElementById('authId');
  const pwEl = document.getElementById('authPw');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  loginBtn.onclick = () => authSubmit(login, idEl, pwEl, loginBtn, msg);
  signupBtn.onclick = () => authSubmit(signup, idEl, pwEl, signupBtn, msg);
  document.getElementById('logoutBtn').onclick = () => {
    logout();
    sync.reset();
    refreshAccountUI();
    msg('로그아웃했어요. 학습 기록은 이 기기에 남아 있어요.');
  };
  refreshAccountUI();
}

function initSettings() {
  const dlg = document.getElementById('settings');
  const providerSel = document.getElementById('aiProviderInput');
  const keyInput = document.getElementById('apiKeyInput');
  const PLACEHOLDER = { anthropic: 'sk-ant-...', openai: 'sk-...', gemini: 'AIza...' };
  let aiKeys = {}; // 다이얼로그 열려 있는 동안의 공급자별 키 버퍼
  const syncKeyField = () => {
    keyInput.value = aiKeys[providerSel.value] || '';
    keyInput.placeholder = PLACEHOLDER[providerSel.value] || '';
  };
  providerSel.onchange = syncKeyField;
  keyInput.oninput = () => { aiKeys[providerSel.value] = keyInput.value.trim(); };
  document.getElementById('settingsBtn').onclick = () => {
    aiKeys = store.aiKeys();
    providerSel.value = store.aiProvider();
    syncKeyField();
    document.getElementById('goalInput').value = store.goal();
    dlg.showModal();
  };
  document.getElementById('closeSettings').onclick = () => dlg.close();
  document.getElementById('saveSettings').onclick = () => {
    aiKeys[providerSel.value] = keyInput.value.trim();
    store.saveAiProvider(providerSel.value);
    store.saveAiKeys(aiKeys);
    const goal = parseInt(document.getElementById('goalInput').value, 10);
    if (goal >= 1) store.saveGoal(goal);
    dlg.close();
    refreshHeader();
    show(currentView);
  };
  document.getElementById('exportData').onclick = () => {
    const dump = {
      exported: new Date().toISOString(),
      srsVersion: store.srsVersion(),
      srs: store.srs(),
      log: store.log(),
      custom: store.custom(),
      corrections: store.corrections(),
      overrides: store.overrides(),
      deleted: store.deleted(),
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chunky-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
}

async function main() {
  migrate();
  vocabBase = await loadBaseVocab();
  ctx.lessons = await loadJson('data/lessons.json', []);
  ctx.feedback = await loadJson('data/feedback.json', []);
  reloadCards();

  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.onclick = () => show(b.dataset.view);
  });
  document.getElementById('statsBtn').onclick = () => show('home');
  initSettings();
  initAccount();
  initAuthGate();
  initPicker(ctx);
  ctx.show = show;
  refreshHeader();
  show('home');

  if ('serviceWorker' in navigator) {
    // 새 서비스워커가 넘겨받으면 한 번 새로고침 — 구/신버전 파일이 섞여 도는 것 방지
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 저장 훅 연결 후 백그라운드 동기화 (첫 화면을 막지 않음)
  setStoreListener(sync.onChange);
  if (await refreshAuth()) {
    await startSync();
  } else if (!auth.isLoggedIn()) {
    // 저장돼 있던 토큰이 만료·폐기된 경우 — 다시 로그인 안내
    refreshAccountUI();
    if (!sessionStorage.getItem('eq.gateSkipped')) showGate(true);
  }
}

main();
