// 홈: 오늘 할 일 + 학습 통계 (월간 캘린더·최근 7일 차트)
import { store, todayStr, addDays, esc } from './store.js';
import { counts, newLeftToday } from './srs.js';
import { computeStreak, todayCount, newCardsByDay, calendarHtml } from './stats.js';
import { showGrammarCard } from './writing.js';
import { todayStatus } from './sentences.js';

export function render(el, ctx) {
  const log = store.log();
  const goal = store.goal();
  const today = todayCount(log);
  const streak = computeStreak(log);
  const { due, fresh, learned } = counts(ctx.cards);
  const week = log.filter((e) => e.d >= addDays(todayStr(), -6));
  const accuracy = week.length ? Math.round((week.filter((e) => e.ok).length / week.length) * 100) : 0;
  const wroteToday = store.corrections().some((c) => c.date === todayStr())
    || store.writingDays().includes(todayStr());
  // 하루 목표 = 새 카드 수. 퀴즈 할 일은 새 카드 목표 + 오늘 복습까지 끝나야 완료
  const newLeft = newLeftToday();
  const quizDone = newLeft === 0 && due === 0;
  const quizTodo = [due ? `복습 ${due}장` : '', newLeft ? `새 카드 ${newLeft}장` : ''].filter(Boolean).join(' + ');
  const sent = todayStatus(ctx.sentences || []);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 최근 7일 학습량 — 그날 공부한 카드 수 (같은 카드를 여러 번 풀어도 1장)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(todayStr(), -i);
    days.push({ d, n: new Set(log.filter((e) => e.d === d).map((e) => e.id)).size });
  }
  const max = Math.max(...days.map((x) => x.n), 1);

  const byDay = newCardsByDay(log);
  const studied = new Set(log.map((e) => e.d));
  let [calY, calM] = todayStr().split('-').map(Number);

  // 영작 첨삭 + 수업 표현 업그레이드 태그 집계 → 자주 틀리는 포인트 TOP 5 (영작 기록 한도가 50건이라 전체 집계)
  const tagCounts = {};
  (ctx.lessons || []).forEach((l) => (l.upgrades || []).forEach((u) =>
    (u.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; })));
  store.corrections().forEach((c) => {
    const lists = c.mode === 'tr'
      ? [c.result?.tags]
      : (c.result?.corrections || []).map((x) => x.tags);
    lists.forEach((tags) => (tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  el.innerHTML = `
    <h2 class="section-title">🏠 오늘</h2>
    <div class="stat-tiles">
      <div class="tile"><div class="num">🔥${streak}</div><div class="lbl">연속 학습일</div></div>
      <div class="tile"><div class="num">${today}/${goal}</div><div class="lbl">오늘 새 카드</div></div>
      <div class="tile"><div class="num">${due}</div><div class="lbl">복습 대기</div></div>
    </div>
    <div class="card-box">
      <h3 style="margin:0 0 10px; font-size:.9rem">오늘 할 일</h3>
      <button class="todo ${quizDone ? 'done' : ''}" data-go="quiz">
        <span>${quizDone ? '✅ 오늘 퀴즈 완료!' : `✏️ 퀴즈 — ${quizTodo}`}</span><span>→</span>
      </button>
      ${sent.total ? `
      <button class="todo ${sent.done ? 'done' : ''}" data-go="sentences">
        <span>${sent.done ? '✅ 오늘 통문장 완료!' : `🗣 통문장 — ${sent.left}문장${sent.fresh ? ` (새 문장 ${sent.fresh}개)` : ''}`}</span><span>→</span>
      </button>` : ''}
      <button class="todo ${wroteToday ? 'done' : ''}" data-go="writing">
        <span>${wroteToday ? '✅ 오늘 영작 완료!' : '✍️ 문장 영작 1개'}</span><span>→</span>
      </button>
    </div>
    <div class="card-box">
      <div class="cal-nav">
        <button class="ghost" id="calPrev" aria-label="이전 달">←</button>
        <h3 id="calTitle"></h3>
        <button class="ghost" id="calNext" aria-label="다음 달">→</button>
      </div>
      <div class="cal-dow">${dayNames.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid" id="calGrid"></div>
      <p class="notice" style="margin-bottom:0">색이 진할수록 새 카드를 많이 배운 날 · 목표(새 카드 ${goal}장) 달성 시 제일 진해져요</p>
    </div>
    <div class="card-box">
      <h3 style="margin:0 0 4px; font-size:.9rem">최근 7일 학습량</h3>
      <p class="notice" style="margin:0 0 6px">하루에 공부한 카드 수 (새 카드 + 복습, 같은 카드는 1장)</p>
      <div class="chart">
        ${days.map((x) => {
          const [y, m, dd] = x.d.split('-').map(Number);
          const dow = dayNames[new Date(y, m - 1, dd).getDay()];
          const h = Math.round((x.n / max) * 100);
          return `
            <div class="col ${x.d === todayStr() ? 'today' : ''}" title="${esc(x.d)}: ${x.n}장">
              <span class="val">${x.n || ''}</span>
              <div class="bar ${x.n ? '' : 'zero'}" style="height:${Math.max(h, 2)}%"></div>
              <span class="day">${dow}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
    <div class="stat-tiles">
      <div class="tile"><div class="num">${accuracy}%</div><div class="lbl">7일 정답률</div></div>
      <div class="tile"><div class="num">${learned}</div><div class="lbl">학습 시작한 카드</div></div>
      <div class="tile"><div class="num">${fresh}</div><div class="lbl">남은 새 카드</div></div>
    </div>
    ${topTags.length ? `
    <div class="card-box">
      <h3 style="margin:0 0 4px; font-size:.9rem">🏷 자주 틀리는 포인트</h3>
      <p class="notice" style="margin:0 0 10px">전화영어 수업·영작 첨삭에서 지적된 횟수예요 · 누르면 내 실수 모음이랑 설명 카드가 떠요</p>
      ${topTags.map(([t, n]) => `
        <button class="weak-row" data-tag="${esc(t)}">
          <span class="weak-name">${esc(t)}</span>
          <span class="weak-bar"><i style="width:${Math.round((n / topTags[0][1]) * 100)}%"></i></span>
          <span class="weak-n">${n}회</span>
        </button>`).join('')}
    </div>` : ''}`;

  el.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => ctx.show(b.dataset.go);
  });
  el.querySelectorAll('.weak-row').forEach((b) => {
    b.onclick = () => showGrammarCard(b.dataset.tag);
  });

  function drawCal() {
    el.querySelector('#calTitle').textContent = `${calY}년 ${calM}월`;
    el.querySelector('#calGrid').innerHTML = calendarHtml(calY, calM, byDay, goal, studied);
  }
  el.querySelector('#calPrev').onclick = () => {
    calM--;
    if (calM === 0) { calM = 12; calY--; }
    drawCal();
  };
  el.querySelector('#calNext').onclick = () => {
    calM++;
    if (calM === 13) { calM = 1; calY++; }
    drawCal();
  };
  drawCal();
}
