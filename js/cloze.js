// 예문 빈칸 퀴즈: 예문 속 표현 구간 전체를 빈칸으로 뚫고 직접 타이핑해서 맞추기
import { esc, splitSentences, pairExamples } from './store.js';
import { buildSession, answerCard, GOOD, HARD, AGAIN } from './srs.js';

// 아포스트로피는 무시: 폰 키보드가 '를 ’로 바꾸거나 빼먹어도 정답 처리 (we've = we’ve = weve)
const norm = (w) => w.toLowerCase().replace(/[^a-z]/g, '');
const normPhrase = (s) => s.split(/\s+/).map(norm).filter(Boolean).join(' ');

// 문장 단어 배열에서 en 변형(/ 구분)들의 연속 일치 구간 탐색 → [시작, 길이] 또는 null
function findSpan(words, variants) {
  for (const v of variants) {
    const vw = v.split(' ').map(norm).filter(Boolean);
    if (!vw.length) continue;
    for (let i = 0; i + vw.length <= words.length; i++) {
      let match = true;
      for (let j = 0; j < vw.length; j++) {
        if (norm(words[i + j]) !== vw[j]) { match = false; break; }
      }
      if (match) return [i, vw.length];
    }
  }
  // 부분 일치: 변형의 첫 2단어라도 찾기
  for (const v of variants) {
    const vw = v.split(' ').map(norm).filter(Boolean);
    if (vw.length < 2) continue;
    for (let i = 0; i + 2 <= words.length; i++) {
      if (norm(words[i]) === vw[0] && norm(words[i + 1]) === vw[1]) {
        return [i, Math.min(vw.length, words.length - i)];
      }
    }
  }
  return null;
}

// 추가 예문에서 표현 구간을 강조 표시
function highlight(sentence, variants) {
  const words = sentence.split(' ');
  const span = findSpan(words, variants);
  if (!span) return esc(sentence);
  return words
    .map((w, i) => (i >= span[0] && i < span[0] + span[1] ? `<span class="blank">${esc(w)}</span>` : esc(w)))
    .join(' ');
}

// 표현이 든 문장 하나만 빈칸 문제로 출제. 나머지 문장은 정답 공개 후에만
// 추가 예문으로 보여준다 (미리 보이면 답이 노출되므로).
export function makeCloze(card) {
  if (!card.example) return null;
  const variants = card.en.split('/').map((v) => v.trim()).filter(Boolean);
  const pairs = pairExamples(card);
  const sents = pairs ? pairs.map((p) => p.en) : splitSentences(card.example);
  const kos = pairs ? pairs.map((p) => p.ko) : [];

  let qIdx = 0;
  let span = null;
  for (let i = 0; i < sents.length; i++) {
    span = findSpan(sents[i].split(' '), variants);
    if (span) { qIdx = i; break; }
  }
  if (!span) {
    // 폴백: 전체 예문에서 가장 긴 단어가 있는 문장을 골라 그 단어를 빈칸으로
    let bestLen = -1;
    for (let i = 0; i < sents.length; i++) {
      const ws = sents[i].split(' ');
      for (let j = 0; j < ws.length; j++) {
        if (norm(ws[j]).length > bestLen) {
          bestLen = norm(ws[j]).length;
          qIdx = i;
          span = [j, 1];
        }
      }
    }
  }
  const words = sents[qIdx].split(' ');
  const extras = sents
    .map((s, i) => ({ html: highlight(s, variants), ko: kos[i] || '', idx: i }))
    .filter((x) => x.idx !== qIdx);
  return {
    ...blank(words, span[0], span[1]),
    // 짝이 안 맞는 여러 문장 해석을 통째로 보여주면 다른 예문까지 섞이므로 표현 뜻으로 대체
    ko: kos[qIdx] || (sents.length === 1 && card.example_ko) || card.ko,
    extras,
  };
}

