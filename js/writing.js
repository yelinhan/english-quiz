// AI 영작 첨삭 탭
import { store, todayStr, esc } from './store.js';
import { correctWriting } from './ai.js';

export function render(el, ctx) {
  const key = store.apiKey();

  el.innerHTML = `
    <h2 class="section-title">✍️ 오늘의 영작</h2>
    ${key ? '' : `
      <div class="card-box notice">
        영작 첨삭에는 Anthropic API 키가 필요해요.<br>
        오른쪽 위 <b>⚙ 설정</b>에서 키를 입력해주세요. (키는 이 기기에만 저장돼요)
      </div>`}
    <div class="card-box">
      <p class="notice" style="margin-top:0">오늘 있었던 일이나 하고 싶은 말을 영어로 5문장 써보세요. 문법보다 <b>자연스러움</b> 위주로 첨삭해드려요.</p>
      <textarea id="writingInput" placeholder="I go to company today. It was very busy..."></textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:10px">
        <button class="primary" id="submitBtn" ${key ? '' : 'disabled'}>첨삭 받기</button>
      </div>
    </div>
    <div id="result"></div>
    <div id="history"></div>`;

  const resultEl = el.querySelector('#result');
  const submitBtn = el.querySelector('#submitBtn');

  submitBtn.onclick = async () => {
    const text = el.querySelector('#writingInput').value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    resultEl.innerHTML = '<div class="card-box spinner">🤖 첨삭 중이에요... (10~20초 정도 걸려요)</div>';
    try {
      const r = await correctWriting(text, store.apiKey());
      const entry = { date: todayStr(), input: text, result: r };
      const history = store.corrections();
      history.unshift(entry);
      store.saveCorrections(history.slice(0, 50));
      resultEl.innerHTML = renderResult(r);
      bindChunkButtons(resultEl, r, ctx);
      drawHistory();
    } catch (e) {
      resultEl.innerHTML = `<div class="card-box notice">⚠️ ${esc(e.message)}</div>`;
    } finally {
      submitBtn.disabled = false;
    }
  };

  function drawHistory() {
    const history = store.corrections();
    const hEl = el.querySelector('#history');
    if (!history.length) { hEl.innerHTML = ''; return; }
    hEl.innerHTML = `
      <h2 class="section-title">지난 첨삭</h2>
      ${history.slice(0, 5).map((h, i) => `
        <div class="card-box lesson-item" data-i="${i}">
          <div class="date">${esc(h.date)}</div>
          <p>${esc(h.input.slice(0, 60))}${h.input.length > 60 ? '…' : ''}</p>
        </div>`).join('')}`;
    hEl.querySelectorAll('.lesson-item').forEach((item) => {
      item.onclick = () => {
        const h = history[Number(item.dataset.i)];
        resultEl.innerHTML = renderResult(h.result);
        bindChunkButtons(resultEl, h.result, ctx);
        resultEl.scrollIntoView({ behavior: 'smooth' });
      };
    });
  }
  drawHistory();
}

function renderResult(r) {
  return `
    <div class="card-box">
      ${(r.corrections || []).map((c, i) => `
        <div class="correction">
          ${c.is_natural
            ? `<div class="natural">👍 ${esc(c.original)}</div>`
            : `<div class="orig">${esc(c.original)}</div>
               <div class="fixed">${esc(c.corrected)}</div>`}
          <div class="why">${esc(c.explanation_ko)}</div>
          ${c.chunk ? `<button class="add-chunk" data-i="${i}">＋ 단어장에 추가: ${esc(c.chunk.en)}</button>` : ''}
        </div>`).join('')}
      <p class="notice" style="margin-bottom:0">💬 ${esc(r.overall_feedback_ko || '')}</p>
      <p class="notice">🗣 첨삭받은 문장을 소리 내어 3번씩 읽어보세요!</p>
    </div>`;
}

function bindChunkButtons(resultEl, r, ctx) {
  resultEl.querySelectorAll('.add-chunk').forEach((btn) => {
    btn.onclick = () => {
      const c = r.corrections[Number(btn.dataset.i)];
      if (!c?.chunk) return;
      const custom = store.custom();
      if (custom.some((x) => x.en === c.chunk.en)) {
        btn.textContent = '이미 단어장에 있어요';
        btn.disabled = true;
        return;
      }
      custom.push({
        id: 'custom-' + Date.now(),
        type: 'chunk',
        ko: c.chunk.ko,
        en: c.chunk.en,
        example: c.chunk.example,
        category: '내 표현',
        added: todayStr(),
        source: '영작 첨삭',
      });
      store.saveCustom(custom);
      ctx.reloadCards();
      btn.textContent = '✓ 추가됐어요';
      btn.disabled = true;
    };
  });
}
