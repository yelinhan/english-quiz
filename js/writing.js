// AI 영작 탭: 자유 영작 + 문장 영작(한국어 문장 → 영어로 옮기기)
import { store, todayStr, addDays, esc } from './store.js';
import { correctWriting, gradeTranslation } from './ai.js';
import * as kbd from './keyboard.js';

const PROMPTS = [
  '오늘은 너무 힘든 하루였어요.',
  '요즘 일이 너무 바빠서 정신이 없어요.',
  '어제 늦게 자서 아침에 겨우 일어났어요.',
  '이번 주말에 딱히 계획은 없어요.',
  '점심 뭐 먹을지 아직 못 정했어요.',
  '그 얘기 듣고 진짜 깜짝 놀랐어요.',
  '요즘 운동을 시작했는데 생각보다 재밌어요.',
  '회의가 갑자기 취소돼서 시간이 붕 떴어요.',
  '커피를 안 마시면 하루를 시작 못 해요.',
  '비가 올 것 같아서 우산을 챙겼어요.',
  '새로 온 동료랑 아직 좀 서먹서먹해요.',
  '지하철에서 깜빡 졸다가 내릴 역을 지나쳤어요.',
  '월요일이라 그런지 하루 종일 피곤했어요.',
  '오랜만에 친구를 만나서 수다 떨었어요.',
  '프로젝트 마감이 다가와서 스트레스 받아요.',
  '딱히 이유는 없는데 그냥 기분이 좋아요.',
  '핸드폰을 집에 두고 나와서 하루 종일 불편했어요.',
  '상사가 갑자기 일을 잔뜩 시켰어요.',
  '요즘 드라마에 푹 빠져서 밤늦게까지 봐요.',
  '감기 기운이 살짝 있어서 오늘은 일찍 자려고요.',
  '옷을 얇게 입고 나왔더니 하루 종일 추웠어요.',
  '발표가 생각보다 잘 돼서 다행이었어요.',
  '배달 음식을 너무 자주 시켜 먹는 것 같아요.',
  '주말에 밀린 집안일을 몰아서 했어요.',
  '이 노래가 계속 머릿속에 맴돌아요.',
  '약속에 늦을 뻔했는데 겨우 시간 맞춰 도착했어요.',
  '요즘 잠을 설쳐서 낮에 계속 졸려요.',
  '동료가 도와준 덕분에 일이 빨리 끝났어요.',
  '갑자기 단 게 당겨서 편의점에 다녀왔어요.',
  '내일 면접이 있어서 좀 긴장돼요.',
  '오늘 회의가 3개나 있어서 하루가 순식간에 갔어요.',
  '회의가 길어져서 점심을 늦게 먹었어요.',
  '그 부분은 제가 확인하고 다시 말씀드릴게요.',
  '이번 주까지 끝내야 하는 일이 산더미예요.',
  '메일을 보냈는데 아직 답장이 없어요.',
  '발표 자료를 오늘까지 만들어야 해요.',
  '일정이 빠듯한데 어떻게든 맞춰봐야죠.',
  '재택근무라서 오늘은 출퇴근 시간을 아꼈어요.',
  '회의에서 제 의견을 말할 기회가 없었어요.',
  '동료에게 일을 부탁하기가 좀 미안했어요.',
  '상사한테 보고했더니 방향을 다시 잡으라고 했어요.',
  '마감 직전에 요구사항이 바뀌어서 좀 당황했어요.',
  '이 업무는 우선순위가 낮아서 일단 뒤로 미뤘어요.',
  '오늘 한 실수가 계속 신경 쓰여요.',
];