// 매치 구간의 단어를 전부 빈칸으로. 정답은 구간 전체(구두점 제외)
function blank(words, start, len) {
  const parts = words.slice(start, start + len)
    .map((w) => w.match(/^([^A-Za-z'’]*)([A-Za-z'’-]+)([^A-Za-z'’]*)$/) || ['', '', w, '']);
  const answer = parts.map((m) => m[2]).join(' ');
  const render = (mid) => words
    .map((w, i) => {
      if (i < start || i >= start + len) return esc(w);
      const m = parts[i - start];
      return esc(m[1]) + mid(m[2]) + esc(m[3]);
    })
    .join(' ');
  return {
    display: render((core) => `<span class="blank-box" style="width:${Math.min(Math.max(core.length + 1, 3), 14)}ch"></span>`),
    reveal: render((core) => `<span class="blank">${esc(core)}</span>`),
    answer,
  };
}

// 정답과 내 답을 단어 단위로 비교(LCS)해서 서로 다른 단어에 표시
function diffWords(answer, typed) {
  const a = answer.split(/\s+/).filter(Boolean);
  const b = typed.split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const aHit = new Set();
  const bHit = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (norm(a[i]) === norm(b[j])) { aHit.add(i++); bHit.add(j++); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const mark = (ws, hit, cls) => ws
    .map((w, i) => (hit.has(i) ? esc(w) : `<span class="${cls}">${esc(w)}</span>`))
    .join(' ');
  return { answer: mark(a, aHit, 'cr-missed'), mine: mark(b, bHit, 'cr-wrong') };
}

// 오답 결과: 정답 / 내 답을 줄을 나눠 표시. 정답에서 빠뜨린 단어·내 답에서 틀린 단어 강조
function wrongResultHtml(answer, typed) {
  const d = typed ? diffWords(answer, typed) : { answer: esc(answer) };
  return `
    <div class="cloze-result no">
      <div class="cr-title">✕ ${typed ? '틀렸어요' : '정답 확인'}</div>
      <div class="cr-row"><span class="cr-label">정답</span><span class="cr-answer">${d.answer}</span></div>
      ${typed ? `<div class="cr-row"><span class="cr-label">내 답</span><span class="cr-mine">${d.mine}</span></div>` : ''}
    </div>`;
}

// 힌트: 정답의 앞 n글자를 순서대로 공개 (공백은 항상 표시)
function hintStr(answer, n) {
  let left = n;
  return answer.split(' ')
    .map((w) => [...w].map((ch) => (left-- > 0 ? ch : '＿')).join(''))
    .join(' ');
}

export function render(el, ctx) {
  const session = buildSession(ctx.cards, { filter: (c) => !!c.example });
  let idx = 0;
  let result = null; // null = 입력 대기, { ok, typed } = 채점 완료
  let hintCount = 0;
  let typedDraft = '';

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
    const letters = cz.answer.replace(/ /g, '').length;
    el.innerHTML = `
      <div class="cardzone">
        <div class="session-info"><span>남은 카드 ${session.length - idx}</span><span class="pill">${esc(c.category || '표현')}</span></div>
        <div class="flashcard">
          <div class="ko" style="font-size:1.1rem">${asking ? cz.display : cz.reveal}</div>
          <div class="ex">${esc(cz.ko)}</div>
          ${asking
            ? hintCount > 0 ? `<div class="cloze-hint">힌트: ${esc(hintStr(cz.answer, hintCount))}</div>` : ''
            : result.ok
              ? `<div class="cloze-result ok">⭕ 정답이에요!${hintCount > 0 ? ' <small>(힌트 사용 → 어려움으로 기록)</small>' : ''}</div>`
              : wrongResultHtml(cz.answer, result.typed)}
          ${!asking && cz.extras.length ? `
            <div class="cloze-extra">
              ${cz.extras.map((x) => `<div>${x.html}${x.ko ? `<div class="cloze-extra-ko">${esc(x.ko)}</div>` : ''}</div>`).join('')}
            </div>` : ''}
        </div>
        ${asking ? `
          <div class="cloze-form">
            <input id="clozeInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="빈칸 표현 입력" />
            <button class="primary" id="checkBtn">확인</button>
          </div>
          <div class="cloze-actions">
            <button class="ghost" id="hintBtn" ${hintCount >= letters ? 'disabled' : ''}>💡 힌트</button>
            <button class="ghost" id="giveupBtn">모르겠어요</button>
          </div>`
        : '<button class="primary" id="nextBtn">다음 →</button>'}
      </div>`;

    if (asking) {
      const input = el.querySelector('#clozeInput');
      input.value = typedDraft;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      const check = () => {
        const typed = input.value.trim();
        if (!typed) return;
        finish(normPhrase(typed) === normPhrase(cz.answer), typed);
      };
      el.querySelector('#checkBtn').onclick = check;
      input.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      el.querySelector('#hintBtn').onclick = () => {
        typedDraft = input.value;
        hintCount++;
        draw();
      };
      el.querySelector('#giveupBtn').onclick = () => finish(false, '');
    } else {
      el.querySelector('#nextBtn').onclick = () => {
        idx++;
        result = null;
        hintCount = 0;
        typedDraft = '';
        draw();
      };
    }

    function finish(ok, typed) {
      // 힌트를 봤다면 완전히 기억한 게 아니므로 어려움으로 채점
      answerCard(session, idx, !ok ? AGAIN : hintCount > 0 ? HARD : GOOD);
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
