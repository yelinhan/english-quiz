// 통문장 외우기: 하루 3문장씩 새로 받고, 서로 다른 7일에 말하기 성공할 때까지 매일 누적 반복한 뒤 졸업
import { store, todayStr, shuffle, esc } from './store.js';

const PER_DAY = 3;
const KEEP_DAYS = 7;

// 진행 기록: { [id]: { intro: 도입일, reps: 말하기 성공한 날 수(하루 최대 1), last: 마지막 성공일 } }
// 오늘 도입분이 없으면 아직 안 받은 문장을 목록 순서대로 3개 도입 (prog를 직접 수정)
function plan(all, prog, today) {
  if (!all.some((s) => prog[s.id]?.intro === today)) {
    all.filter((s) => !prog[s.id]).slice(0, PER_DAY)
      .forEach((s) => { prog[s.id] = { intro: today, reps: 0, last: '' }; });
  }
  // 성공한 날이 7일 미만인 문장이 반복 대상 (7일째를 오늘 채운 문장은 오늘까지 목록에 남김).
  // 하루 빠져도 날짜가 아니라 성공 횟수로 세니까 밀리기만 하고 건너뛰지 않음
  const doneToday = (s) => prog[s.id].last === today;
  const active = all.filter((s) => prog[s.id] && ((prog[s.id].reps || 0) < KEEP_DAYS || doneToday(s)))
    .map((s) => ({ ...s, day: (prog[s.id].reps || 0) + (doneToday(s) ? 0 : 1) }));
  const graduated = all.filter((s) => prog[s.id] && (prog[s.id].reps || 0) >= KEEP_DAYS && !doneToday(s));
  const waiting = all.filter((s) => !prog[s.id]);
  return { active, graduated, waiting };
}

// 홈 화면용: 기록을 건드리지 않고 오늘 할 양만 계산
export function todayStatus(all) {
  const today = todayStr();
  const prog = store.sentences();
  const { active } = plan(all, { ...prog }, today);
  const fresh = active.filter((s) => !prog[s.id] || prog[s.id].intro === today).length;
  const left = active.filter((s) => prog[s.id]?.last !== today).length;
  return { total: active.length, fresh, left, done: active.length > 0 && left === 0 };
}

