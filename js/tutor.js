// 튜터 탭: 격주 진도 피드백 리포트 열람
import { esc } from './store.js';

const SCORE_LABELS = { casual: '캐주얼', listening: '리스닝', grammar: '문법', vocab: '어휘' };

function stars(n) {
  const v = Math.max(0, Math.min(5, n | 0));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

function scorePills(scores) {
  return Object.entries(scores || {})
    .map(([k, v]) => `<span class="pill">${esc(SCORE_LABELS[k] || k)} ${stars(v)}</span>`)
    .join(' ');
}

export function render(el, ctx) {
  const reports = [...(ctx.feedback || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!reports.length) {
    el.innerHTML = `
      <h2 class="section-title">🧑‍🏫 튜터 피드백</h2>
      <div class="done-box">
        <div class="big">🧑‍🏫</div>
        <h3>아직 튜터 피드백이 없어요</h3>
        <p>2주마다 학습 기록을 분석한<br>진도 리포트가 여기에 표시돼요.</p>
      </div>`;
    return;
  }

  function drawList() {
    el.innerHTML = `
      <h2 class="section-title">🧑‍🏫 튜터 피드백 (${reports.length}회)</h2>
      ${reports.map((r, i) => `
        <div class="card-box lesson-item" data-i="${i}">
          <div class="date">${esc(r.date)}</div>
          <h3>${esc(r.title || '진도 피드백')}</h3>
          <p>${esc(r.summary_ko || '')}</p>
          <p style="margin-top:8px">
            ${r.baseline ? '<span class="pill">기준점 리포트</span> ' : ''}${scorePills(r.scores)}
          </p>
        </div>`).join('')}`;
    el.querySelectorAll('.lesson-item').forEach((item) => {
      item.onclick = () => drawDetail(reports[Number(item.dataset.i)]);
    });
  }

  function drawDetail(r) {
    const period = r.period ? `${esc(r.period.from)} ~ ${esc(r.period.to)}` : '';
    el.innerHTML = `
      <button class="ghost" id="backBtn" style="margin-bottom:12px">← 목록으로</button>
      <p class="notice" style="margin-top:0">💡 마음에 드는 표현을 길게 눌러 하이라이트하면 단어장에 추가할 수 있어요.</p>
      <div data-pick="튜터 피드백">
      <div class="card-box">
        <div class="date" style="font-size:.75rem;color:var(--sub)">${esc(r.date)}${period ? ` · ${period}` : ''}</div>
        <h3 style="margin:4px 0 8px">${esc(r.title || '진도 피드백')}</h3>
        ${r.baseline ? '<p style="margin-bottom:8px"><span class="pill">기준점 리포트 — 다음부터 변화를 비교해요</span></p>' : ''}
        <p class="notice">${esc(r.summary_ko || '')}</p>
        ${r.scores ? `<p style="margin-top:8px">${scorePills(r.scores)}</p>` : ''}
      </div>
      ${(r.wins_ko || []).length ? `
        <h2 class="section-title">👏 잘한 점</h2>
        <div class="card-box">
          <ul style="margin:0;padding-left:20px">
            ${r.wins_ko.map((w) => `<li style="margin:4px 0">${esc(w)}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${!r.baseline && (r.trends || []).length ? `
        <h2 class="section-title">📈 예전엔 → 요즘엔</h2>
        <div class="card-box">
          ${r.trends.map((t) => `
            <div class="upgrade-row">
              <div class="said">${esc(t.before)}</div>
              <div class="better">${esc(t.now)}</div>
              ${t.note_ko ? `<div class="note">${esc(t.note_ko)}</div>` : ''}
            </div>`).join('')}
        </div>` : ''}
      ${(r.casual_tips || []).length ? `
        <h2 class="section-title">✨ 캐주얼하게 바꿔보기</h2>
        <div class="card-box">
          ${r.casual_tips.map((t) => `
            <div class="upgrade-row">
              <div class="said">${esc(t.formal_said)}</div>
              <div class="better">${esc(t.casual_better)}</div>
              ${t.note_ko ? `<div class="note">${esc(t.note_ko)}</div>` : ''}
            </div>`).join('')}
        </div>` : ''}
      ${(r.focus_ko || []).length ? `
        <h2 class="section-title">🎯 다음 2주 포커스</h2>
        <div class="card-box">
          <ul style="margin:0;padding-left:20px">
            ${r.focus_ko.map((f) => `<li style="margin:4px 0">${esc(f)}</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>`;
    el.querySelector('#backBtn').onclick = drawList;
    el.scrollIntoView();
  }

  drawList();
}
