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

export function todayCount(log) {
  const t = todayStr();
  return log.filter((e) => e.d === t).length;
}

// 월간 캘린더: 하루 학습량을 색 농도로 표시
export function calendarHtml(y, m, byDay, goal) {
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
