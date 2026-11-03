// 퀴즈 탭: 예문 속 표현 구간을 빈칸으로 뚫고 직접 타이핑해서 맞추기 (새 카드·복습 카드 모두)
import { store, esc, splitSentences, pairExamples, todayStr, shuffle } from './store.js';
import { buildSession, answerCard, NEW_PER_DAY, GOOD, HARD, AGAIN } from './srs.js';

// srs = 오늘 학습(복습 + 새 카드, 일정 반영), today = 오늘 푼 카드로 연습(일정·기록 안 건드림)
let mode = 'srs';

// 오늘 채점한 카드 중 예문 있는 것
function todaySession(cards) {
  const today = todayStr();
  const ids = new Set(store.log().filter((e) => e.d === today).map((e) => e.id));
  return shuffle(cards.filter((c) => c.example && ids.has(c.id)));
}

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

export function render(el, ctx, { moreNew = false } = {}) {
  const practice = mode === 'today';
  const srs = store.srs();
  const session = practice
    ? todaySession(ctx.cards)
    : buildSession(ctx.cards, { filter: (c) => !!c.example, ...(moreNew ? { newLimit: NEW_PER_DAY } : {}) });
  // 채점 전에 기록: 재출제된 새 카드도 끝까지 '신규'로 표시
  const freshIds = new Set(session.filter((c) => !srs[c.id]).map((c) => c.id));
  let idx = 0;
  let cz = null;
  let result = null; // null = 입력 대기, { ok, typed } = 채점 완료
  let hintCount = 0;

  el.innerHTML = `
    <div class="chip-row">
      <button data-mode="srs" class="${practice ? '' : 'on'}">📅 오늘 학습</button>
      <button data-mode="today" class="${practice ? 'on' : ''}">🔁 오늘 배운 카드 연습</button>
    </div>
    ${practice ? '<p class="count-note" style="margin:0 0 10px">오늘 푼 카드로 연습해요. 복습 일정엔 영향 없어요.</p>' : ''}
    <div id="czBody"></div>`;
  el.querySelectorAll('[data-mode]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.mode === mode) return;
      mode = b.dataset.mode;
      render(el, ctx);
    };
  });
  const body = el.querySelector('#czBody');

  // 끝 화면: 연습은 다시 하기, 오늘 학습은 하루 상한과 별개로 새 카드를 더 받을 수 있게
  function endScreen(icon, title, msg) {
    const more = !practice && ctx.cards.some((c) => c.example && !store.srs()[c.id]);
    body.innerHTML = `
      <div class="done-box">
        <div class="big">${icon}</div>
        <h3>${title}</h3>
        <p>${msg}</p>
        ${practice ? '<button class="primary" id="againBtn">한 번 더 하기</button>' : ''}
        ${more ? `<button class="primary" id="moreBtn">➕ 새 카드 ${NEW_PER_DAY}장 더</button>` : ''}
      </div>`;
    const again = body.querySelector('#againBtn');
    if (again) again.onclick = () => render(el, ctx);
    const moreBtn = body.querySelector('#moreBtn');
    if (moreBtn) moreBtn.onclick = () => render(el, ctx, { moreNew: true });
  }

  if (session.length === 0) {
    if (practice) {
      body.innerHTML = '<p class="notice">오늘 푼 카드가 아직 없어요. 📅 오늘 학습부터 풀어보세요!</p>';
    } else if (!ctx.cards.some((c) => c.example)) {
      body.innerHTML = '<p class="notice">예문이 있는 카드가 없어요.</p>';
    } else {
      endScreen('✅', '오늘 할 카드를 다 했어요', '복습 카드는 내일 다시 나와요.');
    }
    return;
  }

  // 입력창은 세션 내내 같은 요소를 유지하고, 버튼·카드를 눌러도 포커스가 빠지지 않게 막는다
  // → 카드가 바뀔 때 키보드가 내려갔다 올라오면서 화면이 출렁이지 않음
  body.innerHTML = `
    <div class="cardzone">
      <div class="session-info" id="czInfo"></div>
      <div class="flashcard cloze-card" id="czCard"></div>
      <div class="cloze-form">
        <input id="clozeInput" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" />
        <button class="primary" id="czBtn"></button>
      </div>
      <div class="cloze-below" id="czBelow"></div>
    </div>`;
  const info = body.querySelector('#czInfo');
  const card = body.querySelector('#czCard');
  const below = body.querySelector('#czBelow');
  const input = body.querySelector('#clozeInput');
  const btn = body.querySelector('#czBtn');
  body.querySelector('.cardzone').addEventListener('mousedown', (e) => {
    if (e.target !== input) e.preventDefault();
  });

  function draw() {
    const c = session[idx];
    const tag = practice ? '' : freshIds.has(c.id)
      ? '<span class="pill new">신규</span> '
      : '<span class="pill review">복습</span> ';
    info.innerHTML = `<span>남은 카드 ${session.length - idx}</span><span>${tag}<span class="pill">${esc(c.category || '표현')}</span></span>`;
    card.innerHTML = `
      <div class="ko" style="font-size:1.1rem">${result ? cz.reveal : cz.display}</div>
      <div class="ex">${esc(cz.ko)}</div>`;
    btn.textContent = result ? '다음 →' : '확인';
    input.placeholder = result ? 'Enter ↵ 다음 문제' : '빈칸 표현 입력';
    if (!result) {
      const letters = cz.answer.replace(/ /g, '').length;
      below.innerHTML = `
        ${hintCount > 0 ? `<div class="cloze-hint">힌트: ${esc(hintStr(cz.answer, hintCount))}</div>` : ''}
        <div class="cloze-actions">
          <button class="ghost" id="hintBtn" ${hintCount >= letters ? 'disabled' : ''}>💡 힌트</button>
          <button class="ghost" id="giveupBtn">모르겠어요</button>
        </div>`;
      below.querySelector('#hintBtn').onclick = () => {
        hintCount++;
        draw();
      };
      below.querySelector('#giveupBtn').onclick = () => finish(false, '');
    } else {
      below.innerHTML = `
        ${result.ok
          ? `<div class="cloze-result ok">⭕ 정답이에요!${hintCount > 0 && !practice ? ' <small>(힌트 사용 → 어려움으로 기록)</small>' : ''}</div>`
          : wrongResultHtml(cz.answer, result.typed)}
        ${cz.extras.length ? `
          <div class="cloze-extra">
            ${cz.extras.map((x) => `<div>${x.html}${x.ko ? `<div class="cloze-extra-ko">${esc(x.ko)}</div>` : ''}</div>`).join('')}
          </div>` : ''}`;
    }
  }

  function start() {
    cz = makeCloze(session[idx]);
    result = null;
    hintCount = 0;
    input.value = '';
    draw();
    input.focus();
  }

  function finish(ok, typed) {
    if (practice) {
      // 연습은 채점 기록 없이, 틀린 카드만 몇 장 뒤에 다시 출제
      if (!ok) session.splice(Math.min(idx + 4, session.length), 0, session[idx]);
    } else {
      // 힌트를 봤다면 완전히 기억한 게 아니므로 어려움으로 채점
      answerCard(session, idx, !ok ? AGAIN : hintCount > 0 ? HARD : GOOD);
      ctx.refreshHeader();
    }
    result = { ok, typed };
    input.value = '';
    draw();
  }

  function next() {
    idx++;
    if (idx >= session.length) {
      endScreen('🎉', practice ? '연습 완료!' : '오늘 학습 완료!', `${session.length}문제를 풀었어요.`);
      return;
    }
    start();
  }

  function submit() {
    if (result) return next();
    const typed = input.value.trim();
    if (typed) finish(normPhrase(typed) === normPhrase(cz.answer), typed);
  }

  btn.onclick = submit;
  input.onkeydown = (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    submit();
  };
  start();
}
