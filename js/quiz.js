// 한→영 플래시카드 퀴즈
import { esc } from './store.js';
import { buildSession, answerCard, previewIntervals } from './srs.js';

export function render(el, ctx) {
  const session = buildSession(ctx.cards);
  let idx = 0;
  let flipped = false;

  function draw() {
    if (idx >= session.length) {
      el.innerHTML = `
        <div class="done-box">
          <div class="big">🎉</div>
          <h3>오늘 퀴즈 완료!</h3>
          <p>${session.length}장 학습했어요.<br>내일 복습 카드가 기다리고 있어요.</p>
          <button class="primary" id="againBtn">한 번 더 하기</button>
        </div>`;
      el.querySelector('#againBtn').onclick = () => render(el, ctx);
      ctx.refreshHeader();
      return;
    }
    const c = session[idx];
    const p = previewIntervals(c.id);
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info"><span>남은 카드 ${session.length - idx}</span><span class="pill">${esc(c.category || '표현')}</span></div>
        <div class="flashcard" id="card">
          ${flipped
            ? `<div class="tag">${esc(c.type === 'word' ? 'Word' : 'Chunk')} · ${esc(c.category || '')}</div>
               <div class="en">${esc(c.en)}</div>
               ${c.example ? `<div class="ex">${esc(c.example)}</div>` : ''}`
            : `<div class="ko">${esc(c.ko)}</div>
               <div class="hint">탭해서 정답 보기</div>`}
        </div>
        <div class="grade-btns four" ${flipped ? '' : 'style="visibility:hidden"'}>
          <button class="btn-again" data-r="0">다시<span class="sub">${p.again}</span></button>
          <button class="btn-hard" data-r="1">어려움<span class="sub">${p.hard}</span></button>
          <button class="btn-good" data-r="2">알맞음<span class="sub">${p.good}</span></button>
          <button class="btn-easy" data-r="3">쉬움<span class="sub">${p.easy}</span></button>
        </div>
      </div>`;

    el.querySelector('#card').onclick = () => {
      flipped = !flipped;
      draw();
    };
    el.querySelectorAll('.grade-btns button').forEach((b) => {
      b.onclick = () => answer(Number(b.dataset.r));
    });
  }

  function answer(rating) {
    answerCard(session, idx, rating);
    idx++;
    flipped = false;
    ctx.refreshHeader();
    draw();
  }

  if (session.length === 0) {
    el.innerHTML = `
      <div class="done-box">
        <div class="big">✅</div>
        <h3>오늘 복습할 카드가 없어요</h3>
        <p>모든 카드를 학습했어요. 내일 다시 만나요!</p>
      </div>`;
    return;
  }
  draw();
}
