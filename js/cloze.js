// 퀴즈 탭: 예문 속 표현(핵심 단어가 표시돼 있으면 그 단어만)을 빈칸으로 뚫고 직접 타이핑해서 맞추기 (새 카드·복습 카드 모두)
import { store, esc, splitSentences, pairExamples, todayStr, shuffle } from './store.js';
import { buildSession, answerCard, previewIntervals, NEW_PER_DAY, GOOD, HARD, AGAIN } from './srs.js';

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
const toWords = (s) => s.split(' ').map(norm).filter(Boolean);

// 핵심 단어는 간단한 어미 변화 허용 (take → taking, push → pushed, throw → throwing)
const stem = (w) => (w.length > 3 && w.endsWith('e') ? w.slice(0, -1) : w);
const looseMatch = (w, k) => w === k || (k.length >= 3 && w.startsWith(stem(k)) && w.length - stem(k).length <= 3);

// words에서 정규화된 단어열 target이 연속으로 나오는 위치 (없으면 -1)
function findRun(words, target, loose) {
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((t, j) => (loose ? looseMatch(norm(words[i + j]), t) : norm(words[i + j]) === t))) return i;
  }
  return -1;
}

// 핵심 단어 묶음들(segs)이 words[from, to) 안에 순서대로 나오는 단어 번호들 또는 null.
// 묶음 사이엔 몇 단어가 끼어도 됨 — 구동사 짝: set me up, put the redesign on hold
const KEY_GAP = 4;
function findKey(words, segs, from = 0, to = words.length) {
  const kws = segs.map(toWords);
  for (let s = from; s < to; s++) {
    const idxs = [];
    let pos = s;
    for (let n = 0; n < kws.length; n++) {
      const end = Math.min(to, pos + kws[n].length + (n === 0 ? 0 : KEY_GAP));
      const at = findRun(words.slice(pos, end), kws[n], true);
      if (at < 0) break;
      for (let j = 0; j < kws[n].length; j++) idxs.push(pos + at + j);
      pos += at + kws[n].length;
    }
    if (idxs.length === kws.flat().length) return idxs;
  }
  return null;
}

const range = (start, len) => Array.from({ length: len }, (_, j) => start + j);

// en 변형(/ 구분) 중 문장에 그대로 든 것 → { start, len, v(변형 번호) } 또는 null
function exactSpan(words, variants) {
  for (let v = 0; v < variants.length; v++) {
    const vw = toWords(variants[v]);
    if (!vw.length) continue;
    const at = findRun(words, vw, false);
    if (at >= 0) return { start: at, len: vw.length, v };
  }
  return null;
}

// 부분 일치: 변형의 첫 2단어라도 찾아서, 이어지는 단어가 같은 데까지만
function partialSpan(words, variants) {
  for (const v of variants) {
    const vw = toWords(v);
    if (vw.length < 2) continue;
    const at = findRun(words, vw.slice(0, 2), false);
    if (at < 0) continue;
    let len = 2;
    while (len < vw.length && at + len < words.length && norm(words[at + len]) === vw[len]) len++;
    return { start: at, len };
  }
  return null;
}

// 추가 예문에서 표현 구간을 강조 표시
function highlight(sentence, variants) {
  const words = sentence.split(' ');
  const m = exactSpan(words, variants) || partialSpan(words, variants);
  if (!m) return esc(sentence);
  return words
    .map((w, i) => (i >= m.start && i < m.start + m.len ? `<span class="blank">${esc(w)}</span>` : esc(w)))
    .join(' ');
}

