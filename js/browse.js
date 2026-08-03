// 단어장 열람/검색 + 내 표현 내보내기
import { store, esc } from './store.js';

export function render(el, ctx) {
  const cards = ctx.cards;
  const categories = ['전체', ...new Set(cards.map((c) => c.category).filter(Boolean))];
  let query = '';
  let cat = '전체';

  el.innerHTML = `
    <h2 class="section-title">📚 단어장</h2>
    <div class="search-row">
      <input id="searchInput" type="search" placeholder="한국어/영어로 검색" autocomplete="off">
    </div>
    <div class="chip-row" id="chips"></div>
    <div id="list"></div>
    <div id="exportZone"></div>`;

  const chipsEl = el.querySelector('#chips');
  const listEl = el.querySelector('#list');

  chipsEl.innerHTML = categories.map((c) =>
    `<button data-cat="${esc(c)}" class="${c === cat ? 'on' : ''}">${esc(c)}</button>`).join('');
  chipsEl.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      cat = b.dataset.cat;
      chipsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      drawList();
    };
  });

  el.querySelector('#searchInput').oninput = (e) => {
    query = e.target.value.trim().toLowerCase();
    drawList();
  };

  function drawList() {
    const filtered = cards.filter((c) => {
      if (cat !== '전체' && c.category !== cat) return false;
      if (!query) return true;
      return (c.ko + ' ' + c.en + ' ' + (c.example || '')).toLowerCase().includes(query);
    });
    listEl.innerHTML = `
      <div class="card-box">
        ${filtered.map((c) => `
          <div class="vocab-item">
            <div class="ko">${esc(c.ko)} <span class="pill" style="float:right">${esc(c.category || '')}</span></div>
            <div class="en">${esc(c.en)}</div>
            ${c.example ? `<div class="ex">${esc(c.example)}</div>` : ''}
          </div>`).join('') || '<p class="notice">검색 결과가 없어요.</p>'}
        <p class="count-note">${filtered.length}개 표현</p>
      </div>`;
    drawExport();
  }

  function drawExport() {
    const custom = store.custom();
    const zone = el.querySelector('#exportZone');
    if (!custom.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <h2 class="section-title">내가 추가한 표현 (${custom.length}개)</h2>
      <div class="card-box">
        <p class="notice" style="margin-top:0">아래 내용을 복사해서 Claude Code에 붙여넣고 "동기화해줘"라고 하면 영구 단어장에 반영돼요.</p>
        <button class="ghost" id="copyBtn">📋 목록 복사하기</button>
        <span id="copyMsg" class="notice"></span>
      </div>`;
    zone.querySelector('#copyBtn').onclick = async () => {
      const text = custom.map((c) => `${c.ko} | ${c.en} | ${c.example || ''}`).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        zone.querySelector('#copyMsg').textContent = ' ✓ 복사됐어요';
      } catch {
        prompt('아래 내용을 복사하세요:', text);
      }
    };
  }

  drawList();
}
