// localStorage 기반 상태 저장. 모든 키는 eq. 접두사.
const get = (k, dflt) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? dflt : JSON.parse(v);
  } catch {
    return dflt;
  }
};
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const store = {
  srs: () => get('eq.srs', {}),
  saveSrs: (s) => set('eq.srs', s),
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
  goal: () => get('eq.goal', 20),
  saveGoal: (g) => set('eq.goal', g),
  apiKey: () => localStorage.getItem('eq.apikey') || '',
  saveApiKey: (k) => localStorage.setItem('eq.apikey', k),
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
