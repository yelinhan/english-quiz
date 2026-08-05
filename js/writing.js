// AI 영작 탭: 자유 영작 + 문장 영작(한국어 문장 → 영어로 옮기기)
import { store, todayStr, esc } from './store.js';
import { correctWriting, gradeTranslation } from './ai.js';

const PROMPTS = [
  '오늘은 너무 힘든 하루였어요.',
  '요즘 일이 너무 바빠서 정신이 없어요.',
  '어제 늦게 자서 아침에 겨우 일어났어요.',
  '이번 주말에 딱히 계획은 없어요.',
  '점심 뭐 먹을지 아직 못 정했어요.',
  '그 얘기 듣고 진짜 깜짝 놀랐어요.',
  '요즘 운동을 시작했는데 생각보다 재밌어요.',
  '회의가 갑자기 취소돼서 시간이 붕 떴어요.',
  '커피를 안 마시면 하루를 시작 못 해요.',
  '비가 올 것 같아서 우산을 챙겼어요.',
  '새로 온 동료랑 아직 좀 서먹서먹해요.',
  '지하철에서 깜빡 졸다가 내릴 역을 지나쳤어요.',
  '월요일이라 그런지 하루 종일 피곤했어요.',
  '오랜만에 친구를 만나서 수다 떨었어요.',
  '프로젝트 마감이 다가와서 스트레스 받아요.',
  '딱히 이유는 없는데 그냥 기분이 좋아요.',
  '핸드폰을 집에 두고 나와서 하루 종일 불편했어요.',
  '상사가 갑자기 일을 잔뜩 시켰어요.',
  '요즘 드라마에 푹 빠져서 밤늦게까지 봐요.',
  '감기 기운이 살짝 있어서 오늘은 일찍 자려고요.',
  '옷을 얇게 입고 나왔더니 하루 종일 추웠어요.',
  '발표가 생각보다 잘 돼서 다행이었어요.',
  '배달 음식을 너무 자주 시켜 먹는 것 같아요.',
  '주말에 밀린 집안일을 몰아서 했어요.',
  '이 노래가 계속 머릿속에 맴돌아요.',
  '약속에 늦을 뻔했는데 겨우 시간 맞춰 도착했어요.',
  '요즘 잠을 설쳐서 낮에 계속 졸려요.',
  '동료가 도와준 덕분에 일이 빨리 끝났어요.',
  '갑자기 단 게 당겨서 편의점에 다녀왔어요.',
  '내일 면접이 있어서 좀 긴장돼요.',
  '오늘 회의가 3개나 있어서 하루가 순식간에 갔어요.',
  '회의가 길어져서 점심을 늦게 먹었어요.',
  '그 부분은 제가 확인하고 다시 말씀드릴게요.',
  '이번 주까지 끝내야 하는 일이 산더미예요.',
  '메일을 보냈는데 아직 답장이 없어요.',
  '발표 자료를 오늘까지 만들어야 해요.',
  '일정이 빠듯한데 어떻게든 맞춰봐야죠.',
  '재택근무라서 오늘은 출퇴근 시간을 아꼈어요.',
  '회의에서 제 의견을 말할 기회가 없었어요.',
  '동료에게 일을 부탁하기가 좀 미안했어요.',
  '상사한테 보고했더니 방향을 다시 잡으라고 했어요.',
  '마감 직전에 요구사항이 바뀌어서 좀 당황했어요.',
  '이 업무는 우선순위가 낮아서 일단 뒤로 미뤘어요.',
  '오늘 한 실수가 계속 신경 쓰여요.',
];

// 관사(a/the)·시제를 집중적으로 연습하는 세트 — 한국인이 자주 틀리는 함정 위주
const GRAMMAR_PROMPTS = [
  // 관사: a(첫 언급) vs the(아는 것) vs 무관사(일반 복수·식사 등)
  '어제 영화를 봤는데, 그 영화가 생각보다 별로였어요.',
  '저는 원래 영화 보는 걸 좋아해요.',
  '아침에 커피 한 잔 마시면서 하루를 시작해요.',
  '집 근처에 카페가 새로 생겼는데, 거기 커피가 진짜 맛있어요.',
  '강아지를 키우고 싶은데 지금 집이 너무 좁아요.',
  '점심 먹고 나서 산책을 좀 했어요.',
  '해 지는 거 보러 한강에 갔어요.',
  '요즘 기타를 배우기 시작했어요.',
  // 시제: 과거 vs 현재완료, 과거진행, used to, 미래
  '그 식당 가본 적 있어요. 지난달에 한 번 갔었어요.',
  '이 회사에서 일한 지 3년 됐어요.',
  '샤워하고 있는데 택배가 왔어요.',
  '예전에는 커피를 안 마셨는데 요즘은 매일 마셔요.',
  '아직 그 영화 못 봤어요. 이번 주말에 보려고요.',
  '방금 점심 먹었는데 벌써 배고파요.',
  '어렸을 때는 부산에 살았어요.',
  '지금 막 나가려던 참이었어요.',
  '다음 주에 휴가 가요. 벌써 설레요.',
  '핸드폰을 잃어버렸는데 어디서 잃어버렸는지 모르겠어요.',
];

