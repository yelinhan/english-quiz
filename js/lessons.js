// 수업 탭: 전화영어 분석 리포트 열람
import { esc } from './store.js';

export function render(el, ctx) {
  const lessons = [...(ctx.lessons || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!lessons.length) {
    el.innerHTML = `
      <h2 class="section-title">📞 전화영어 수업</h2>
      <div class="done-box">
        <div class="big">🎧</div>
        <h3>아직 분석된 수업이 없어요</h3>
        <p>수업 녹음(mp3)을 PC의 Claude Code에 올리면<br>분석 리포트가 여기에 표시돼요.</p>
      </div>`;
    return;
  }

  function drawList() {
    el.innerHTML = `
      <h2 class="section-title">📞 전화영어 수업 (${lessons.length}회)</h2>
      ${lessons.map((l, i) => `
        <div class="card-box lesson-item" data-i="${i}">
          <div class="date">${esc(l.date)}</div>
          <h3>${esc(l.topic || '수업 리포트')}</h3>
          <p>${esc(l.summary || '')}</p>
          <p style="margin-top:8px"><span class="pill">표현 업그레이드 ${(l.upgrades || []).length}개</span></p>
        </div>`).join('')}`;
    el.querySelectorAll('.lesson-item').forEach((item) => {
      item.onclick = () => drawDetail(lessons[Number(item.dataset.i)]);
    });
  }

  function drawDetail(l) {
    el.innerHTML = `
      <button class="ghost" id="backBtn" style="margin-bottom:12px">← 목록으로</button>
      <div class="card-box">
        <div class="date" style="font-size:.75rem;color:var(--sub)">${esc(l.date)}</div>
        <h3 style="margin:4px 0 8px">${esc(l.topic || '수업 리포트')}</h3>
        <p class="notice">${esc(l.summary || '')}</p>
      </div>
      <h2 class="section-title">✨ 표현 업그레이드</h2>
      <div class="card-box">
        ${(l.upgrades || []).map((u) => `
          <div class="upgrade-row">
            <div class="said">${esc(u.said)}</div>
            <div class="better">${esc(u.better)}</div>
            ${u.note_ko ? `<div class="note">${esc(u.note_ko)}</div>` : ''}
          </div>`).join('') || '<p class="notice">없음</p>'}
      </div>
      ${l.feedback_ko ? `
        <h2 class="section-title">💬 피드백</h2>
        <div class="card-box notice">${esc(l.feedback_ko)}</div>` : ''}`;
    el.querySelector('#backBtn').onclick = drawList;
    el.scrollIntoView();
  }

  drawList();
}
