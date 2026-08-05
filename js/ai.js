// Claude API 브라우저 직접 호출 (영작 첨삭)
const SYSTEM = `You are an English writing coach for a Korean native speaker.
Learner profile: OPIc IH level. Can hold a conversation but sounds stiff/textbook-like.
Goal: natural, casual, conversational English (aiming to work at a global company within 3 months).

Correct the learner's sentences with these priorities:
1. Focus on making grammatically-correct-but-awkward sentences sound natural and casual
   (prefer "kinda", "really", "grab", "fix" over "somewhat", "extremely", "obtain", "revise").
2. Fix real grammar errors too, but naturalness matters more.
3. Explanations must be in Korean, short and friendly.
4. When a correction contains a reusable conversational chunk worth memorizing,
   include it as a chunk (ko = Korean meaning, en = the chunk, example = a new short casual example).
   Only suggest a chunk when it's genuinely reusable; otherwise set chunk to null.
5. If a sentence is already natural, set is_natural to true, keep corrected identical,
   and praise briefly in explanation_ko.`;

const SCHEMA = {
  type: 'object',
  properties: {
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          corrected: { type: 'string' },
          is_natural: { type: 'boolean' },
          explanation_ko: { type: 'string' },
          chunk: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  ko: { type: 'string' },
                  en: { type: 'string' },
                  example: { type: 'string' },
                },
                required: ['ko', 'en', 'example'],
                additionalProperties: false,
              },
              { type: 'null' },
            ],
          },
        },
        required: ['original', 'corrected', 'is_natural', 'explanation_ko', 'chunk'],
        additionalProperties: false,
      },
    },
    overall_feedback_ko: { type: 'string' },
  },
  required: ['corrections', 'overall_feedback_ko'],
  additionalProperties: false,
};

// 하이라이트로 추가한 표현의 한국어 뜻 자동 생성 (실패해도 조용히 null)
export async function translateChunk(en, sentence, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Give a short natural Korean gloss (vocab-list style, e.g. "옛날에는", "약속 있어") for the English expression "${en}"${sentence ? ` as used in: "${sentence}"` : ''}. Reply with ONLY the Korean gloss.`,
      }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  return block ? block.text.trim() : null;
}

export async function correctWriting(text, apiKey) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 4096,
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: text }],
      }),
    });
  } catch {
    throw new Error('네트워크 오류예요. 인터넷 연결을 확인해주세요.');
  }

  if (res.status === 401) throw new Error('API 키가 올바르지 않아요. 설정(⚙)에서 다시 입력해주세요.');
  if (res.status === 429) throw new Error('요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
  if (!res.ok) {
    let msg = `오류가 발생했어요 (HTTP ${res.status}).`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += ` ${err.error.message}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw new Error('AI가 이 내용에는 답할 수 없다고 해요. 다른 문장으로 시도해주세요.');
  }
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('응답을 해석하지 못했어요. 다시 시도해주세요.');
  try {
    return JSON.parse(textBlock.text);
  } catch {
    throw new Error('응답 형식이 예상과 달라요. 다시 시도해주세요.');
  }
}
