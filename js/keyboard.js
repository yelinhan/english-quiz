// 앱 내장 영문 자판: 시스템 키보드를 띄우지 않고 화면 아래에 고정된 레이아웃의 일부로 둔다
// (시스템 키보드가 올라오며 화면을 밀어 올리는 일이 없음). 터치 기기에서만 보이고,
// PC에선 숨긴 채 물리 키보드 입력을 같은 핸들러로 넘긴다.
// handler(type, value): type = 'char'(value=글자) | 'space' | 'back' | 'enter' | 'digit'(value=1~4, 물리 키보드만)
let handler = null;
let el = null;

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const key = (ch) => `<button type="button" class="kb-key" data-k="${ch}">${ch}</button>`;
const BACK_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m16 9-5 6M11 9l5 6"/></svg>';

function build() {
  el = document.getElementById('kbd');
  el.innerHTML = `
    <div class="kb-row">${[...ROWS[0]].map(key).join('')}</div>
    <div class="kb-row"><i class="kb-pad"></i>${[...ROWS[1]].map(key).join('')}<i class="kb-pad"></i></div>
    <div class="kb-row"><i class="kb-pad3"></i>${[...ROWS[2]].map(key).join('')}<button type="button" class="kb-key kb-back" data-k="back" aria-label="지우기">${BACK_ICON}</button></div>
    <div class="kb-row"><button type="button" class="kb-key kb-space" data-k="space">space</button><button type="button" class="kb-key kb-enter" data-k="enter">확인</button></div>`;

  // 지우기는 길게 누르면 연속으로
  let repeat = null;
  const release = () => {
    clearTimeout(repeat);
    clearInterval(repeat);
    repeat = null;
    el.querySelectorAll('.kb-key.down').forEach((k) => k.classList.remove('down'));
  };
  // click 대신 pointerdown: 누르는 즉시 입력되고, 버튼이 포커스를 가져가지 않음
  el.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('[data-k]');
    if (!k) return;
    e.preventDefault();
    release();
    k.classList.add('down');
    const t = k.dataset.k;
    press(t);
    if (t === 'back') {
      repeat = setTimeout(() => { repeat = setInterval(() => press('back'), 70); }, 400);
    }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, release));
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 눌러도 메뉴 안 뜨게
}

function press(t) {
  if (!handler) return;
  if (t.length === 1) handler('char', t);
  else handler(t);
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
    if (m) { type = 'char'; value = m[1].toLowerCase(); }
  }
  if (!type) return;
  e.preventDefault();
  if (e.repeat && type === 'enter') return;
  handler(type, value);
});

export function attach(h) {
  if (!el) build();
  handler = h;
  el.hidden = false;
  setState({ idle: false, enter: '확인' });
}

export function detach() {
  handler = null;
  if (el) el.hidden = true;
}

// idle = 정답 공개 후 (글자 키를 흐리게, Enter만 의미 있음)
export function setState({ idle, enter }) {
  if (!el) return;
  el.classList.toggle('idle', !!idle);
  if (enter) el.querySelector('.kb-enter').textContent = enter;
}
