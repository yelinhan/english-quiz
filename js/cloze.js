// 퀴즈 탭: 예문 속 표현(핵심 단어가 표시돼 있으면 그 단어만)을 빈칸으로 뚫고 직접 타이핑해서 맞추기 (새 카드·복습 카드 모두)
import { store, esc, splitSentences, pairExamples, todayStr, shuffle } from './store.js';
import { buildSession, answerCard, previewIntervals, NEW_PER_DAY, GOOD, HARD, AGAIN } from './srs.js';
import * as kbd from './keyboard.js';

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

const range = (start, len) => Array.from({ length: len }, (_, j) => start + j);

// 표현 변형 구분: 띄어쓴 " / " = 서로 다른 표현(카드가 따로 생김),
// 붙여 쓴 a/b (단어장의 [happy/thrilled]) = 같은 빈칸의 대안(한 카드, 어느 쪽이든 정답)
export const splitEn = (en) => String(en || '').split(/\s+\/\s+/).map((v) => v.trim()).filter(Boolean);
const altsOf = (seg) => seg.split('/').map((s) => s.trim()).filter(Boolean);

// 핵심 단어 묶음들(segs)이 words[from, to) 안에 순서대로 나오는 위치 → 묶음별 { idxs, alts } 또는 null.
// 묶음 사이엔 몇 단어가 끼어도 됨 — 구동사 짝: set me up, put the redesign on hold.
// 대안이 있는 묶음([happy/thrilled])은 문장에 든 쪽을 찾음
const KEY_GAP = 4;
function findKeySegs(words, segs, from = 0, to = words.length) {
  for (let s = from; s < to; s++) {
    const found = [];
    let pos = s;
    for (let n = 0; n < segs.length; n++) {
      let best = null;
      for (const alt of altsOf(segs[n])) {
        const kw = toWords(alt);
        if (!kw.length) continue;
        const end = Math.min(to, pos + kw.length + (n === 0 ? 0 : KEY_GAP));
        const at = findRun(words.slice(pos, end), kw, true);
        if (at >= 0 && (!best || at < best.at)) best = { at, len: kw.length };
      }
      if (!best) break;
      found.push({ idxs: range(pos + best.at, best.len), alts: altsOf(segs[n]) });
      pos += best.at + best.len;
    }
    if (found.length === segs.length) return found;
  }
  return null;
}
const findKey = (...args) => findKeySegs(...args)?.flatMap((g) => g.idxs) ?? null;

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

// 변형별 [ ] 묶음 목록. 예전 포맷(변형별 문자열 하나)도 받음
const normKeys = (keys) => (keys || []).map((k) => (k == null || Array.isArray(k) ? k : [k]));

// 같은 뜻의 다른 표현이 " / "로 묶인 카드를 표현마다 별도 카드로 나눈다 (swamped / behind on).
// 첫 표현은 원래 id를 그대로 써서 지금까지의 학습 기록(퀴즈가 첫 표현만 출제했으므로 그 표현의 기록)을
// 이어받고, 나머지는 id-v1, id-v2… 예문은 그 표현이 든 문장만 가져가고, 어느 표현도 안 든 문장은 첫 표현 카드로.
// group = 원래 id (같은 뜻 카드끼리 묶음), v = 표현 번호
export function splitVariants(card) {
  const variants = splitEn(card.en);
  if (variants.length < 2) return [card];
  const keys = normKeys(card.keys);
  const pairs = pairExamples(card);
  const sents = pairs ? pairs.map((p) => p.en) : splitSentences(card.example);
  const owner = sents.map((s) => {
    const ws = s.split(' ');
    const exact = variants.findIndex((v) => {
      const vw = toWords(v);
      return vw.length > 0 && findRun(ws, vw, false) >= 0;
    });
    if (exact >= 0) return exact;
    // 어미 변화 허용 (colleague → colleagues)
    const loose = variants.findIndex((v) => {
      const vw = toWords(v);
      return vw.length > 0 && findRun(ws, vw, true) >= 0;
    });
    if (loose >= 0) return loose;
    const keyed = keys.findIndex((segs) => segs && findKey(ws, segs));
    if (keyed >= 0) return keyed;
    const part = variants.findIndex((v) => partialSpan(ws, [v]));
    return part >= 0 ? part : 0;
  });
  return variants.map((en, v) => {
    const mine = sents.map((_, i) => i).filter((i) => owner[i] === v);
    const c = {
      ...card,
      id: v ? `${card.id}-v${v}` : card.id,
      en,
      group: card.id,
      v,
      example: mine.map((i) => sents[i]).join(' '),
      // 문장별 해석 짝이 안 맞으면 나눌 수 없으니 비움 (퀴즈는 표현 뜻으로 대체)
      example_ko: pairs ? mine.map((i) => pairs[i].ko).join(' ') : '',
    };
    if (keys[v]) c.keys = [keys[v]];
    else delete c.keys;
    return c;
  });
}

