// 홈 대시보드: 오늘 할 일 + 이번 달 학습 캘린더 + 바로가기
import { store, todayStr } from './store.js';
import { counts } from './srs.js';
import { computeStreak, todayCount, calendarHtml } from './stats.js';

export function render(el, ctx) {
  const log = store.log();
  const goal = store.goal();
  const today = todayCount(log);
  const streak = computeStreak(log);
  const { due } = counts(ctx.cards);
  const wroteToday = store.corrections().some((c) => c.date === todayStr())
    || store.writingDays().includes(todayStr());
  const quizDone = today >= goal;

  const byDay = {};
  log.forEach((e) => { byDay[e.d] = (byDay[e.d] || 0) + 1; });
  const [y, m] = todayStr().split('-').map(Number);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

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
      <h3 style="margin:0 0 10px; font-size:.9rem">${m}월 학습 기록</h3>
      <div class="cal-dow">${dayNames.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${calendarHtml(y, m, byDay, goal)}</div>
    </div>`;

  el.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => ctx.show(b.dataset.go);
  });
}