// 첫 글자만 남긴 힌트: "I found out" → "I f____ o__"
function hintOf(en) {
  return en.split(' ').map((w) => w.replace(/^([^A-Za-z]*[A-Za-z])([A-Za-z']*)/,
    (_, head, rest) => head + rest.replace(/[A-Za-z]/g, '_'))).join(' ');
}

function speak(text, rate = 0.95) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-US');
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

const ttsBtns = `
  <div class="tts-btns">
    <button class="ghost" data-tts="0.95">🔊 듣기</button>
    <button class="ghost" data-tts="0.7">🐢 천천히</button>
  </div>`;

export function render(el, ctx) {
  const all = ctx.sentences || [];
  const today = todayStr();

  if (!all.length) {
    el.innerHTML = `
      <div class="done-box">
        <div class="big">🗣</div>
        <h3>아직 외울 문장이 없어요</h3>
        <p>수업 분석 때 정리한 문장이<br>여기에 하루 3개씩 쌓여요.</p>
      </div>`;
    return;
  }

  const prog = store.sentences();
  const before = Object.keys(prog).length;
  const { active, graduated, waiting } = plan(all, prog, today);
  if (Object.keys(prog).length !== before) store.saveSentences(prog);

  if (!active.length) {
    el.innerHTML = `
      <div class="done-box">
        <div class="big">🎓</div>
        <h3>모든 문장 졸업!</h3>
        <p>${graduated.length}문장을 7일씩 말해봤어요.<br>수업 분석 때 새 문장이 추가되면 다시 하루 3개씩 나와요.</p>
      </div>`;
    return;
  }

  // 1단계: 오늘 새로 받은 문장 익히기 → 2단계: 7일치 누적 문장 외워서 말하기
  const learn = active.filter((s) => prog[s.id].intro === today && !prog[s.id].reps);
  let queue = shuffle(active.filter((s) => prog[s.id].last !== today));
  let practice = false; // 오늘 분량 끝낸 뒤 "한 번 더": 기록 안 남김
  let li = 0;
  let revealed = false;
  let hinted = false;

  function bindTts(c) {
    el.querySelectorAll('[data-tts]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        speak(c.en, Number(b.dataset.tts));
      };
    });
  }

  function drawLearn() {
    const c = learn[li];
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info"><span>🌱 오늘의 새 문장 ${li + 1} / ${learn.length}</span><span class="pill">익히기</span></div>
        <div class="flashcard sent-card">
          <div class="ko">${esc(c.ko)}</div>
          <div class="en sent-en">${esc(c.en)}</div>
          ${c.note ? `<div class="sent-note">💡 ${esc(c.note)}</div>` : ''}
          ${ttsBtns}
          <div class="hint">듣고 소리 내서 3번 따라 말해보세요</div>
        </div>
        <div class="grade-btns">
          <button class="btn-good" id="nextBtn">따라 말했어요 →</button>
        </div>
      </div>`;
    bindTts(c);
    speak(c.en);
    el.querySelector('#nextBtn').onclick = () => {
      li++;
      if (li < learn.length) drawLearn();
      else drawRecall();
    };
  }

  function drawRecall() {
    if (!queue.length) {
      drawDone();
      return;
    }
    const c = queue[0];
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info">
          <span>${practice ? '🔁 한 번 더 (기록 안 남음)' : `남은 문장 ${queue.length}`}</span>
          <span class="pill">${c.day}일째 / ${KEEP_DAYS}</span>
        </div>
        <div class="flashcard sent-card" id="card">
          <div class="ko">${esc(c.ko)}</div>
          ${revealed
            ? `<div class="en sent-en">${esc(c.en)}</div>
               ${c.note ? `<div class="sent-note">💡 ${esc(c.note)}</div>` : ''}
               ${ttsBtns}`
            : `${hinted ? `<div class="sent-hint">${esc(hintOf(c.en))}</div>` : ''}
               <div class="hint">영어로 소리 내서 말해본 뒤 탭해서 확인</div>`}
        </div>
        ${revealed
          ? `<div class="grade-btns">
               <button class="btn-again" data-ok="0">😅 다시</button>
               <button class="btn-good" data-ok="1">👍 말했어</button>
             </div>`
          : `<div class="grade-btns">
               <button class="btn-hard" id="hintBtn" ${hinted ? 'disabled' : ''}>💡 첫 글자 힌트</button>
             </div>`}
      </div>`;
    el.querySelector('#card').onclick = () => {
      if (revealed) return;
      revealed = true;
      drawRecall();
      speak(c.en);
    };
    if (revealed) {
      bindTts(c);
      el.querySelectorAll('[data-ok]').forEach((b) => {
        b.onclick = () => grade(b.dataset.ok === '1');
      });
    } else {
      el.querySelector('#hintBtn').onclick = () => {
        hinted = true;
        drawRecall();
      };
    }
  }

  // 다시 → 이번 세션 맨 뒤로 / 말했어 → 오늘 완료 처리
  function grade(ok) {
    const c = queue.shift();
    if (!ok) {
      queue.push(c);
    } else if (!practice) {
      prog[c.id] = { ...prog[c.id], reps: (prog[c.id].reps || 0) + 1, last: today };
      store.saveSentences(prog);
    }
    revealed = false;
    hinted = false;
    drawRecall();
  }

  function drawDone() {
    const tomorrow = Math.min(PER_DAY, waiting.length);
    el.innerHTML = `
      <div class="done-box">
        <div class="big">🎉</div>
        <h3>오늘 통문장 완료!</h3>
        <p>${active.length}문장 말하기 성공<br>
          ${tomorrow ? `내일 새 문장 ${tomorrow}개가 추가돼요.` : '새 문장을 다 받았어요 — 수업 분석 때 더 채워져요.'}</p>
        <button class="primary" id="againBtn">한 번 더 하기</button>
      </div>
      ${listHtml()}`;
    el.querySelector('#againBtn').onclick = () => {
      practice = true;
      queue = shuffle(active);
      drawRecall();
    };
    bindList();
  }

  function listHtml() {
    const byDay = [...active].sort((a, b) => a.day - b.day);
    return `
      <h2 class="section-title">📋 이번 주 문장 (${active.length})</h2>
      <div class="card-box">
        ${byDay.map((s) => `
          <div class="upgrade-row sent-row" data-id="${esc(s.id)}">
            <div class="sent-row-head"><span class="pill">${s.day}일째</span>${prog[s.id]?.last === today ? ' ✅' : ''}</div>
            <div class="better">${esc(s.en)}</div>
            <div class="note">${esc(s.ko)}</div>
          </div>`).join('')}
      </div>
      <p class="notice">🎓 졸업 ${graduated.length}문장 · ⏳ 대기 ${waiting.length}문장 · 문장을 누르면 발음을 들려줘요</p>`;
  }

  function bindList() {
    el.querySelectorAll('.sent-row').forEach((row) => {
      row.onclick = () => speak(all.find((s) => s.id === row.dataset.id).en);
    });
  }

  if (learn.length) drawLearn();
  else if (queue.length) drawRecall();
  else drawDone();
}
