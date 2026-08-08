// localStorage 기반 상태 저장. 모든 키는 eq. 접두사.
const get = (k, dflt) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? dflt : JSON.parse(v);
  } catch {
    return dflt;
  }
};

// 쓰기 리스너: sync.js가 등록해서 변경된 키를 서버로 push
let onWrite = null;
export function setStoreListener(fn) {
  onWrite = fn;
}
const set = (k, v) => {
  localStorage.setItem(k, JSON.stringify(v));
  if (onWrite) onWrite(k);
};

export const store = {
  srs: () => get('eq.srs', {}),
  saveSrs: (s) => set('eq.srs', s),
  srsVersion: () => get('eq.srsVersion', 1),
  saveSrsVersion: (v) => set('eq.srsVersion', v),
  log: () => get('eq.log', []),
  addLog: (entry) => {
    const l = get('eq.log', []);
    l.push(entry);
    set('eq.log', l);
  },
  custom: () => get('eq.custom', []),
  saveCustom: (c) => set('eq.custom', c),
  corrections: () => get('eq.corrections', []),
  saveCorrections: (c) => set('eq.corrections', c),
  overrides: () => get('eq.overrides', {}),
  saveOverrides: (o) => set('eq.overrides', o),
  deleted: () => get('eq.deleted', []),
  saveDeleted: (d) => set('eq.deleted', d),
  goal: () => get('eq.goal', 20),
  saveGoal: (g) => set('eq.goal', g),
  writingDays: () => get('eq.writingDays', []),
  markWritingDay: () => {
    const days = get('eq.writingDays', []);
    const t = todayStr();
    if (!days.includes(t)) {
      days.push(t);
      set('eq.writingDays', days);
    }
  },
  aiProvider: () => get('eq.aiProvider', 'anthropic'),
  saveAiProvider: (p) => set('eq.aiProvider', p),
  aiKeys: () => {
    const keys = get('eq.aiKeys', {});
    // 구버전 단일 키(eq.apikey) 호환
    if (!keys.anthropic) {
      const legacy = localStorage.getItem('eq.apikey');
      if (legacy) keys.anthropic = legacy;
    }
    return keys;
  },
  saveAiKeys: (k) => set('eq.aiKeys', k),
  apiKey: () => store.aiKeys()[store.aiProvider()] || '', // 현재 공급자의 키
  saveApiKey: (k) => {
    const keys = store.aiKeys();
    keys[store.aiProvider()] = k;
    store.saveAiKeys(keys);
  },
};

export function todayStr() {
  return dateStr(new Date());
}

export function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dateStr(dt);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 예문 문자열을 문장 단위로 분할. 말줄임표(..., …)는 문장 끝이 아니라 말끝 흐림이므로
// 경계로 보지 않는다. (구형 Safari 호환을 위해 lookbehind 미사용)
export function splitSentences(s) {
  const text = String(s || '');
  const out = [];
  let cur = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '.' || ch === '?' || ch === '!' || ch === '…') {
      let j = i;
      while (j < text.length && '.?!…'.includes(text[j])) j++;
      const punct = text.slice(i, j);
      cur += punct;
      if (j < text.length && (text[j] === '"' || text[j] === "'")) { cur += text[j]; j++; }
      if (!punct.includes('..') && !punct.includes('…')) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      }
      i = j;
    } else {
      cur += ch;
      i++;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// "Q? A." 처럼 짧은 질문+답이 한 예문인 경우 합쳐서 해석과 개수를 맞춘다
function mergeQuestions(parts) {
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].endsWith('?') && parts[i].length <= 25 && i + 1 < parts.length) {
      out.push(parts[i] + ' ' + parts[i + 1]);
      i++;
    } else {
      out.push(parts[i]);
    }
  }
  return out;
}

// 예문·해석을 문장 단위로 짝지음. 개수가 안 맞으면 null (통짜 표시로 폴백)
export function pairExamples(c) {
  let en = splitSentences(c.example);
  let ko = splitSentences(c.example_ko || '');
  if (!en.length || !ko.length) return null;
  if (en.length !== ko.length) {
    en = mergeQuestions(en);
    ko = mergeQuestions(ko);
  }
  if (en.length !== ko.length) return null;
  return en.map((s, i) => ({ en: s, ko: ko[i] }));
}