// 관사(a/the)·시제를 집중적으로 연습하는 세트 — 한국인이 자주 틀리는 함정 위주
const GRAMMAR_PROMPTS = [
  // 관사: a(첫 언급) vs the(아는 것) vs 무관사(일반 복수·식사 등)
  '어제 영화를 봤는데, 그 영화가 생각보다 별로였어요.',
  '저는 원래 영화 보는 걸 좋아해요.',
  '아침에 커피 한 잔 마시면서 하루를 시작해요.',
  '집 근처에 카페가 새로 생겼는데, 거기 커피가 진짜 맛있어요.',
  '강아지를 키우고 싶은데 지금 집이 너무 좁아요.',
  '점심 먹고 나서 산책을 좀 했어요.',
  '해 지는 거 보러 한강에 갔어요.',
  '요즘 기타를 배우기 시작했어요.',
  // 시제: 과거 vs 현재완료, 과거진행, used to, 미래
  '그 식당 가본 적 있어요. 지난달에 한 번 갔었어요.',
  '이 회사에서 일한 지 3년 됐어요.',
  '샤워하고 있는데 택배가 왔어요.',
  '예전에는 커피를 안 마셨는데 요즘은 매일 마셔요.',
  '아직 그 영화 못 봤어요. 이번 주말에 보려고요.',
  '방금 점심 먹었는데 벌써 배고파요.',
  '어렸을 때는 부산에 살았어요.',
  '지금 막 나가려던 참이었어요.',
  '다음 주에 휴가 가요. 벌써 설레요.',
  '핸드폰을 잃어버렸는데 어디서 잃어버렸는지 모르겠어요.',
  // 장소 부사: home/here/there는 to 없이 (go to home ✕ → go home ⭕)
  '이제 집에 가야 해요. 내일 봐요.',
  '어제는 피곤해서 집에 일찍 갔어요.',
  '이리 와서 이것 좀 봐주세요.',
  '지난주에 거기 갔었는데 사람이 진짜 많았어요.',
  '거기까지 어떻게 가요? 지하철로 갈 수 있어요?',
  '집에 오는 길에 마트에 들렀어요.',
  '집에 도착하면 전화할게요.',
  '어제 몇 시에 집에 들어왔어요?',
];

// ---------- 📚 내 표현 세트: 단어장 표현마다 미리 만든 영작 문제 (data/writing_prompts.json) ----------
let minePrompts = null; // { 카드 원래 id: [{ v(표현 번호), ko, en(예시 답안) }] }
const recentMine = []; // 전체 랜덤에서 최근에 낸 문제 — 연달아 같은 문제 방지

