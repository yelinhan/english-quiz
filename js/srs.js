// 간격 반복: 틀림 → 1일 뒤, 맞춤 → 3일 → 7일 → 30일(이후 30일 유지)
import { store, todayStr, addDays, shuffle } from './store.js';

const INTERVALS = { 1: 3, 2: 7, 3: 30 };

export function grade(cardId, ok) {
  const srs = store.srs();
  const cur = srs[cardId] || { lv: 0, due: todayStr() };
  if (ok) {
    const lv = Math.min(cur.lv + 1, 3);
    srs[cardId] = { lv, due: addDays(todayStr(), INTERVALS[lv]) };
  } else {
    srs[cardId] = { lv: 0, due: addDays(todayStr(), 1) };
  }
  store.saveSrs(srs);
  store.addLog({ d: todayStr(), id: cardId, ok });
}

// 오늘 세션 = 복습 기한 도래 카드 전부 + 새 카드 10개
export function buildSession(cards, newLimit = 10) {
  const srs = store.srs();
  const today = todayStr();
  const due = cards.filter((c) => srs[c.id] && srs[c.id].due <= today);
  const fresh = cards.filter((c) => !srs[c.id]).slice(0, newLimit);
  return shuffle([...due, ...fresh]);
}

export function counts(cards) {
  const srs = store.srs();
  const today = todayStr();
  let due = 0;
  let fresh = 0;
  for (const c of cards) {
    if (!srs[c.id]) fresh++;
    else if (srs[c.id].due <= today) due++;
  }
  return { due, fresh, learned: cards.length - fresh };
}
