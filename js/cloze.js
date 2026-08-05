// 예문 빈칸 퀴즈: 예문 속 표현의 핵심 단어를 빈칸으로 뚫고 직접 타이핑해서 맞추기
import { esc } from './store.js';
import { buildSession, answerCard, GOOD, AGAIN } from './srs.js';

const norm = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

// 예문에서 en 표현과 겹치는 단어 구간을 찾아 빈칸 처리
function makeCloze(card) {
  if (!card.example) return null;
  const exWords = card.example.split(' ');

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

// 표현(여러 단어)이면 그 중 가장 긴 핵심 단어 하나만, 단어면 그 단어를 빈칸으로
function blank(words, start, len) {
  let bi = start;
  for (let i = start; i < start + len; i++) {
    if (norm(words[i]).length > norm(words[bi]).length) bi = i;
  }
  const m = words[bi].match(/^([^A-Za-z'’]*)([A-Za-z'’-]+)([^A-Za-z'’]*)$/) || ['', '', words[bi], ''];
  const answer = m[2];
  const withMid = (mid) => [...words.slice(0, bi), m[1] + mid + m[3], ...words.slice(bi + 1)]
    .map((w, i2) => (i2 === bi ? w : esc(w))).join(' ');
  return {
    display: withMid(`<span class="blank-box" style="width:${Math.min(Math.max(answer.length + 1, 4), 14)}ch"></span>`),
    reveal: withMid(`<span class="blank">${esc(answer)}</span>`),
    answer,
    hint: (answer[0] || '') + '＿'.repeat(Math.max(answer.length - 1, 1)),
  };
}

export function render(el, ctx) {
  const session = buildSession(ctx.cards, { filter: (c) => !!c.example });
  let idx = 0;
  let result = null; // null = 입력 대기, { ok, typed } = 채점 완료

  function draw() {
    if (idx >= session.length) {
      el.innerHTML = `
        <div class="done-box">
          <div class="big">✏️</div>
          <h3>빈칸 퀴즈 완료!</h3>
          <p>${session.length}문제를 풀었어요.</p>
          <button class="primary" id="againBtn">한 번 더 하기</button>
        </div>`;
      el.querySelector('#againBtn').onclick = () => render(el, ctx);
      return;
    }
    const c = session[idx];
    const cz = makeCloze(c);
    const asking = result === null;
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info"><span>남은 카드 ${session.length - idx}</span><span class="pill">${esc(c.category || '표현')}</span></div>
        <div class="flashcard">
          <div class="tag">빈칸에 들어갈 단어는?</div>
          <div class="ko" style="font-size:1.1rem">${asking ? cz.display : cz.reveal}</div>
          <div class="ex">뜻: ${esc(c.ko)}</div>
          ${asking
            ? `<div class="cloze-hint">힌트: ${esc(cz.hint)}</div>`
            : result.ok
              ? '<div class="cloze-result ok">⭕ 정답이에요!</div>'
              : `<div class="cloze-result no">✕ 정답: ${esc(cz.answer)}${result.typed ? ` · 내 답: ${esc(result.typed)}` : ''}</div>`}
        </div>
        ${asking ? `
          <div class="cloze-form">
            <input id="clozeInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="빈칸 단어 입력" />
            <button class="primary" id="checkBtn">확인</button>
          </div>
          <button class="ghost" id="giveupBtn">모르겠어요</button>`
        : '<button class="primary" id="nextBtn">다음 →</button>'}
      </div>`;

    if (asking) {
      const input = el.querySelector('#clozeInput');
      input.focus();
      const check = () => {
        const typed = input.value.trim();
        if (!typed) return;
        finish(norm(typed) === norm(cz.answer), typed);
      };
      el.querySelector('#checkBtn').onclick = check;
      input.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      el.querySelector('#giveupBtn').onclick = () => finish(false, '');
    } else {
      el.querySelector('#nextBtn').onclick = () => { idx++; result = null; draw(); };
    }

    function finish(ok, typed) {
      answerCard(session, idx, ok ? GOOD : AGAIN);
      result = { ok, typed };
      ctx.refreshHeader();
      draw();
    }
  }

  if (session.length === 0) {
    el.innerHTML = ctx.cards.some((c) => c.example)
      ? '<p class="notice">오늘 풀 빈칸 퀴즈가 없어요. 내일 다시 만나요!</p>'
      : '<p class="notice">예문이 있는 카드가 없어요.</p>';
    return;
  }
  draw();
}