// 표현이 든 문장 하나만 빈칸 문제로 출제. 나머지 문장은 정답 공개 후에만
// 추가 예문으로 보여준다 (미리 보이면 답이 노출되므로).
// 출제 구간 (핵심 단어를 최대한 묻도록): ① 핵심 단어가 표시된 변형이 그대로 든 문장 → 그 단어만 빈칸
// ② 표현은 조금 달라도 핵심 단어가 든 문장 ③ 표시 없는 변형이 그대로 든 문장 → 표현 전체가 빈칸
// ④ 표현 앞 두 단어 ⑤ 가장 긴 단어
export function makeCloze(card) {
  if (!card.example) return null;
  const variants = card.en.split('/').map((v) => v.trim());
  // 변형별 [ ] 묶음 목록. 예전 포맷(변형별 문자열 하나)도 받음
  const keys = (card.keys || []).map((k) => (k == null || Array.isArray(k) ? k : [k]));
  const pairs = pairExamples(card);
  const sents = pairs ? pairs.map((p) => p.en) : splitSentences(card.example);
  const kos = pairs ? pairs.map((p) => p.ko) : [];
  const split = sents.map((s) => s.split(' '));

  // pick = { i: 문장 번호, blanks: 빈칸 단어 번호들 }
  let pick = null;
  let whole = null;
  for (let i = 0; i < sents.length && !pick; i++) {
    const m = exactSpan(split[i], variants);
    if (!m) continue;
    const blanks = keys[m.v] ? findKey(split[i], keys[m.v], m.start, m.start + m.len) : null;
    if (blanks) pick = { i, blanks };
    else if (!whole) whole = { i, blanks: range(m.start, m.len) };
  }
  for (let i = 0; i < sents.length && !pick; i++) {
    for (const segs of keys) {
      const blanks = segs ? findKey(split[i], segs) : null;
      if (blanks) { pick = { i, blanks }; break; }
    }
  }
  pick = pick || whole;
  for (let i = 0; i < sents.length && !pick; i++) {
    const m = partialSpan(split[i], variants);
    if (m) pick = { i, blanks: range(m.start, m.len) };
  }
  if (!pick) {
    let bestLen = -1;
    split.forEach((ws, i) => ws.forEach((w, j) => {
      if (norm(w).length > bestLen) { bestLen = norm(w).length; pick = { i, blanks: [j] }; }
    }));
  }

  const words = split[pick.i];
  // 빈칸 단어마다 [전체, 앞 구두점, 핵심, 뒤 구두점]. 정답은 핵심 부분만
  const parts = pick.blanks
    .map((b) => words[b].match(/^([^A-Za-z'’]*)([A-Za-z'’-]+)([^A-Za-z'’]*)$/) || [words[b], '', words[b], '']);
  const extras = sents
    .map((s, i) => ({ html: highlight(s, variants), ko: kos[i] || '', idx: i }))
    .filter((x) => x.idx !== pick.i);
  return {
    words,
    blanks: pick.blanks,
    parts,
    cores: parts.map((m) => m[2]),
    // 짝이 안 맞는 여러 문장 해석을 통째로 보여주면 다른 예문까지 섞이므로 표현 뜻으로 대체
    ko: kos[pick.i] || (sents.length === 1 && card.example_ko) || card.ko,
    extras,
  };
}

// 빈칸 문장 HTML. box(j, core)가 j번째 빈칸을 그린다
function sentenceHtml(cz, box) {
  return cz.words
    .map((w, i) => {
      const j = cz.blanks.indexOf(i);
      if (j < 0) return esc(w);
      const [, pre, core, post] = cz.parts[j];
      return esc(pre) + box(j, core) + esc(post);
    })
    .join(' ');
}

// 친 글자를 정답과 바로 비교: 맞는 데까지 초록, 처음 틀린 글자부터 빨강 (대소문자·아포스트로피 무시)
function liveBox(typed, core) {
  const want = norm(core);
  let k = 0;
  let bad = -1;
  [...typed].forEach((ch, i) => {
    if (bad >= 0 || !/[a-z]/i.test(ch)) return;
    if (ch.toLowerCase() === want[k]) k++;
    else bad = i;
  });
  if (bad < 0) return { cls: typed.trim() ? ' ok' : '', html: `<span class="cz-ok">${esc(typed)}</span>` };
  return { cls: ' no', html: `<span class="cz-ok">${esc(typed.slice(0, bad))}</span><span class="cz-no">${esc(typed.slice(bad))}</span>` };
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
  let result = null; // null = 입력 대기, { ok, boxes } = 채점 완료
  let hintCount = 0;
  let slipped = false; // 치다가 한 번이라도 빨간 글자가 나왔는지
  let vals = []; // 빈칸별로 친 글자
  let active = 0; // 지금 입력 중인 빈칸

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

  // 별도 입력칸 없이 문장 빈칸에 바로 채워 넣는다. 보이지 않는 입력창 하나가 지금 칸의 글자만 들고 있고
  // (빈칸을 탭하면 그 칸으로), 세션 내내 같은 입력창을 쓰며 버튼을 눌러도 포커스가 안 빠짐
  // → 카드가 바뀔 때 키보드가 내려가지 않음
  body.innerHTML = `
    <div class="cardzone">
      <div class="session-info" id="czInfo"></div>
      <div class="flashcard cloze-card" id="czCard">
        <div class="ko cz-sentence" id="czSentence"></div>
        <div class="ex" id="czKo"></div>
        <div class="cz-tap" id="czTap">⌨️ 탭해서 입력</div>
        <input id="clozeInput" class="cz-ghost" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="빈칸 입력" />
      </div>
      <div class="cloze-below" id="czBelow"></div>
    </div>`;
  const info = body.querySelector('#czInfo');
  const sentence = body.querySelector('#czSentence');
  const tap = body.querySelector('#czTap');
  const below = body.querySelector('#czBelow');
  const input = body.querySelector('#clozeInput');
  body.querySelector('.cardzone').addEventListener('mousedown', (e) => {
    if (e.target !== input) e.preventDefault();
  });
  // 빈칸을 탭하면 그 칸에 입력, 카드 다른 곳을 탭하면 키보드만 다시 띄움 (탭 핸들러 안에서 focus해야 iOS에서도 키보드가 뜸)
  body.querySelector('#czCard').addEventListener('click', (e) => {
    if (result) return;
    const box = e.target.closest('.cz-box');
    if (box) setActive(Number(box.dataset.j));
    input.focus();
  });

  function drawSentence() {
    const focused = document.activeElement === input;
    tap.hidden = focused || !!result;
    if (result) {
      sentence.innerHTML = sentenceHtml(cz, (j, core) => {
        const t = result.boxes[j].trim();
        if (norm(t) === norm(core)) return `<span class="cz-box ok">${esc(core)}</span>`;
        return `<span class="cz-box no">${t ? `<s>${esc(t)}</s>` : ''}${esc(core)}</span>`;
      });
      return;
    }
    // 빈 칸에도 폭 없는 공백(&#8203;)을 넣어 글자 기준선을 만든다 — 없으면 빈 칸만 위로 떠서 칸마다 높이가 달라짐
    sentence.innerHTML = sentenceHtml(cz, (j, core) => {
      const live = liveBox(vals[j], core);
      return `<span class="cz-box${live.cls}${j === active ? ' on' : ''}" data-j="${j}" style="min-width:${Math.min(core.length + 1, 14)}ch">&#8203;${live.html}${j === active && focused ? '<i class="cz-caret"></i>' : ''}</span>`;
    });
  }

  function drawBelow() {
    if (!result) {
      const answer = cz.cores.join(' ');
      below.innerHTML = `
        ${hintCount > 0 ? `<div class="cloze-hint">힌트: ${esc(hintStr(answer, hintCount))}</div>` : ''}
        <div class="cloze-actions">
          <button class="ghost" id="hintBtn" ${hintCount >= answer.replace(/ /g, '').length ? 'disabled' : ''}>💡 힌트</button>
          <button class="ghost" id="giveupBtn">모르겠어요</button>
          <button class="primary" id="checkBtn">확인</button>
        </div>`;
      below.querySelector('#hintBtn').onclick = () => {
        hintCount++;
        drawBelow();
      };
      below.querySelector('#giveupBtn').onclick = () => finish(false, []);
      below.querySelector('#checkBtn').onclick = submit;
      return;
    }
    // 오늘 학습은 정답을 본 뒤 기억한 정도를 직접 골라 복습 주기에 반영. 추천 버튼(테두리)은 Enter로 바로 선택
    let actions = '<button class="primary" id="nextBtn">다음 →</button>';
    if (!practice) {
      const p = previewIntervals(session[idx].id);
      const sug = suggested();
      actions = `
        <div class="grade-btns four">
          ${[['btn-again', '다시', p.again], ['btn-hard', '어려움', p.hard], ['btn-good', '알맞음', p.good], ['btn-easy', '쉬움', p.easy]]
            .map(([cls, label, ivl], r) => `<button class="${cls}${r === sug ? ' suggest' : ''}" data-r="${r}">${label}<span class="sub">${ivl}</span></button>`)
            .join('')}
        </div>
        <p class="count-note" style="text-align:center; margin:0">Enter = 테두리 버튼</p>`;
    }
    below.innerHTML = `
      <div class="cz-status ${result.ok ? 'ok' : 'no'}">${result.ok
        ? `⭕ 정답이에요!${hintCount > 0 ? ' <small>(힌트 사용)</small>' : slipped ? ' <small>(중간에 틀림)</small>' : ''}`
        : '✕ 틀렸어요'}</div>
      ${actions}
      ${cz.extras.length ? `
        <div class="cloze-extra">
          ${cz.extras.map((x) => `<div>${x.html}${x.ko ? `<div class="cloze-extra-ko">${esc(x.ko)}</div>` : ''}</div>`).join('')}
        </div>` : ''}`;
    if (practice) below.querySelector('#nextBtn').onclick = next;
    else below.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => rate(Number(b.dataset.r)); });
  }

  // 추천 채점: 틀리면 다시, 힌트를 봤거나 틀렸다가 고쳤다면 완전히 기억한 게 아니므로 어려움, 아니면 알맞음
  const suggested = () => (!result.ok ? AGAIN : hintCount > 0 || slipped ? HARD : GOOD);

  function start() {
    const c = session[idx];
    cz = makeCloze(c);
    result = null;
    hintCount = 0;
    slipped = false;
    vals = cz.parts.map(() => '');
    active = 0;
    input.value = '';
    const tag = practice ? '' : freshIds.has(c.id)
      ? '<span class="pill new">신규</span> '
      : '<span class="pill review">복습</span> ';
    info.innerHTML = `<span>남은 카드 ${session.length - idx}</span><span>${tag}<span class="pill">${esc(c.category || '표현')}</span></span>`;
    body.querySelector('#czKo').textContent = cz.ko;
    input.focus();
    drawSentence();
    drawBelow();
  }

  // 정답 공개. 오늘 학습의 채점(복습 일정 반영)은 4단계 버튼에서 rate()로
  function finish(ok, boxes) {
    // 연습은 채점 기록 없이, 틀린 카드만 몇 장 뒤에 다시 출제
    if (practice && !ok) session.splice(Math.min(idx + 4, session.length), 0, session[idx]);
    result = { ok, boxes: cz.parts.map((_, j) => boxes[j] || '') };
    input.value = '';
    drawSentence();
    drawBelow();
    info.querySelector('span').textContent = `남은 카드 ${session.length - idx}`;
  }

  function rate(r) {
    answerCard(session, idx, r);
    ctx.refreshHeader();
    next();
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
    if (result) return practice ? next() : rate(suggested());
    if (!vals.some((t) => t.trim())) return;
    finish(vals.every((t, j) => norm(t) === norm(cz.cores[j])), vals.slice());
  }

  function setActive(j) {
    active = j;
    input.value = vals[j];
    toEnd();
    drawSentence();
  }

  // 커서는 항상 맨 끝 (빈칸 표시와 어긋나지 않게)
  const toEnd = () => input.setSelectionRange(input.value.length, input.value.length);
  input.addEventListener('input', () => {
    if (result) {
      // 정답 공개 후엔 입력을 버림. 숫자 1~4는 4단계 버튼 단축키
      const r = '1234'.indexOf(input.value.slice(-1));
      input.value = '';
      if (r >= 0 && !practice) rate(r);
      return;
    }
    // 띄어쓰기를 치면 다음 칸으로 (마지막 칸에선 그대로 둠)
    const v = input.value;
    const sp = v.search(/\s/);
    if (sp >= 0 && active < vals.length - 1) {
      vals[active] = v.slice(0, sp);
      const rest = v.slice(sp).trim();
      active++;
      if (rest) vals[active] = rest;
      input.value = vals[active];
    } else {
      vals[active] = v;
    }
    toEnd();
    drawSentence();
    if (sentence.querySelector('.cz-box.no')) slipped = true;
  });
  input.addEventListener('click', toEnd);
  input.addEventListener('focus', () => { toEnd(); drawSentence(); });
  input.addEventListener('blur', drawSentence);
  input.onkeydown = (e) => {
    // 빈 칸에서 지우기를 누르면 앞 칸으로
    if (e.key === 'Backspace' && !result && !input.value && active > 0) {
      e.preventDefault();
      setActive(active - 1);
      return;
    }
    if (e.key !== 'Enter' || e.repeat) return;
    e.preventDefault();
    submit();
  };
  start();
}
