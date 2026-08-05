// 튜터 탭: 격주 진도 피드백 리포트 열람
import { esc } from './store.js';

const SCORE_LABELS = { casual: '캐주얼', listening: '리스닝', grammar: '문법', vocab: '어휘' };
// 차트 전용 색 — 라이트/다크 card 배경 모두에서 대비 3:1 이상 (앱 티일 계열)
const CHART_COLOR = '#12A594';

function stars(n) {
  const v = Math.max(0, Math.min(5, n | 0));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

function scorePills(scores) {
  return Object.entries(scores || {})
    .map(([k, v]) => `<span class="pill">${esc(SCORE_LABELS[k] || k)} ${stars(v)}</span>`)
    .join(' ');
}

// 영역별 점수 추이 스몰 멀티플 (리포트 2개 이상일 때)
function scoreTrendChart(reportsDesc) {
  const rs = [...reportsDesc].reverse().filter((r) => r.scores);
  if (rs.length < 2) return '';

  const W = 150; const H = 72;
  const padL = 8; const padR = 20; const padT = 10; const padB = 8;
  const x = (i) => padL + (i * (W - padL - padR)) / (rs.length - 1);
  const y = (v) => padT + ((5 - Math.max(1, Math.min(5, v))) * (H - padT - padB)) / 4;

  const panels = Object.keys(SCORE_LABELS).map((key) => {
    const vals = rs.map((r) => (r.scores[key] == null ? null : r.scores[key]));
    if (vals.every((v) => v === null)) return '';
    const pts = vals.map((v, i) => (v === null ? null : { i, v })).filter(Boolean);
    const line = pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const grid = [1, 3, 5].map((v) =>
      `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`).join('');
    const dots = pts.map((p) => `
      <circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p === last ? 4 : 3}"
        fill="${CHART_COLOR}"${p === last ? '' : ' fill-opacity=".55"'} stroke="var(--card)" stroke-width="2">
        <title>${esc(rs[p.i].date)} · ${p.v}점</title>
      </circle>`).join('');
    return `
      <div style="min-width:0">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:2px">
          <span style="color:var(--sub)">${esc(SCORE_LABELS[key])}</span>
          <b style="font-variant-numeric:tabular-nums">${last.v}점</b>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto" role="img" aria-label="${esc(SCORE_LABELS[key])} 점수 추이, 최근 ${last.v}점">
          ${grid}
          <path d="${line}" fill="none" stroke="${CHART_COLOR}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
        </svg>
      </div>`;
  }).join('');

  return `
    <div class="card-box">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <b style="font-size:.9rem">📊 점수 추이</b>
        <span style="font-size:.7rem;color:var(--sub)">${esc(rs[0].date)} ~ ${esc(rs[rs.length - 1].date)} · 1~5점</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">${panels}</div>
    </div>`;
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
      ${scoreTrendChart(reports)}
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