export function render(el, ctx) {
  let mode = 'tr'; // 탭에 들어올 때마다 문장 영작이 기본
  let set = 'all'; // all: 전체 랜덤, grammar: 관사·시제 집중
  let prompt = pickPrompt();

  function pickPrompt() {
    const pool = set === 'grammar' ? GRAMMAR_PROMPTS : [...PROMPTS, ...GRAMMAR_PROMPTS];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function draw() {
    const key = store.apiKey();
    el.innerHTML = `
      <h2 class="section-title">✍️ 오늘의 영작</h2>
      <div class="chip-row">
        <button data-mode="tr" class="${mode === 'tr' ? 'on' : ''}">문장 영작</button>
        <button data-mode="free" class="${mode === 'free' ? 'on' : ''}">자유 영작</button>
      </div>
      ${mode === 'tr' ? `
      <div class="chip-row">
        <button data-set="all" class="${set === 'all' ? 'on' : ''}">🎲 전체 랜덤</button>
        <button data-set="grammar" class="${set === 'grammar' ? 'on' : ''}">🎯 관사·시제 집중</button>
      </div>` : ''}
      ${key || mode === 'tr' ? '' : `
        <div class="card-box notice">
          영작 첨삭에는 Anthropic API 키가 필요해요.<br>
          오른쪽 위 <b>⚙ 설정</b>에서 키를 입력해주세요. (키는 이 기기에만 저장돼요)
        </div>`}
      ${mode === 'free' ? `
        <div class="card-box">
          <p class="notice" style="margin-top:0">오늘 있었던 일이나 하고 싶은 말을 영어로 5문장 써보세요. 문법보다 <b>자연스러움</b> 위주로 첨삭해드려요.</p>
          <textarea id="writingInput" placeholder="I go to company today. It was very busy..."></textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:10px">
            <button class="primary" id="submitBtn" ${key ? '' : 'disabled'}>첨삭 받기</button>
          </div>
        </div>` : `
        <div class="card-box">
          <p class="notice" style="margin-top:0">${set === 'grammar'
            ? '아래 문장을 영어로! <b>관사(a/the)와 시제</b>에 특히 신경 써보세요.'
            : '아래 문장을 영어로 어떻게 말할까요? <b>자연스럽고 캐주얼하게</b> 옮겨보세요.'}</p>
          <div class="tr-prompt">${esc(prompt)}</div>
          <textarea id="writingInput" placeholder="영어로 써보세요..."></textarea>
          <div style="display:flex; justify-content:space-between; gap:8px; margin-top:10px">
            <button class="ghost" id="nextPromptBtn">🔄 다른 문장</button>
            ${key
              ? '<button class="primary" id="submitBtn">첨삭 받기</button>'
              : '<button class="primary" id="copyBtn">📋 복사해서 Claude에 첨삭받기</button>'}
          </div>
          ${key ? '' : '<p class="notice" style="margin-bottom:0">복사한 내용을 Claude에 붙여넣으면 첨삭해줘요. (⚙ 설정에 API 키를 넣으면 앱에서 바로 첨삭돼요)</p>'}
        </div>`}
      <div id="result"></div>
      <div id="history"></div>`;

    el.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => {
        mode = b.dataset.mode;
        draw();
      };
    });
    el.querySelectorAll('[data-set]').forEach((b) => {
      b.onclick = () => {
        set = b.dataset.set;
        prompt = pickPrompt();
        draw();
      };
    });

    const resultEl = el.querySelector('#result');
    const submitBtn = el.querySelector('#submitBtn');
    const nextBtn = el.querySelector('#nextPromptBtn');
    const copyBtn = el.querySelector('#copyBtn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        prompt = pickPrompt();
        draw();
      };
    }
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const text = el.querySelector('#writingInput').value.trim();
        if (!text) return;
        const msg = `문장 영작 첨삭해줘!\n한국어: ${prompt}\n내 영어: ${text}`;
        try {
          await navigator.clipboard.writeText(msg);
          copyBtn.textContent = '✓ 복사됐어요';
          setTimeout(() => { copyBtn.textContent = '📋 복사해서 Claude에 첨삭받기'; }, 2000);
        } catch {
          window.prompt('아래 내용을 복사해서 Claude에 붙여넣으세요:', msg);
        }
      };
    }

    if (submitBtn) submitBtn.onclick = async () => {
      const text = el.querySelector('#writingInput').value.trim();
      if (!text) return;
      submitBtn.disabled = true;
      resultEl.innerHTML = '<div class="card-box spinner">🤖 첨삭 중이에요... (10~20초 정도 걸려요)</div>';
      try {
        const entry = mode === 'free'
          ? { date: todayStr(), mode: 'free', input: text, result: await correctWriting(text, store.apiKey()) }
          : { date: todayStr(), mode: 'tr', ko: prompt, input: text, result: await gradeTranslation(prompt, text, store.apiKey()) };
        const history = store.corrections();
        history.unshift(entry);
        store.saveCorrections(history.slice(0, 50));
        showEntry(resultEl, entry, ctx);
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
            <div class="date">${esc(h.date)}${h.mode === 'tr' ? ' · 문장 영작' : ''}</div>
            <p>${esc((h.mode === 'tr' ? `${h.ko} → ` : '') + h.input).slice(0, 60)}${(h.input.length > 60) ? '…' : ''}</p>
          </div>`).join('')}`;
      hEl.querySelectorAll('.lesson-item').forEach((item) => {
        item.onclick = () => {
          showEntry(resultEl, history[Number(item.dataset.i)], ctx);
          resultEl.scrollIntoView({ behavior: 'smooth' });
        };
      });
    }
    drawHistory();
  }

  draw();
}

