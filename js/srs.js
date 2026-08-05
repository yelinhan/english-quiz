// 간격 반복: Anki 스타일 SM-2. 카드별 ease로 간격이 곱셈 성장.
// 의도적 단순화: 분 단위 학습 단계 없음(같은 세션 재출제로 대체), 연체 경과 보너스·fuzz 없음.
import { store, todayStr, addDays, shuffle } from './store.js';

export const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3;
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 3.5;
const GRAD_IVL = 1, EASY_IVL = 4, MAX_IVL = 365;

export function newRecord() {
  return { st: 'learn', step: 0, ease: EASE_START, ivl: 0, due: todayStr(), reps: 0, lapses: 0 };
}

function graduate(rec, ivl, today) {
  rec.st = 'review';
  rec.step = 0;
  rec.ivl = ivl;
  rec.due = addDays(today, ivl);
}

// 순수 전이 함수: store 접근 없음. requeue=true면 이번 세션에서 다시 출제.
function applyRating(prev, rating, today) {
  const rec = { ...prev, reps: prev.reps + 1 };
  let requeue = false;

  if (rec.st === 'review') {
    if (rating === AGAIN) {
      rec.lapses += 1;
      rec.ease = Math.max(EASE_MIN, rec.ease - 0.2);
      rec.st = 'relearn';
      rec.step = 0;
      rec.ivl = GRAD_IVL;
      rec.due = today;
      requeue = true;
    } else {
      if (rating === HARD) {
        rec.ease = Math.max(EASE_MIN, rec.ease - 0.15);
        rec.ivl = Math.max(rec.ivl + 1, Math.round(rec.ivl * 1.2));
      } else if (rating === GOOD) {
        rec.ivl = Math.max(rec.ivl + 1, Math.round(rec.ivl * rec.ease));
      } else {
        rec.ease = Math.min(EASE_MAX, rec.ease + 0.15);
        rec.ivl = Math.max(rec.ivl + 2, Math.round(rec.ivl * rec.ease * 1.3));
      }
      rec.ivl = Math.min(rec.ivl, MAX_IVL);
      rec.due = addDays(today, rec.ivl);
    }
    return { rec, requeue };
  }

  // learn(신규) / relearn(리뷰 실패 후)
  if (rating === EASY) {
    graduate(rec, rec.st === 'relearn' ? 2 : EASY_IVL, today);
  } else if (rating === GOOD) {
    if (rec.st === 'learn' && rec.step === 0) {
      rec.step = 1;
      rec.due = addDays(today, 1);
    } else {
      graduate(rec, GRAD_IVL, today);
    }
  } else {
    if (rating === AGAIN) rec.step = 0;
    rec.due = today;
    requeue = true;
  }
  return { rec, requeue };
}

export function grade(cardId, rating) {
  const today = todayStr();
  const srs = store.srs();
  const { rec, requeue } = applyRating(srs[cardId] || newRecord(), rating, today);
  srs[cardId] = rec;
  store.saveSrs(srs);
  store.addLog({ d: today, id: cardId, ok: rating > AGAIN, r: rating });
  return { requeue };
}

function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function fmtIvl(days) {
  if (days <= 0) return '곧';
  if (days < 30) return `${days}일`;
  if (days < 365) return `${Math.round(days / 30)}개월`;
  return `${(days / 365).toFixed(1)}년`;
}

// 4버튼 각각의 예상 다음 복습 시점 라벨
export function previewIntervals(cardId) {
  const today = todayStr();
  const cur = store.srs()[cardId] || newRecord();
  const label = (rating) => {
    const { rec, requeue } = applyRating(cur, rating, today);
    return requeue ? '곧' : fmtIvl(diffDays(today, rec.due));
  };
  return { again: label(AGAIN), hard: label(HARD), good: label(GOOD), easy: label(EASY) };
}

// 오늘 세션 = 복습 기한 도래 카드 전부 + 새 카드 newLimit개
export function buildSession(cards, { filter, newLimit = 10 } = {}) {
  const pool = filter ? cards.filter(filter) : cards;
  const srs = store.srs();
  const today = todayStr();
  const due = pool.filter((c) => srs[c.id] && srs[c.id].due <= today);
  const fresh = pool.filter((c) => !srs[c.id]).slice(0, newLimit);
  return shuffle([...due, ...fresh]);
}

// 채점 + 필요 시 세션 몇 장 뒤에 재출제
export function answerCard(session, idx, rating) {
  const { requeue } = grade(session[idx].id, rating);
  if (requeue) session.splice(Math.min(idx + 4, session.length), 0, session[idx]);
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

// 구형 라이트너 레코드 {lv, due} → SM-2 레코드 변환 (멱등)
const MIGRATE_IVL = { 1: 3, 2: 7, 3: 30 };
export function migrate() {
  if (store.srsVersion() >= 2) return;
  const srs = store.srs();
  for (const [id, rec] of Object.entries(srs)) {
    if (!('lv' in rec)) continue;
    srs[id] = rec.lv === 0
      ? { st: 'learn', step: 1, ease: EASE_START, ivl: 0, due: rec.due, reps: 0, lapses: 0 }
      : { st: 'review', step: 0, ease: EASE_START, ivl: MIGRATE_IVL[rec.lv], due: rec.due, reps: rec.lv, lapses: 0 };
  }
  store.saveSrs(srs);
  store.saveSrsVersion(2);
}
