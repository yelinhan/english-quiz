// 학습 통계 헬퍼: streak·오늘 학습량·월간 캘린더 (화면은 홈 탭에서 그림)
import { todayStr, addDays } from './store.js';

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

// 날짜별 새 카드 수 = 그날 처음 채점한 카드 수 (하루 목표는 새 카드 기준 — 복습·다시 풀기는 안 셈)
export function newCardsByDay(log) {
  const first = {};
  for (const e of log) if (!first[e.id] || e.d < first[e.id]) first[e.id] = e.d;
  const byDay = {};
  for (const d of Object.values(first)) byDay[d] = (byDay[d] || 0) + 1;
  return byDay;
}

// 오늘 새로 배운 카드 수 (헤더·홈의 '오늘 새 카드 n / 목표')
export function todayCount(log) {
  return newCardsByDay(log)[todayStr()] || 0;
}

// 월간 캘린더: 그날 새 카드 수를 색 농도로 (목표 달성 시 제일 진함). 복습만 한 날도 연하게 표시
export function calendarHtml(y, m, byDay, goal, studied = new Set()) {
  const startDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<span class="cal-cell empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = byDay[ymd] || 0;
    const lvl = n >= goal ? 3 : n >= goal / 2 ? 2 : n > 0 || studied.has(ymd) ? 1 : 0;
    cells.push(`<span class="cal-cell l${lvl} ${ymd === todayStr() ? 'today' : ''}" title="${ymd}: 새 카드 ${n}장">${d}</span>`);
  }
  return cells.join('');
}