function showEntry(resultEl, entry, ctx) {
  if (entry.mode === 'tr') {
    const r = entry.result;
    resultEl.innerHTML = `
      <div class="card-box" data-pick="영작 첨삭">
        <div class="tr-prompt small">${esc(entry.ko)}</div>
        <div class="correction">
          ${r.is_natural
            ? `<div class="natural">👍 ${esc(entry.input)}</div>`
            : `<div class="orig">${esc(entry.input)}</div>
               <div class="fixed">${esc(r.corrected)}</div>`}
          <div class="why">${esc(r.explanation_ko)}</div>
        </div>
        ${(r.alternatives || []).length ? `
          <p class="notice" style="margin-bottom:4px">이렇게도 말해요:</p>
          ${r.alternatives.map((a) => `<div class="fixed">• ${esc(a)}</div>`).join('')}` : ''}
        ${r.chunk ? `<button class="add-chunk" data-c="0">＋ 단어장에 추가: ${esc(r.chunk.en)}</button>` : ''}
        <p class="notice">🗣 자연스러운 문장을 소리 내어 3번 읽어보세요!</p>
      </div>`;
    if (r.chunk) bindChunk(resultEl.querySelector('.add-chunk'), r.chunk, ctx);
    return;
  }
  const r = entry.result;
  resultEl.innerHTML = `
    <div class="card-box" data-pick="영작 첨삭">
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
  resultEl.querySelectorAll('.add-chunk').forEach((btn) => {
    const c = r.corrections[Number(btn.dataset.i)];
    if (c?.chunk) bindChunk(btn, c.chunk, ctx);
  });
}

function bindChunk(btn, chunk, ctx) {
  btn.onclick = () => {
    const custom = store.custom();
    if (ctx.cards.some((x) => x.en.toLowerCase() === chunk.en.toLowerCase())) {
      btn.textContent = '이미 단어장에 있어요';
      btn.disabled = true;
      return;
    }
    custom.push({
      id: 'custom-' + Date.now(),
      type: 'chunk',
      ko: chunk.ko,
      en: chunk.en,
      example: chunk.example,
      category: '내 표현',
      added: todayStr(),
      source: '영작 첨삭',
    });
    store.saveCustom(custom);
    ctx.reloadCards();
    btn.textContent = '✓ 추가됐어요';
    btn.disabled = true;
  };
}