// 단어장 탭의 수정·삭제 키. 나뉜 카드는 첫 표현도 원래 id(= 카드 통째)와 구분되게 group-v0
export const editKey = (c) => (c.group ? `${c.group}-v${c.v}` : c.id);

// 추가 예문에서 표현 구간을 강조 표시 (대안 표현처럼 그대로 안 든 경우엔 핵심 단어만)
function highlight(sentence, variants, keys) {
  const words = sentence.split(' ');
  const m = exactSpan(words, variants) || partialSpan(words, variants);
  let on = m ? range(m.start, m.len) : null;
  for (const segs of keys) if (!on && segs) on = findKey(words, segs);
  if (!on) return esc(sentence);
  return words.map((w, i) => (on.includes(i) ? `<span class="blank">${esc(w)}</span>` : esc(w))).join(' ');
}

// 채점 단위. 보통은 빈칸 하나씩이고, 대안이 있는 묶음([happy/thrilled])은 그 칸들을 통째로 보고
// 어느 대안이든 정답. 예문의 어미 변화는 다른 대안에도 붙여줌 (teammates → coworkers도 정답)
function makeGroups(pick, cores) {
  const one = (j) => ({ boxes: [j], alts: [], answers: [norm(cores[j])] });
  if (!pick.segs) return cores.map((_, j) => one(j));
  const groups = [];
  let j = 0;
  for (const s of pick.segs) {
    const boxes = range(j, s.idxs.length);
    j += s.idxs.length;
    if (s.alts.length < 2) { boxes.forEach((b) => groups.push(one(b))); continue; }
    const core = norm(boxes.map((b) => cores[b]).join(''));
    const hit = s.alts.map(norm).find((a) => core.startsWith(a)) || '';
    const suffix = hit ? core.slice(hit.length) : '';
    groups.push({ boxes, alts: s.alts, answers: [...new Set([core, ...s.alts.map((a) => norm(a) + suffix)])] });
  }
  return groups;
}

