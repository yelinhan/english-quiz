// 텍스트 하이라이트 → ＋ 버튼 → 단어장 추가 (data-pick 영역 안에서만 동작)
import { store, todayStr, esc } from './store.js';
import { translateChunk } from './ai.js';

export function initPicker(ctx) {
  const btn = document.createElement('button');
  btn.id = 'pickBtn';
  btn.textContent = '＋ 단어장';
  btn.hidden = true;
  document.body.appendChild(btn);

  const dlg = document.createElement('dialog');
  dlg.id = 'pickDialog';
  document.body.appendChild(dlg);

  const toast = document.createElement('div');
  toast.id = 'pickToast';
  toast.hidden = true;
  document.body.appendChild(toast);

  let picked = null;

  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || dlg.open) { btn.hidden = true; return; }
    const text = sel.toString().trim();
    const anchor = sel.anchorNode;
    const anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
    const host = anchorEl && anchorEl.closest('[data-pick]');
    if (!text || !host) { btn.hidden = true; return; }

    const range = sel.getRangeAt(0);
    const sentEl = range.startContainer.parentElement;
    picked = {
      en: text,
      // 목록 글머리표(•)나 잘린 공백이 예문에 섞여 들어가지 않게 정리
      example: (sentEl ? sentEl.textContent : '').replace(/^\s*•\s*/, '').replace(/\s+/g, ' ').trim(),
      source: host.dataset.pick,
    };
    const r = range.getBoundingClientRect();
    btn.hidden = false;
    const x = Math.min(Math.max(r.left + r.width / 2 - btn.offsetWidth / 2, 8),
      window.innerWidth - btn.offsetWidth - 8);
    btn.style.left = `${x}px`;
    btn.style.top = `${Math.max(r.top - btn.offsetHeight - 10, 8)}px`;
  });

  // click은 선택 해제 후에 와서 안 잡히는 기기가 있어 pointerdown으로 처리
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!picked) return;
    btn.hidden = true;
    openDialog(picked);
  });

  function openDialog(p) {
    const sel = document.getSelection();
    if (sel) sel.removeAllRanges();
    dlg.innerHTML = `
      <h2>단어장에 추가</h2>
      <label class="field"><span>영어 표현</span>
        <input id="pickEn" value="${esc(p.en)}"></label>
      <label class="field"><span>한국어 뜻</span>
        <input id="pickKo" placeholder="뜻을 입력해주세요"></label>
      <label class="field"><span>예문</span>
        <input id="pickEx" value="${esc(p.example)}"></label>
      <div class="dialog-actions">
        <button class="ghost" id="pickCancel">취소</button>
        <button class="primary" id="pickSave">저장</button>
      </div>`;
    dlg.showModal();
    dlg.querySelector('#pickCancel').onclick = () => dlg.close();
    dlg.querySelector('#pickSave').onclick = () => save(p);

    const koInput = dlg.querySelector('#pickKo');
    const key = store.apiKey();
    if (key) {
      koInput.placeholder = 'AI가 뜻을 채우는 중...';
      translateChunk(p.en, p.example, key)
        .then((ko) => { if (ko && !koInput.value) koInput.value = ko; })
        .catch(() => {})
        .finally(() => { koInput.placeholder = '뜻을 입력해주세요'; });
    }
  }

  function save(p) {
    const en = dlg.querySelector('#pickEn').value.trim();
    const ko = dlg.querySelector('#pickKo').value.trim();
    const example = dlg.querySelector('#pickEx').value.trim();
    if (!en) return;
    if (ctx.cards.some((c) => c.en.toLowerCase() === en.toLowerCase())) {
      dlg.close();
      showToast('이미 단어장에 있어요');
      return;
    }
    const custom = store.custom();
    custom.push({
      id: 'custom-' + Date.now(),
      type: 'chunk',
      ko: ko || en,
      en,
      example,
      category: '내 표현',
      added: todayStr(),
      source: p.source,
    });
    store.saveCustom(custom);
    ctx.reloadCards();
    dlg.close();
    showToast('✓ 단어장에 추가됐어요');
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }
}
