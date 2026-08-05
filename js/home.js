// 홈: 오늘 할 일 + 학습 통계 (월간 캘린더·최근 7일 차트)
import { store, todayStr, addDays, esc } from './store.js';
import { counts } from './srs.js';
import { computeStreak, todayCount, calendarHtml } from './stats.js';

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
  const quizDone = today >= goal;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 최근 7일 학습량
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(todayStr(), -i);
    days.push({ d, n: log.filter((e) => e.d === d).length });
  }
  const max = Math.max(...days.map((x) => x.n), 1);

  const byDay = {};
  log.forEach((e) => { byDay[e.d] = (byDay[e.d] || 0) + 1; });
  let [calY, calM] = todayStr().split('-').map(Number);

  el.innerHTML = `
    <h2 class="section-title">🏠 오늘</h2>
    <div class="stat-tiles">
      <div class="tile"><div class="num">🔥${streak}</div><div class="lbl">연속 학습일</div></div>
      <div class="tile"><div class="num">${today}/${goal}</div><div class="lbl">오늘 학습</div></div>
      <div class="tile"><div class="num">${due}</div><div class="lbl">복습 대기</div></div>
    </div>
    <div class="card-box">
      <h3 style="margin:0 0 10px; font-size:.9rem">오늘 할 일</h3>
      <button class="todo ${quizDone ? 'done' : ''}" data-go="quiz">
        <span>${quizDone ? '✅ 퀴즈 목표 달성!' : `🃏 퀴즈 — 복습 ${due}장 + 새 카드`}</span><span>→</span>
      </button>
      <button class="todo" data-go="cloze"><span>✏️ 빈칸 퀴즈</span><span>→</span></button>
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
      <p class="notice" style="margin-bottom:0">색이 진할수록 많이 학습한 날 · 목표(${goal}장) 달성 시 제일 진해져요</p>
    </div>
    <div class="card-box">
      <h3 style="margin:0 0 4px; font-size:.9rem">최근 7일 학습량</h3>
      <p class="notice" style="margin:0 0 6px">하루에 답한 카드 수</p>
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
    </div>`;

  el.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => ctx.show(b.dataset.go);
  });

  function drawCal() {
    el.querySelector('#calTitle').textContent = `${calY}년 ${calM}월`;
    el.querySelector('#calGrid').innerHTML = calendarHtml(calY, calM, byDay, goal);
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