function loadMinePrompts() {
  if (minePrompts) return Promise.resolve(minePrompts);
  return fetch('data/writing_prompts.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d) => { minePrompts = d; return d; });
}

// 직접 채점(❌/⭕)에서 틀린 문제: 오늘 순서 3칸 뒤에 다시 + 다음 날부터 맞힐 때까지 복습 (eq.writingReview, 동기화)
const RETRY_AFTER = 4; // 틀린 문제는 3문제 뒤에 다시

// 문제 한국어 → { c(표현별로 나뉜 카드), p(문제) }
function mineIndex(cards) {
  const idx = new Map();
  for (const c of cards) {
    for (const p of minePrompts?.[c.group || c.id] || []) {
      if ((p.v || 0) === (c.v || 0)) idx.set(p.ko, { c, p });
    }
  }
  return idx;
}

// 오늘 복습할 문제 (다음 날로 넘어온 틀린 문제)
function dueReviews(idx) {
  const today = todayStr();
  return Object.entries(store.writingReview())
    .filter(([ko, r]) => !r.done && r.due <= today && idx.has(ko))
    .map(([ko]) => ko);
}

// 아직 졸업 안 한 틀린 문제인지 (🔁 복습 배지)
const pendingReview = (ko) => { const r = store.writingReview()[ko]; return !!r && !r.done; };

const toTarget = ({ c, p }) => ({
  ko: p.ko, answer: p.en, target: c.en, meaning: c.ko, cardId: c.id, koHl: p.ko_hl, enHl: p.en_hl,
  review: pendingReview(p.ko),
});

// 가중치 랜덤 순서 (가중치 클수록 앞쪽에 올 확률이 높음)
function weightedOrder(items) {
  return items
    .map((x) => ({ x, k: Math.random() ** (1 / x.w) }))
    .sort((a, b) => b.k - a.k)
    .map((y) => y.x.ko);
}

// 📚 내 표현 = 퀴즈에서 한 번이라도 푼 카드의 문제만. 자주 틀렸거나 아직 익히는 중인 카드일수록 앞쪽에
function mineCandidates(idx, skip) {
  const srs = store.srs();
  const out = [];
  for (const [ko, x] of idx) {
    const rec = srs[x.c.id];
    if (rec && !skip.has(ko)) out.push({ ko, w: 3 + 3 * (rec.lapses || 0) + (rec.st === 'review' ? 0 : 2) });
  }
  return out;
}

// 오늘의 순서 (eq.writingToday: { date, order: [문제 한국어], pos }) — 하루 처음 열 때 정해서 저장.
// 다른 문장·채점으로 넘어가기 전까지는 새로고침해도 같은 문장. 복습할 문제가 맨 앞,
// 오늘 퀴즈에서 새로 배운 카드의 문제는 뒤에 이어 붙임
function todayPlan(idx, { fresh = false } = {}) {
  const today = todayStr();
  let plan = store.writingToday();
  if (fresh || !plan || plan.date !== today) {
    const due = dueReviews(idx);
    plan = { date: today, order: [...due, ...weightedOrder(mineCandidates(idx, new Set(due)))], pos: 0 };
    store.saveWritingToday(plan);
    return plan;
  }
  const have = new Set(plan.order);
  const added = [
    ...dueReviews(idx).filter((ko) => !have.has(ko)),
    ...weightedOrder(mineCandidates(idx, have)),
  ].filter((ko, i, a) => a.indexOf(ko) === i);
  if (added.length) {
    plan.order.push(...added);
    store.saveWritingToday(plan);
  }
  return plan;
}

// 지금 풀 문제: { t(문제) | done(오늘 순서 끝), pos, total, reviewsLeft }
function mineCurrent(cards, opts) {
  const idx = mineIndex(cards);
  const plan = todayPlan(idx, opts);
  let moved = false;
  while (plan.pos < plan.order.length && !idx.has(plan.order[plan.pos])) { plan.pos++; moved = true; } // 지워진 카드
  if (moved) store.saveWritingToday(plan);
  const rest = plan.order.slice(plan.pos);
  const info = { pos: plan.pos, total: plan.order.length, reviewsLeft: new Set(rest.filter(pendingReview)).size };
  if (plan.pos >= plan.order.length) return { ...info, done: plan.order.length > 0 };
  return { ...info, t: toTarget(idx.get(plan.order[plan.pos])) };
}

// 다음 문장으로. 틀렸으면 그 문제를 오늘 순서 3칸 뒤에 다시 끼워 넣음
function mineAdvance(retryKo) {
  const plan = store.writingToday();
  if (!plan) return;
  if (retryKo) plan.order.splice(Math.min(plan.pos + RETRY_AFTER, plan.order.length), 0, retryKo);
  plan.pos++;
  store.saveWritingToday(plan);
}

// 🎲 전체 랜덤: 안 본 카드까지 모든 카드 문제 + 일반 문장 (최근 20문제는 반복 안 함)
function pickAll(cards) {
  const idx = mineIndex(cards);
  const pool = [...idx.keys(), ...PROMPTS, ...GRAMMAR_PROMPTS].filter((ko) => !recentMine.includes(ko));
  const ko = pool[Math.floor(Math.random() * pool.length)];
  recentMine.push(ko);
  if (recentMine.length > 20) recentMine.shift();
  return idx.has(ko) ? { prompt: ko, target: toTarget(idx.get(ko)) } : { prompt: ko, target: null };
}

// 직접 채점 기록. 틀리면 내일 복습(내 표현은 오늘 순서 3칸 뒤에도 다시), 복습할 날이 된 문제를 맞히면 졸업
// (틀린 당일 다시 풀어 맞힌 건 내일 복습 그대로 — 하루 지나서도 기억나는지 확인)
function gradeMine(t, ok) {
  const rv = store.writingReview();
  const rec = rv[t.ko];
  const today = todayStr();
  if (!ok) {
    rv[t.ko] = { id: t.cardId, fails: (rec?.fails || 0) + 1, due: addDays(today, 1), t: Date.now() };
  } else if (rec && !rec.done && rec.due <= today) {
    rv[t.ko] = { ...rec, done: true, t: Date.now() };
  } else {
    return;
  }
  store.saveWritingReview(rv);
}

// 목표 표현에 해당하는 부분만 색으로 (문제 한국어 ↔ 예시 답안 영어를 같은 색으로 연결)
function markHl(text, hl) {
  const i = hl ? text.indexOf(hl) : -1;
  if (i < 0) return esc(text);
  return `${esc(text.slice(0, i))}<mark class="tr-hl">${esc(hl)}</mark>${esc(text.slice(i + hl.length))}`;
}

// 앱 내장 자판 (빈칸 퀴즈와 같은 자판, 터치 기기만): 맨 위 기능 줄에 문장부호
const PUNCT = [["'", "'"], [',', ','], ['.', '.'], ['?', '?'], ['!', '!']];
const isTouchKbd = () => !matchMedia('(hover: hover) and (pointer: fine)').matches;

// 입력칸에 커서가 있으면 그 자리에, 아니면 맨 끝에
function kbEdit(ta, text) {
  const focused = document.activeElement === ta;
  let s = focused ? ta.selectionStart : ta.value.length;
  const e = focused ? ta.selectionEnd : ta.value.length;
  if (text === null) {
    if (s === e && s > 0) s--;
    text = '';
  }
  ta.setRangeText(text, s, e, 'end');
}

// 힌트 1단계: 단어마다 첫 글자만 (put it on the back burner → p__ i_ o_ t__ b___ b_____)
const maskWords = (s) => s.replace(/[A-Za-z]+/g, (w) => w[0] + '_'.repeat(w.length - 1));

// ---------- 문법 태그 칩 + 설명 카드 ----------
let grammarCards = null; // data/grammar.json 캐시
let lessonsCache = null; // data/lessons.json 캐시 (내 실수 모으기용)

export function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="tag-chips">${tags.map((t) =>
    `<button class="tag-chip" data-tag="${esc(t)}">🏷 ${esc(t)}</button>`).join('')}</div>`;
}

// 이 태그로 지적된 내 실제 문장: 수업 표현 업그레이드 + 영작 첨삭 기록 (최신순)
async function myMistakes(tag) {
  if (!lessonsCache) {
    try {
      lessonsCache = await (await fetch('data/lessons.json', { cache: 'no-cache' })).json();
    } catch {
      lessonsCache = [];
    }
  }
  const out = [];
  lessonsCache.forEach((l) => (l.upgrades || []).forEach((u) => {
    if ((u.tags || []).includes(tag)) out.push({ date: l.date, src: '📞 수업', bad: u.said, good: u.better });
  }));
  store.corrections().forEach((c) => {
    if (c.mode === 'tr') {
      if ((c.result?.tags || []).includes(tag)) {
        out.push({ date: c.date, src: '✍️ 영작', bad: c.input, good: c.result.corrected });
      }
      return;
    }
    (c.result?.corrections || []).forEach((x) => {
      if ((x.tags || []).includes(tag)) out.push({ date: c.date, src: '✍️ 영작', bad: x.original, good: x.corrected });
    });
  });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function showGrammarCard(tag) {
  if (!grammarCards) {
    try {
      grammarCards = await (await fetch('data/grammar.json', { cache: 'no-cache' })).json();
    } catch {
      grammarCards = {};
    }
  }
  const card = grammarCards[tag];
  const mine = await myMistakes(tag);
  let dlg = document.getElementById('grammarDlg');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'grammarDlg';
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = card ? `
    <h2>${esc(card.title)}</h2>
    <p class="g-rule">${esc(card.rule_ko)}</p>
    ${mine.length ? `
      <h3 class="g-head">🗣 내가 실제로 한 말 (${mine.length})</h3>
      ${mine.slice(0, 6).map((m) => `
        <div class="g-ex g-mine">
          <div class="g-bad">✕ ${esc(m.bad)}</div>
          <div class="g-good">⭕ ${esc(m.good)}</div>
          <div class="g-note">${m.src} ${esc(m.date.slice(5).replace('-', '/'))}</div>
        </div>`).join('')}
      <h3 class="g-head">📘 예시</h3>` : ''}
    ${(card.examples || []).map((ex) => `
      <div class="g-ex">
        ${ex.bad ? `<div class="g-bad">✕ ${esc(ex.bad)}</div>` : ''}
        <div class="g-good">⭕ ${esc(ex.good)}</div>
        ${ex.note ? `<div class="g-note">${esc(ex.note)}</div>` : ''}
      </div>`).join('')}
    ${card.why_ko ? `<p class="g-why">💡 ${esc(card.why_ko)}</p>` : ''}
    <button class="primary" id="grammarClose">닫기</button>`
    : `<p class="notice">"${esc(tag)}" 설명 카드가 아직 없어요.</p>
       <button class="primary" id="grammarClose">닫기</button>`;
  dlg.querySelector('#grammarClose').onclick = () => dlg.close();
  dlg.showModal();
}

export function bindTagChips(rootEl) {
  rootEl.querySelectorAll('.tag-chip').forEach((b) => {
    b.onclick = () => showGrammarCard(b.dataset.tag);
  });
}

export function render(el, ctx) {
  let mode = 'tr'; // 탭에 들어올 때마다 문장 영작이 기본
  let set = 'mine'; // mine: 단어장 표현 쓰기, all: 전체 랜덤, grammar: 관사·시제 집중
  let prompt = '';
  let target = null; // mine 세트 문제의 { target(표현), meaning(카드 뜻), answer(예시 답안), koHl·enHl(색칠 구간), review }
  let hint = 0; // 0 숨김 → 1 첫 글자 → 2 표현 → 3 예시 답안
  let revealed = false; // 내 표현: 정답 확인 후 → 직접 채점(✕/⭕)
  let draft = ''; // 다시 그릴 때 쓰던 답 유지
  let mine = null; // 내 표현 오늘 순서 상태 { pos, total, reviewsLeft, done? }

  // 문제 정하기. 내 표현은 저장된 오늘 순서의 현재 칸 (넘기기는 mineAdvance), 나머지는 랜덤
  function pickPrompt(opts) {
    hint = 0;
    revealed = false;
    draft = '';
    mine = null;
    if (set === 'mine') {
      mine = minePrompts ? mineCurrent(ctx.cards, opts) : null;
      target = mine?.t || null;
      prompt = target ? target.ko : '';
      return;
    }
    if (set === 'all') {
      ({ prompt, target } = minePrompts ? pickAll(ctx.cards) : { prompt: '', target: null });
      return;
    }
    target = null;
    prompt = GRAMMAR_PROMPTS[Math.floor(Math.random() * GRAMMAR_PROMPTS.length)];
  }
  // 다른 문장 / 채점 후 다음: 내 표현은 오늘 순서를 한 칸 넘김 (틀렸으면 3칸 뒤에 다시 끼움)
  function nextPrompt(retryKo) {
    if (set === 'mine') mineAdvance(retryKo);
    pickPrompt();
  }

  function hintHtml() {
    if (!target || !hint) return '';
    if (hint === 1) return `💡 ${esc(maskWords(target.target))}`;
    if (hint === 2) return `💡 ${esc(target.target)} <span class="notice">· ${esc(target.meaning)}</span>`;
    return `📘 ${esc(target.answer)}`;
  }
  const hintLabel = () => ['💡 힌트', '💡 표현 보기', '📘 예시 답안', '📘 예시 답안'][hint];
  // AI 첨삭 버튼 (전체 랜덤·관사 세트): 키 있으면 앱에서 첨삭, 없으면 복사해서 Claude에. 내 표현은 직접 채점만
  const aiBtn = () => (store.apiKey()
    ? '<button class="primary" id="submitBtn">첨삭 받기</button>'
    : '<button class="primary" id="copyBtn">📋 복사해서 Claude에 첨삭받기</button>');
  pickPrompt();

  // 정답 확인 후: 내 답 · 목표 표현 · 예시 답안 (목표 표현 부분은 문제의 색칠과 같은 색)
  const revealHtml = () => `
    <div class="tr-reveal">
      ${draft.trim() ? `<div class="tr-row"><span class="tr-label">내 답</span><div class="tr-mine">${esc(draft.trim())}</div></div>` : ''}
      <div class="tr-row"><span class="tr-label">🎯 표현</span>
        <div><b class="tr-hl-text">${esc(target.target)}</b> <span class="notice">· ${esc(target.meaning)}</span></div></div>
      <div class="tr-row"><span class="tr-label">📘 예시</span><div class="tr-answer">${markHl(target.answer, target.enHl)}</div></div>
      <p class="notice" style="margin:10px 0 0">🗣 예시 답안은 소리 내어 3번!</p>
    </div>`;

  function draw() {
    const key = store.apiKey();
    // 칩의 🔁 = 오늘 순서에 남은 복습 문제 (다른 세트일 땐 오늘 복습할 문제 수)
    const dueN = set === 'mine' ? mine?.reviewsLeft || 0 : minePrompts ? dueReviews(mineIndex(ctx.cards)).length : 0;
    const touchKbd = mode === 'tr' && isTouchKbd();
    el.innerHTML = `
      <div class="chip-row">
        <button data-mode="tr" class="${mode === 'tr' ? 'on' : ''}">문장 영작</button>
        <button data-mode="free" class="${mode === 'free' ? 'on' : ''}">자유 영작</button>
      </div>
      ${mode === 'tr' ? `
      <div class="chip-row">
        <button data-set="mine" class="${set === 'mine' ? 'on' : ''}">📚 내 표현${dueN ? ` · 🔁${dueN}` : ''}</button>
        <button data-set="all" class="${set === 'all' ? 'on' : ''}">🎲 전체 랜덤</button>
        <button data-set="grammar" class="${set === 'grammar' ? 'on' : ''}">🎯 관사·시제·전치사 집중</button>
      </div>` : ''}
      ${key || mode === 'tr' ? '' : `
        <div class="card-box notice">
          영작 첨삭에는 AI API 키가 필요해요 (Anthropic·OpenAI·Gemini 중 택 1).<br>
          홈 화면 오른쪽 위 <b>⚙ 설정</b>에서 키를 입력해주세요. (키는 이 기기에만 저장돼요)
        </div>`}
      ${mode === 'free' ? `
        <div class="card-box">
          <p class="notice" style="margin-top:0">오늘 있었던 일이나 하고 싶은 말을 영어로 5문장 써보세요. 문법보다 <b>자연스러움</b> 위주로 첨삭해드려요.</p>
          <textarea id="writingInput" placeholder="I go to company today. It was very busy..."></textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:10px">
            <button class="primary" id="submitBtn" ${key ? '' : 'disabled'}>첨삭 받기</button>
          </div>
        </div>` : `
        <div class="card-box">
          ${set === 'mine' ? '' : `<p class="notice" style="margin-top:0">${set === 'grammar'
            ? '아래 문장을 영어로! <b>관사(a/the)와 시제</b>에 특히 신경 써보세요.'
            : '아래 문장을 영어로 어떻게 말할까요? <b>자연스럽고 캐주얼하게</b> 옮겨보세요.'}</p>`}
          ${set === 'mine' && target ? `<div class="tr-progress">오늘 ${mine.pos + 1} / ${mine.total}</div>` : ''}
          <div class="tr-prompt">${target?.review ? '<span class="tr-badge">🔁 복습</span>' : ''}${target
            ? markHl(prompt, target.koHl)
            : prompt ? esc(prompt)
            : !minePrompts ? '문제 불러오는 중...'
            : mine?.done ? '🎉 오늘 문장을 다 풀었어요!'
            : '퀴즈에서 표현을 배우면 여기서 영작 문제가 나와요'}</div>
          ${target ? `<div class="tr-hint" id="trHint">${revealed ? '' : hintHtml()}</div>` : ''}
          ${prompt ? `<textarea id="writingInput" rows="3" placeholder="영어로 써보세요..." autocomplete="off" autocapitalize="off"
            spellcheck="false" ${touchKbd ? 'inputmode="none"' : ''}>${esc(draft)}</textarea>` : ''}
          ${!prompt ? (mine?.done ? `
          <div class="tr-actions"><span></span><button class="primary" id="restartBtn">🔄 새 순서로 다시</button></div>` : '')
          : target && revealed ? `
          <div class="tr-grade">
            <button class="tr-fail" id="failBtn">❌ Missed it</button>
            <button class="tr-ok" id="okBtn">⭕ Got it</button>
          </div>` : `
          <div class="tr-actions">
            <div class="tr-actions-left">
              <button class="ghost" id="nextPromptBtn">🔄 다른 문장</button>
              ${target ? `<button class="ghost" id="hintBtn">${hintLabel()}</button>` : ''}
            </div>
            ${target ? '<button class="primary" id="revealBtn">✅ 정답 확인</button>' : aiBtn()}
          </div>`}
          ${target && revealed ? revealHtml() : ''}
          ${!prompt || target || key ? '' : '<p class="notice" style="margin-bottom:0">복사한 내용을 Claude에 붙여넣으면 첨삭해줘요. (⚙ 설정에 API 키를 넣으면 앱에서 바로 첨삭돼요)</p>'}
        </div>`}
      <div id="result"></div>
      <div id="history"></div>`;

    el.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => {
        mode = b.dataset.mode;
        draw();
      };
    });
    el.querySelectorAll('[data-set]').forEach((b) => {
      b.onclick = () => {
        set = b.dataset.set;
        pickPrompt();
        draw();
      };
    });

    const resultEl = el.querySelector('#result');
    const nextBtn = el.querySelector('#nextPromptBtn');
    const hintBtn = el.querySelector('#hintBtn');
    const revealBtn = el.querySelector('#revealBtn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        nextPrompt();
        draw();
      };
    }
    const restartBtn = el.querySelector('#restartBtn');
    if (restartBtn) {
      restartBtn.onclick = () => {
        pickPrompt({ fresh: true });
        draw();
      };
    }
    // 다시 그리지 않고 힌트 줄만 갱신 (쓰던 답이 지워지지 않게)
    if (hintBtn) {
      hintBtn.disabled = hint >= 3;
      hintBtn.onclick = () => {
        hint = Math.min(hint + 1, 3);
        el.querySelector('#trHint').innerHTML = hintHtml();
        hintBtn.textContent = hintLabel();
        hintBtn.disabled = hint >= 3;
      };
    }

    // 📚 내 표현: AI 없이 정답 확인 → 내 답 아래에 원래 의도한 표현·예시 답안, 버튼은 직접 채점(❌ Missed it / ⭕ Got it)으로
    const ta = el.querySelector('#writingInput');
    if (revealBtn) {
      revealBtn.onclick = () => {
        draft = ta.value;
        if (draft.trim()) store.markWritingDay(); // 홈 '오늘 할 일' 체크용
        revealed = true;
        draw();
      };
    }
    const failBtn = el.querySelector('#failBtn');
    const okBtn = el.querySelector('#okBtn');
    [[failBtn, false], [okBtn, true]].forEach(([b, ok]) => {
      if (!b) return;
      b.onclick = () => {
        gradeMine(target, ok);
        nextPrompt(ok ? null : target.ko);
        draw();
      };
    });
    bindAi();

    // 문장 영작은 빈칸 퀴즈와 같은 내장 자판 (터치 기기). 정답 확인 후엔 자판을 내려서 답·채점 버튼이 보이게
    if (mode === 'tr' && prompt && !revealed && el.classList.contains('on')) {
      kbd.attach((type, value) => {
        if (type === 'char') kbEdit(ta, value);
        else if (type === 'space') kbEdit(ta, ' ');
        else if (type === 'back') kbEdit(ta, null);
        else if (type === 'action') kbEdit(ta, value);
        else if (type === 'enter') el.querySelector('#revealBtn, #submitBtn, #copyBtn')?.click();
      }, { actions: PUNCT.map(([id, label]) => ({ id, label })) });
    } else {
      kbd.detach();
    }
    // PC: 입력칸에서 Enter = 정답 확인 / 첨삭 (Shift+Enter는 줄바꿈)
    if (ta && mode === 'tr') {
      ta.onkeydown = (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        e.preventDefault();
        el.querySelector('#revealBtn, #submitBtn, #copyBtn')?.click();
      };
    }

    // AI 첨삭 버튼 (키 있으면 앱에서 첨삭, 없으면 복사해서 Claude에) — 내 표현 세트는 정답 확인 뒤에 선택으로
    function bindAi() {
      const submitBtn = el.querySelector('#submitBtn');
      const copyBtn = el.querySelector('#copyBtn');
      if (copyBtn) copyBtn.onclick = () => copyForClaude(copyBtn);
      if (submitBtn) submitBtn.onclick = () => submitAi(submitBtn);
    }

    async function copyForClaude(copyBtn) {
      const text = el.querySelector('#writingInput').value.trim();
      if (!text || !prompt) return;
      const msg = `문장 영작 첨삭해줘!\n한국어: ${prompt}\n${target ? `목표 표현: ${target.target}\n` : ''}내 영어: ${text}`;
      const label = copyBtn.textContent;
      try {
        await navigator.clipboard.writeText(msg);
        store.markWritingDay(); // 복사 흐름은 첨삭 기록이 안 남아서 홈 체크용 마커
        copyBtn.textContent = '✓ 복사됐어요';
        setTimeout(() => { copyBtn.textContent = label; }, 2000);
      } catch {
        window.prompt('아래 내용을 복사해서 Claude에 붙여넣으세요:', msg);
      }
    }

    async function submitAi(submitBtn) {
      const text = el.querySelector('#writingInput').value.trim();
      if (!text || (mode === 'tr' && !prompt)) return;
      submitBtn.disabled = true;
      resultEl.innerHTML = '<div class="card-box spinner">🤖 첨삭 중이에요... (10~20초 정도 걸려요)</div>';
      try {
        const entry = mode === 'free'
          ? { date: todayStr(), mode: 'free', input: text, result: await correctWriting(text, store.apiKey()) }
          : {
            date: todayStr(), mode: 'tr', ko: prompt, input: text,
            ...(target ? { target: target.target, answer: target.answer } : {}),
            result: await gradeTranslation(prompt, text, target ? { target: target.target, answer: target.answer } : {}),
          };
        const history = store.corrections();
        history.unshift(entry);
        store.saveCorrections(history.slice(0, 50));
        showEntry(resultEl, entry, ctx);
        drawHistory();
      } catch (e) {
        resultEl.innerHTML = `<div class="card-box notice">⚠️ ${esc(e.message)}</div>`;
      } finally {
        submitBtn.disabled = false;
      }
    }

    function drawHistory() {
      const history = store.corrections();
      const hEl = el.querySelector('#history');
      if (!history.length) { hEl.innerHTML = ''; return; }
      hEl.innerHTML = `
        <h2 class="section-title">지난 첨삭</h2>
        ${history.slice(0, 5).map((h, i) => `
          <div class="card-box lesson-item" data-i="${i}">
            <div class="date">${esc(h.date)}${h.mode === 'tr' ? (h.target ? ' · 📚 내 표현' : ' · 문장 영작') : ''}</div>
            <p>${esc((h.mode === 'tr' ? `${h.ko} → ` : '') + h.input).slice(0, 60)}${(h.input.length > 60) ? '…' : ''}</p>
          </div>`).join('')}`;
      hEl.querySelectorAll('.lesson-item').forEach((item) => {
        item.onclick = () => {
          showEntry(resultEl, history[Number(item.dataset.i)], ctx);
          resultEl.scrollIntoView({ behavior: 'smooth' });
        };
      });
    }
    drawHistory();
  }

  draw();
  // 내 표현 문제는 처음 한 번 받아온 뒤 출제
  if (!minePrompts) {
    loadMinePrompts().then(() => {
      if (set === 'mine' && !prompt && el.classList.contains('on')) {
        pickPrompt();
        draw();
      }
    });
  }
}

function showEntry(resultEl, entry, ctx) {
  if (entry.mode === 'tr') {
    const r = entry.result;
    resultEl.innerHTML = `
      <div class="card-box" data-pick="영작 첨삭">
        <div class="tr-prompt small">${esc(entry.ko)}</div>
        ${entry.target ? `<p class="tr-target">🎯 ${esc(entry.target)} — ${r.used_target ? '✅ 잘 썼어요!' : '이번엔 안 썼어요'}</p>` : ''}
        <div class="correction">
          ${r.is_natural
            ? `<div class="natural">👍 ${esc(entry.input)}</div>`
            : `<div class="orig">${esc(entry.input)}</div>
               <div class="fixed">${esc(r.corrected)}</div>`}
          <div class="why">${esc(r.explanation_ko)}</div>
          ${tagChips(r.tags)}
        </div>
        ${(r.alternatives || []).length ? `
          <p class="notice" style="margin-bottom:4px">이렇게도 말해요:</p>
          ${r.alternatives.map((a) => `<div class="fixed">• ${esc(a)}</div>`).join('')}` : ''}
        ${entry.answer ? `
          <p class="notice" style="margin-bottom:4px">📘 예시 답안:</p>
          <div class="fixed">${esc(entry.answer)}</div>` : ''}
        ${r.chunk ? `<button class="add-chunk" data-c="0">＋ 단어장에 추가: ${esc(r.chunk.en)}</button>` : ''}
        <p class="notice">🗣 자연스러운 문장을 소리 내어 3번 읽어보세요!</p>
      </div>`;
    if (r.chunk) bindChunk(resultEl.querySelector('.add-chunk'), r.chunk, ctx);
    bindTagChips(resultEl);
    return;
  }
  const r = entry.result;
  resultEl.innerHTML = `
    <div class="card-box" data-pick="영작 첨삭">
      ${(r.corrections || []).map((c, i) => `
        <div class="correction">
          ${c.is_natural
            ? `<div class="natural">👍 ${esc(c.original)}</div>`
            : `<div class="orig">${esc(c.original)}</div>
               <div class="fixed">${esc(c.corrected)}</div>`}
          <div class="why">${esc(c.explanation_ko)}</div>
          ${tagChips(c.tags)}
          ${c.chunk ? `<button class="add-chunk" data-i="${i}">＋ 단어장에 추가: ${esc(c.chunk.en)}</button>` : ''}
        </div>`).join('')}
      <p class="notice" style="margin-bottom:0">💬 ${esc(r.overall_feedback_ko || '')}</p>
      <p class="notice">🗣 첨삭받은 문장을 소리 내어 3번씩 읽어보세요!</p>
    </div>`;
  resultEl.querySelectorAll('.add-chunk').forEach((btn) => {
    const c = r.corrections[Number(btn.dataset.i)];
    if (c?.chunk) bindChunk(btn, c.chunk, ctx);
  });
  bindTagChips(resultEl);
}

function bindChunk(btn, chunk, ctx) {
  btn.onclick = () => {
    const custom = store.custom();
    if (ctx.cards.some((x) => x.en.toLowerCase() === chunk.en.toLowerCase())) {
      btn.textContent = '이미 단어장에 있어요';
      btn.disabled = true;
      return;
    }
    custom.push({
      id: 'custom-' + Date.now(),
      type: 'chunk',
      ko: chunk.ko,
      en: chunk.en,
      example: chunk.example,
      category: '내 표현',
      added: todayStr(),
      source: '영작 첨삭',
    });
    store.saveCustom(custom);
    ctx.reloadCards();
    btn.textContent = '✓ 추가됐어요';
    btn.disabled = true;
  };
}
