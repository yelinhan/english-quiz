// 예문 빈칸 퀴즈: 예문에서 표현 부분을 빈칸으로 뚫고 맞추기
import { esc, shuffle } from './store.js';
import { grade } from './srs.js';

// 예문에서 en 표현과 겹치는 단어 구간을 찾아 빈칸 처리
function makeCloze(card) {
  if (!card.example) return null;
  const exWords = card.example.split(' ');
  const norm = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

  // en 필드의 각 변형(/ 구분)에 대해 예문 내 연속 일치 구간 탐색
  const variants = card.en.split('/').map((v) => v.trim()).filter(Boolean);
  for (const v of variants) {
    const vWords = v.split(' ').map(norm).filter(Boolean);
    if (!vWords.length) continue;
    for (let i = 0; i + vWords.length <= exWords.length; i++) {
      let match = true;
      for (let j = 0; j < vWords.length; j++) {
        if (norm(exWords[i + j]) !== vWords[j]) { match = false; break; }
      }
      if (match) return blank(exWords, i, vWords.length);
    }
    // 부분 일치: 변형의 첫 2단어라도 찾기
    if (vWords.length >= 2) {
      for (let i = 0; i + 2 <= exWords.length; i++) {
        if (norm(exWords[i]) === vWords[0] && norm(exWords[i + 1]) === vWords[1]) {
          return blank(exWords, i, Math.min(vWords.length, exWords.length - i));
        }
      }
    }
  }
  // 폴백: 예문에서 가장 긴 단어를 빈칸으로
  let best = 0;
  for (let i = 1; i < exWords.length; i++) {
    if (norm(exWords[i]).length > norm(exWords[best]).length) best = i;
  }
  return blank(exWords, best, 1);
}

function blank(words, start, len) {
  const answer = words.slice(start, start + len).join(' ');
  const hint = words.slice(start, start + len)
    .map((w) => (w[0] || '') + '＿'.repeat(Math.max(w.replace(/[^A-Za-z']/g, '').length - 1, 1)))
    .join(' ');
  const display = [
    ...words.slice(0, start),
    `<span class="blank">____</span>`,
    ...words.slice(start + len),
  ].join(' ');
  return { display, answer, hint };
}

export function render(el, ctx) {
  const pool = shuffle(ctx.cards.filter((c) => c.example)).slice(0, 10);
  let idx = 0;
  let revealed = false;

  function draw() {
    if (idx >= pool.length) {
      el.innerHTML = `
        <div class="done-box">
          <div class="big">✏️</div>
          <h3>빈칸 퀴즈 완료!</h3>
          <p>${pool.length}문제를 풀었어요.</p>
          <button class="primary" id="againBtn">한 번 더 하기</button>
        </div>`;
      el.querySelector('#againBtn').onclick = () => render(el, ctx);
      return;
    }
    const c = pool[idx];
    const cz = makeCloze(c);
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info"><span>${idx + 1} / ${pool.length}</span><span class="pill">${esc(c.category || '표현')}</span></div>
        <div class="flashcard" id="card">
          <div class="tag">빈칸에 들어갈 표현은?</div>
          <div class="ko" style="font-size:1.1rem">${revealed ? cz.display.replace('<span class="blank">____</span>', `<span class="blank">${esc(cz.answer)}</span>`) : cz.display}</div>
          <div class="ex">뜻: ${esc(c.ko)}</div>
          ${revealed ? '' : `<div class="cloze-hint">힌트: ${esc(cz.hint)}</div><div class="hint">탭해서 정답 보기</div>`}
        </div>
        <div class="grade-btns" ${revealed ? '' : 'style="visibility:hidden"'}>
          <button class="btn-x">✕ 몰랐어요</button>
          <button class="btn-o">⭕ 맞췄어요</button>
        </div>
      </div>`;

    el.querySelector('#card').onclick = () => {
      revealed = !revealed;
      draw();
    };
    el.querySelector('.btn-x').onclick = () => answer(false);
    el.querySelector('.btn-o').onclick = () => answer(true);

    function answer(ok) {
      grade(c.id, ok);
      idx++;
      revealed = false;
      ctx.refreshHeader();
      draw();
    }
  }

  if (pool.length === 0) {
    el.innerHTML = '<p class="notice">예문이 있는 카드가 없어요.</p>';
    return;
  }
  draw();
}
