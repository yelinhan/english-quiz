// 초기화, 데이터 로드, 탭 라우팅, 헤더
import { store } from './store.js';
import { migrate } from './srs.js';
import { todayCount, computeStreak } from './stats.js';
import * as home from './home.js';
import * as quiz from './quiz.js';
import * as cloze from './cloze.js';
import * as writing from './writing.js';
import * as lessons from './lessons.js';
import * as tutor from './tutor.js';
import * as browse from './browse.js';
import * as stats from './stats.js';
import { initPicker } from './picker.js';

const views = { home, quiz, cloze, writing, lessons, tutor, browse, stats };
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

function reloadCards() {
  ctx.cards = [...vocabBase, ...store.custom()];
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

function initSettings() {
  const dlg = document.getElementById('settings');
  document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('apiKeyInput').value = store.apiKey();
    document.getElementById('goalInput').value = store.goal();
    dlg.showModal();
  };
  document.getElementById('closeSettings').onclick = () => dlg.close();
  document.getElementById('saveSettings').onclick = () => {
    store.saveApiKey(document.getElementById('apiKeyInput').value.trim());
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
  vocabBase = await loadJson('data/vocab.json', []);
  ctx.lessons = await loadJson('data/lessons.json', []);
  ctx.feedback = await loadJson('data/feedback.json', []);
  reloadCards();

  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.onclick = () => show(b.dataset.view);
  });
  document.getElementById('statsBtn').onclick = () => show('stats');
  initSettings();
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
}

main();
