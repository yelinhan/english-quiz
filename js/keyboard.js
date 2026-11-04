// 앱 내장 영문 자판: 시스템 키보드를 띄우지 않고 화면 아래에 고정된 레이아웃의 일부로 둔다
// (시스템 키보드가 올라오며 화면을 밀어 올리는 일이 없음). 실제 폰 쿼티 배열처럼
// 맨 위 기능 줄(힌트 보기·정답 보기) / q~p / a~l / ⇧ z~m ⌫ / 한영 ⎵ 확인.
// 한/영은 배열만 맞춘 자리 — 빈칸 퀴즈는 영어만 받으므로 비활성 (한글 입력은 아직 없음).
// 터치 기기에서만 보이고, PC에선 숨긴 채 물리 키보드 입력을 같은 핸들러로 넘긴다.
// handler(type, value): type = 'char'(value=글자) | 'space' | 'back' | 'enter'
//   | 'action'(value=기능 줄 버튼 id) | 'digit'(value=1~4, 물리 키보드만)
let handler = null;
let el = null;
let shift = 0; // 0 소문자, 1 다음 한 글자만 대문자, 2 대문자 고정
let lastShiftTap = 0;

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const key = (ch) => `<button type="button" class="kb-key kb-letter" data-k="${ch}">${ch}</button>`;
const svg = (body, sw = 1.8) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const BACK_ICON = svg('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m16 9-5 6M11 9l5 6"/>');
const SHIFT_ICON = svg('<path class="kb-shift-arrow" d="M12 4 4 12h4.5v6h7v-6H20Z"/><path class="kb-caps-bar" d="M8.5 21h7"/>');
const SPACE_ICON = svg('<path d="M4 10v4h16v-4"/>', 2);

function build() {
  el = document.getElementById('kbd');
  el.innerHTML = `
    <div class="kb-actions" id="kbActions"></div>
    <div class="kb-row">${[...ROWS[0]].map(key).join('')}</div>
    <div class="kb-row"><i class="kb-pad"></i>${[...ROWS[1]].map(key).join('')}<i class="kb-pad"></i></div>
    <div class="kb-row">
      <button type="button" class="kb-key kb-fn kb-shift" data-k="shift" aria-label="대문자">${SHIFT_ICON}</button>
      ${[...ROWS[2]].map(key).join('')}
      <button type="button" class="kb-key kb-fn kb-back" data-k="back" aria-label="지우기">${BACK_ICON}</button>
    </div>
    <div class="kb-row">
      <button type="button" class="kb-key kb-fn kb-lang" data-k="lang" disabled aria-disabled="true">한/영</button>
      <button type="button" class="kb-key kb-space" data-k="space" aria-label="띄어쓰기">${SPACE_ICON}</button>
      <button type="button" class="kb-key kb-enter" data-k="enter">확인</button>
    </div>`;

  // 지우기는 길게 누르면 연속으로
  let repeat = null;
  const release = () => {
    clearTimeout(repeat);
    clearInterval(repeat);
    repeat = null;
    el.querySelectorAll('.down').forEach((k) => k.classList.remove('down'));
  };
  // click 대신 pointerdown: 누르는 즉시 입력되고, 버튼이 포커스를 가져가지 않음
  el.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('[data-k], [data-act]');
    if (!k || k.disabled) return;
    e.preventDefault();
    release();
    k.classList.add('down');
    if (k.dataset.act) { handler?.('action', k.dataset.act); return; }
    const t = k.dataset.k;
    press(t);
    if (t === 'back') {
      repeat = setTimeout(() => { repeat = setInterval(() => press('back'), 70); }, 400);
    }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, release));
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 눌러도 메뉴 안 뜨게
}

// ⇧: 한 번 = 다음 한 글자만 대문자, 빠르게 두 번 = 대문자 고정, 고정 중 한 번 = 해제
function setShift(v) {
  shift = v;
  el.classList.toggle('upper', shift > 0);
  el.querySelector('.kb-shift').classList.toggle('on', shift > 0);
  el.querySelector('.kb-shift').classList.toggle('caps', shift === 2);
}

function press(t) {
  if (!handler) return;
  if (t === 'shift') {
    const now = Date.now();
    setShift(shift === 1 && now - lastShiftTap < 350 ? 2 : shift ? 0 : 1);
    lastShiftTap = now;
    return;
  }
  if (t.length === 1) {
    handler('char', shift ? t.toUpperCase() : t);
    if (shift === 1) setShift(0);
    return;
  }
  handler(t);
}

// 물리 키보드: 다른 입력칸·다이얼로그를 쓰는 중이면 건드리지 않음.
// 한글 입력 상태여도 자판 위치(e.code)로 영문 글자를 받는다
document.addEventListener('keydown', (e) => {
  if (!handler || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  let type = null;
  let value;
  if (e.key === 'Enter') type = 'enter';
  else if (e.key === 'Backspace') type = 'back';
  else if (e.key === ' ') type = 'space';
  else if (/^[1-4]$/.test(e.key)) { type = 'digit'; value = Number(e.key); }
  else if (/^[a-z]$/i.test(e.key)) { type = 'char'; value = e.key; }
  else {
    const m = (e.code || '').match(/^Key([A-Z])$/);
    if (m) { type = 'char'; value = e.shiftKey ? m[1] : m[1].toLowerCase(); }
  }
  if (!type) return;
  e.preventDefault();
  if (e.repeat && type === 'enter') return;
  handler(type, value);
});

// actions = 맨 위 기능 줄 버튼 [{ id, label }]
export function attach(h, { actions = [] } = {}) {
  if (!el) build();
  handler = h;
  el.hidden = false;
  el.querySelector('#kbActions').innerHTML = actions
    .map((a) => `<button type="button" class="kb-act" data-act="${a.id}">${a.label}</button>`).join('');
  setShift(0);
  // 자판이 떠 있는 동안 페이지 전체가 밀리거나 튕기지 않게 (내용 영역만 필요할 때 스크롤)
  document.documentElement.classList.add('kbd-on');
  setState({ idle: false, enter: '확인' });
}

export function detach() {
  handler = null;
  if (el) el.hidden = true;
  document.documentElement.classList.remove('kbd-on');
}

// idle = 정답 공개 후 (글자·기능 키를 흐리게, Enter만 의미 있음), disabled = 끌 기능 줄 버튼 id들
export function setState({ idle, enter, disabled = [] }) {
  if (!el) return;
  el.classList.toggle('idle', !!idle);
  if (enter) el.querySelector('.kb-enter').textContent = enter;
  el.querySelectorAll('[data-act]').forEach((b) => { b.disabled = !!idle || disabled.includes(b.dataset.act); });
  if (idle && shift) setShift(0);
}
