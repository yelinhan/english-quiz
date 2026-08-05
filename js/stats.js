// 통계: streak, 오늘 학습량, 정답률, 최근 7일 차트
import { store, todayStr, addDays, esc } from './store.js';
import { counts } from './srs.js';

export function computeStreak(log) {
  const days = new Set(log.map((e) => e.d));
  let streak = 0;
  let d = todayStr();
  // 오늘 아직 안 했으면 어제부터 계산
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export function todayCount(log) {
  const t = todayStr();
  return log.filter((e) => e.d === t).length;
}

// 월간 캘린더: 하루 학습량을 색 농도로 표시
function calendarHtml(y, m, byDay, goal) {
  const startDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<span class="cal-cell empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = byDay[ymd] || 0;
    const lvl = n === 0 ? 0 : n >= goal ? 3 : n >= goal / 2 ? 2 : 1;
    cells.push(`<span class="cal-cell l${lvl} ${ymd === todayStr() ? 'today' : ''}" title="${ymd}: ${n}장">${d}</span>`);
  }
  return cells.join('');
}

export function render(el, ctx) {
  const log = store.log();
  const streak = computeStreak(log);
  const today = todayCount(log);
  const week = log.filter((e) => e.d >= addDays(todayStr(), -6));
  const accuracy = week.length ? Math.round((week.filter((e) => e.ok).length / week.length) * 100) : 0;
  const { learned, fresh } = counts(ctx.cards);

  // 최근 7일 학습량
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(todayStr(), -i);
    days.push({ d, n: log.filter((e) => e.d === d).length });
  }
  const max = Math.max(...days.map((x) => x.n), 1);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  el.innerHTML = `
    <h2 class="section-title">📊 학습 통계</h2>
    <div class="stat-tiles">
      <div class="tile"><div class="num">🔥${streak}</div><div class="lbl">연속 학습일</div></div>
      <div class="tile"><div class="num">${today}</div><div class="lbl">오늘 학습</div></div>
      <div class="tile"><div class="num">${accuracy}%</div><div class="lbl">7일 정답률</div></div>
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
    <div class="card-box">
      <div class="cal-nav">
        <button class="ghost" id="calPrev" aria-label="이전 달">←</button>
        <h3 id="calTitle"></h3>
        <button class="ghost" id="calNext" aria-label="다음 달">→</button>
      </div>
      <div class="cal-dow">${dayNames.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid" id="calGrid"></div>
      <p class="notice" style="margin-bottom:0">색이 진할수록 많이 학습한 날 · 목표(${store.goal()}장) 달성 시 제일 진해져요</p>
    </div>
    <div class="stat-tiles" style="grid-template-columns:1fr 1fr">
      <div class="tile"><div class="num">${learned}</div><div class="lbl">학습 시작한 카드</div></div>
      <div class="tile"><div class="num">${fresh}</div><div class="lbl">남은 새 카드</div></div>
    </div>`;

  const byDay = {};
  log.forEach((e) => { byDay[e.d] = (byDay[e.d] || 0) + 1; });
  let [calY, calM] = todayStr().split('-').map(Number);

  function drawCal() {
    el.querySelector('#calTitle').textContent = `${calY}년 ${calM}월`;
    el.querySelector('#calGrid').innerHTML = calendarHtml(calY, calM, byDay, store.goal());
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
