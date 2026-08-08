// 단어장 열람/검색 + 내 표현 내보내기
import { store, esc, splitSentences, pairExamples } from './store.js';

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
    <div id="exportZone"></div>
    <dialog id="wordDialog"></dialog>`;
  const dlg = el.querySelector('#wordDialog');

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
          <div class="vocab-item" data-id="${esc(c.id)}">
            <div class="ko">${esc(c.ko)} <span class="pill" style="float:right">${esc(c.category || '')}</span></div>
            <div class="en">${esc(c.en)}</div>
            ${c.example ? `<div class="ex">${esc(c.example)}</div>` : ''}
          </div>`).join('') || '<p class="notice">검색 결과가 없어요.</p>'}
        <p class="count-note">${filtered.length}개 표현</p>
      </div>`;
    listEl.querySelectorAll('.vocab-item').forEach((item) => {
      item.onclick = () => {
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed) return; // 텍스트 드래그 중에는 무시
        const card = ctx.cards.find((c) => c.id === item.dataset.id);
        if (card) openCard(card);
      };
    });
    drawExport();
  }

  function openCard(c) {
    const synonyms = c.en.split('/').map((v) => v.trim()).filter(Boolean);
    const pairs = pairExamples(c);
    const sents = splitSentences(c.example);
    dlg.innerHTML = `
      <button class="dialog-close" id="wdClose">✕</button>
      <h2>${esc(c.ko)}</h2>
      <div class="wd-syns">${synonyms.map((s) => `<span class="wd-syn">${esc(s)}</span>`).join('')}</div>
      ${pairs ? `
        <div class="wd-label">예문</div>
        <ul class="wd-ex">${pairs.map((p) => `
          <li>${esc(p.en)}<div class="wd-li-ko">${esc(p.ko)}</div></li>`).join('')}</ul>`
    : `
      ${sents.length ? `
        <div class="wd-label">예문</div>
        <ul class="wd-ex">${sents.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${c.example_ko ? `<div class="wd-exko">${esc(c.example_ko)}</div>` : ''}`}
      <div class="wd-meta">${esc(c.category || '')}${c.source ? ` · ${esc(c.source)}` : ''}${c.added ? ` · ${esc(c.added)}` : ''}</div>
      <div class="dialog-actions">
        <button class="ghost danger" id="wdDelete">삭제</button>
        <button class="ghost" id="wdEdit">수정</button>
        <button class="primary" id="wdOk">닫기</button>
      </div>`;
    dlg.showModal();
    dlg.querySelector('#wdClose').onclick = () => dlg.close();
    dlg.querySelector('#wdOk').onclick = () => dlg.close();
    dlg.querySelector('#wdDelete').onclick = () => removeCard(c);
    dlg.querySelector('#wdEdit').onclick = () => openEdit(c);
  }

  function openEdit(c) {
    const isCustom = c.id.startsWith('custom-');
    dlg.innerHTML = `
      <button class="dialog-close" id="wdClose">✕</button>
      <h2>표현 수정</h2>
      <label class="field"><span>한국어 뜻</span><input id="edKo" value="${esc(c.ko)}"></label>
      <label class="field"><span>영어 (동의어는 / 로 구분)</span><input id="edEn" value="${esc(c.en)}"></label>
      <label class="field"><span>예문</span><input id="edEx" value="${esc(c.example || '')}"></label>
      <label class="field"><span>예문 해석</span><input id="edExKo" value="${esc(c.example_ko || '')}"></label>
      ${isCustom ? '' : '<p class="notice">기본 단어장 카드라서 이 수정은 이 기기에만 적용돼요. 영구 반영은 "동기화" 워크플로를 이용해주세요.</p>'}
      <div class="dialog-actions">
        <button class="ghost" id="edCancel">취소</button>
        <button class="primary" id="edSave">저장</button>
      </div>`;
    dlg.querySelector('#wdClose').onclick = () => dlg.close();
    dlg.querySelector('#edCancel').onclick = () => openCard(c);
    dlg.querySelector('#edSave').onclick = () => {
      const upd = {
        ko: dlg.querySelector('#edKo').value.trim(),
        en: dlg.querySelector('#edEn').value.trim(),
        example: dlg.querySelector('#edEx').value.trim(),
        example_ko: dlg.querySelector('#edExKo').value.trim(),
      };
      if (!upd.ko || !upd.en) return;
      if (isCustom) {
        const custom = store.custom();
        const i = custom.findIndex((x) => x.id === c.id);
        if (i >= 0) { custom[i] = { ...custom[i], ...upd }; store.saveCustom(custom); }
      } else {
        const ov = store.overrides();
        ov[c.id] = { ...ov[c.id], ...upd };
        store.saveOverrides(ov);
      }
      ctx.reloadCards();
      drawList();
      openCard(ctx.cards.find((x) => x.id === c.id));
    };
  }

  function removeCard(c) {
    if (!confirm(`"${c.ko}" 카드를 삭제할까요?`)) return;
    if (c.id.startsWith('custom-')) {
      store.saveCustom(store.custom().filter((x) => x.id !== c.id));
    } else {
      const del = store.deleted();
      if (!del.includes(c.id)) del.push(c.id);
      store.saveDeleted(del);
    }
    ctx.reloadCards();
    dlg.close();
    drawList();
  }

  function drawExport() {
    const custom = store.custom();
    const zone = el.querySelector('#exportZone');
    if (!custom.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <h2 class="section-title">내가 추가한 표현 (${custom.length}개)</h2>
      <div class="card-box">
        <p class="notice" style="margin-top:0">추가한 표현은 로그인만 돼 있으면 계정에 자동 저장·동기화돼요.
        기본 단어장(모두에게 보이는 단어장)에도 넣고 싶으면 Claude Code에 "커스텀 표현 단어장에 반영해줘"라고 하면
        DB에서 바로 가져가요 (tools/pull_custom.py). 복사는 백업용이에요.</p>
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