// 표현이 든 문장 하나만 빈칸 문제로 출제. 나머지 문장은 정답 공개 후에만
// 추가 예문으로 보여준다 (미리 보이면 답이 노출되므로).
// 출제 구간 (핵심 단어를 최대한 묻도록): ① 핵심 단어가 표시된 변형이 그대로 든 문장 → 그 단어만 빈칸
// ② 표현은 조금 달라도 핵심 단어가 든 문장 ③ 표시 없는 변형이 그대로 든 문장 → 표현 전체가 빈칸
// ④ 표현 앞 두 단어 ⑤ 가장 긴 단어
export function makeCloze(card) {
  if (!card.example) return null;
  const variants = splitEn(card.en);
  const keys = normKeys(card.keys);
  const pairs = pairExamples(card);
  const sents = pairs ? pairs.map((p) => p.en) : splitSentences(card.example);
  const kos = pairs ? pairs.map((p) => p.ko) : [];
  const split = sents.map((s) => s.split(' '));

  // pick = { i: 문장 번호, blanks: 빈칸 단어 번호들, segs?: 핵심 단어 묶음별 위치·대안 }
  let pick = null;
  let whole = null;
  const keyPick = (i, segs) => segs && { i, segs, blanks: segs.flatMap((g) => g.idxs) };
  for (let i = 0; i < sents.length && !pick; i++) {
    const m = exactSpan(split[i], variants);
    if (!m) continue;
    pick = keys[m.v] ? keyPick(i, findKeySegs(split[i], keys[m.v], m.start, m.start + m.len)) : null;
    if (!pick && !whole) whole = { i, blanks: range(m.start, m.len) };
  }
  for (let i = 0; i < sents.length && !pick; i++) {
    for (const segs of keys) {
      pick = segs ? keyPick(i, findKeySegs(split[i], segs)) : null;
      if (pick) break;
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
    .map((s, i) => ({ html: highlight(s, variants, keys), ko: kos[i] || '', idx: i }))
    .filter((x) => x.idx !== pick.i);
  const cores = parts.map((m) => m[2]);
  return {
    words,
    blanks: pick.blanks,
    parts,
    cores,
    groups: makeGroups(pick, cores),
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

// 친 글자를 정답(정규화된 want)과 바로 비교: 맞는 데까지 초록, 처음 틀린 글자부터 빨강 (대소문자·아포스트로피 무시).
// k = 맞게 친 글자 수 (여러 칸짜리 묶음에서 다음 칸이 이어서 비교할 위치)
function liveBox(typed, want) {
  let k = 0;
  let bad = -1;
  [...typed].forEach((ch, i) => {
    if (bad >= 0 || !/[a-z]/i.test(ch)) return;
    if (ch.toLowerCase() === want[k]) k++;
    else bad = i;
  });
  if (bad < 0) return { k, cls: typed.trim() ? ' ok' : '', html: `<span class="cz-ok">${esc(typed)}</span>` };
  return { k, cls: ' no', html: `<span class="cz-ok">${esc(typed.slice(0, bad))}</span><span class="cz-no">${esc(typed.slice(bad))}</span>` };
}

// 묶음에 친 글자(정규화) → 지금까지 가장 잘 맞는 정답 (대안 중 앞부분이 가장 길게 일치하는 것)
function bestAnswer(g, typed) {
  const common = (a) => { let n = 0; while (n < typed.length && typed[n] === a[n]) n++; return n; };
  return g.answers.reduce((best, a) => (common(a) > common(best) ? a : best), g.answers[0]);
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
  kbd.detach(); // 세션이 시작될 때만 자판을 붙임

  // 한 화면에 다 보이도록 안내 문구 없이. 오늘 푼 카드 다시 풀기(복습 일정·기록 영향 없음)는 상단 바 오른쪽 토글
  el.innerHTML = '<div id="czBody"></div>';
  const bar = document.getElementById('barAction');
  bar.innerHTML = `<button class="bar-toggle${practice ? ' on' : ''}" aria-pressed="${practice}">🔁 오늘 복습</button>`;
  bar.firstElementChild.onclick = () => {
    mode = practice ? 'srs' : 'today';
    render(el, ctx);
  };
  const body = el.querySelector('#czBody');

  // 끝 화면: 연습은 다시 하기, 오늘 학습은 하루 상한과 별개로 새 카드를 더 받을 수 있게
  function endScreen(icon, title, msg) {
    kbd.detach();
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
      body.innerHTML = '<p class="notice">오늘 푼 카드가 아직 없어요. 오른쪽 위 🔁 오늘 복습을 끄고 오늘 학습부터 풀어보세요!</p>';
    } else if (!ctx.cards.some((c) => c.example)) {
      body.innerHTML = '<p class="notice">예문이 있는 카드가 없어요.</p>';
    } else {
      endScreen('✅', '오늘 할 카드를 다 했어요', '복습 카드는 내일 다시 나와요.');
    }
    return;
  }

  // 별도 입력칸 없이 문장 빈칸에 바로 채워 넣는다. 시스템 키보드 대신 화면 아래 앱 자판(keyboard.js)으로
  // 입력하므로 키보드가 화면을 밀어 올리지 않음. 빈칸을 탭하면 그 칸으로
  body.innerHTML = `
    <div class="cardzone">
      <div class="session-info" id="czInfo"></div>
      <div class="flashcard cloze-card" id="czCard">
        <div class="ko cz-sentence" id="czSentence"></div>
        <div class="ex" id="czKo"></div>
      </div>
      <div class="cloze-below" id="czBelow"></div>
    </div>`;
  const info = body.querySelector('#czInfo');
  const sentence = body.querySelector('#czSentence');
  const below = body.querySelector('#czBelow');
  body.querySelector('#czCard').addEventListener('click', (e) => {
    if (result) return;
    const box = e.target.closest('.cz-box');
    if (box) setActive(Number(box.dataset.j));
  });

  const groupOf = (j) => cz.groups.find((g) => g.boxes.includes(j));
  const typedIn = (g, boxes = vals) => norm(g.boxes.map((b) => boxes[b] || '').join(''));
  const groupOk = (g, boxes = vals) => g.answers.includes(typedIn(g, boxes));

  function drawSentence() {
    if (result) {
      sentence.innerHTML = sentenceHtml(cz, (j, core) => {
        if (groupOk(groupOf(j), result.boxes)) return `<span class="cz-box ok">${esc(core)}</span>`;
        const t = result.boxes[j].trim();
        return `<span class="cz-box no">${t ? `<s>${esc(t)}</s>` : ''}${esc(core)}</span>`;
      });
      return;
    }
    // 묶음마다 가장 잘 맞는 정답에 대고 칸을 이어서 비교
    const live = [];
    for (const g of cz.groups) {
      const want = bestAnswer(g, typedIn(g));
      let k = 0;
      for (const b of g.boxes) {
        live[b] = liveBox(vals[b], want.slice(k));
        k += live[b].k;
      }
    }
    // 빈 칸에도 폭 없는 공백(&#8203;)을 넣어 글자 기준선을 만든다 — 없으면 빈 칸만 위로 떠서 칸마다 높이가 달라짐
    sentence.innerHTML = sentenceHtml(cz, (j, core) =>
      `<span class="cz-box${live[j].cls}${j === active ? ' on' : ''}" data-j="${j}" style="min-width:${Math.min(core.length + 1, 14)}ch">&#8203;${live[j].html}${j === active ? '<i class="cz-caret"></i>' : ''}</span>`);
  }

  function drawBelow() {
    kbd.setState(result ? { idle: true, enter: '다음' } : { idle: false, enter: '확인' });
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
        </div>`;
    }
    // 정답 공개 후에만 (미리 보이면 힌트가 됨): 같은 빈칸에 들어갈 수 있는 대안 + 같은 뜻의 다른 표현 카드
    const c = session[idx];
    const sibs = c.group ? ctx.cards.filter((x) => x.group === c.group && x.id !== c.id) : [];
    const alts = cz.groups.filter((g) => g.alts.length > 1);
    below.innerHTML = `
      ${actions}
      ${alts.length ? `<div class="cz-sibs">✅ 다 정답: ${alts.map((g) => g.alts.map((a) => `<b>${esc(a)}</b>`).join(' · ')).join(' / ')}</div>` : ''}
      ${sibs.length ? `<div class="cz-sibs">🔁 같은 뜻 다른 표현: ${sibs.map((x) => `<b>${esc(x.en)}</b>`).join(' · ')}</div>` : ''}
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
    const tag = practice ? '' : freshIds.has(c.id)
      ? '<span class="pill new">신규</span> '
      : '<span class="pill review">복습</span> ';
    info.innerHTML = `<span>남은 카드 ${session.length - idx}</span><span>${tag}<span class="pill">${esc(c.category || '표현')}</span></span>`;
    body.querySelector('#czKo').textContent = cz.ko;
    drawSentence();
    drawBelow();
  }

  // 정답 공개. 오늘 학습의 채점(복습 일정 반영)은 4단계 버튼에서 rate()로
  function finish(ok, boxes) {
    // 연습은 채점 기록 없이, 틀린 카드만 몇 장 뒤에 다시 출제
    if (practice && !ok) session.splice(Math.min(idx + 4, session.length), 0, session[idx]);
    result = { ok, boxes: cz.parts.map((_, j) => boxes[j] || '') };
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
    finish(cz.groups.every((g) => groupOk(g)), vals.slice());
  }

  function setActive(j) {
    active = j;
    drawSentence();
  }

  // 지금 칸을 정답대로 다 쳤으면 스페이스 없이 바로 다음 칸으로 (마지막 칸은 Enter로 확인).
  // 대안 묶음은 어느 대안이든 끝까지 맞으면 묶음 다음 칸으로 — 더 긴 대안의 앞부분이면 기다림
  function advance() {
    while (active < vals.length - 1) {
      const g = groupOf(active);
      const t = typedIn(g);
      const last = g.boxes[g.boxes.length - 1];
      if (g.answers.includes(t) && !g.answers.some((a) => a !== t && a.startsWith(t))) {
        if (last >= vals.length - 1) return;
        active = last + 1;
      } else if (active < last && norm(vals[active]) && norm(vals[active]) === norm(cz.cores[active])) {
        active++;
      } else {
        return;
      }
    }
  }

  // 앱 자판·물리 키보드 공통 입력
  function onKey(type, v) {
    if (result) {
      // 정답 공개 후엔 Enter(다음)와 숫자 1~4(4단계 버튼 단축키)만
      if (type === 'enter') submit();
      else if (type === 'digit' && !practice) rate(v - 1);
      return;
    }
    if (type === 'enter') return submit();
    if (type === 'char') {
      vals[active] += v;
      advance();
    } else if (type === 'space') {
      // 띄어쓰기 = 다음 칸. 빈 칸에서 친 스페이스는 버림
      // — 정답이라 자동으로 넘어온 직후 습관처럼 친 스페이스에 다음 칸까지 건너뛰지 않게
      if (vals[active].trim() && active < vals.length - 1) active++;
    } else if (type === 'back') {
      // 빈 칸에서 지우기를 누르면 앞 칸으로
      if (vals[active]) vals[active] = vals[active].slice(0, -1);
      else if (active > 0) active--;
    } else {
      return;
    }
    drawSentence();
    if (sentence.querySelector('.cz-box.no')) slipped = true;
  }
  kbd.attach(onKey);
  start();
}
