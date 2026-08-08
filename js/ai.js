// AI API 브라우저 직접 호출 (영작 첨삭). 공급자: Anthropic / OpenAI / Gemini
import { store } from './store.js';

// 첨삭 태그 — 고정 목록 (data/grammar.json의 카드 키와 일치해야 함)
export const GRAMMAR_TAGS = [
  '관사', '시제-과거', '시제-현재완료', '시제-과거완료', '시제-진행', '시제-미래',
  '전치사', '장소부사', 'to부정사', '동명사', '수동태', '관계대명사',
  '비교급', '어순', '수일치', '단어선택', '콜로케이션',
];
const TAGS_FIELD = { type: 'array', items: { type: 'string', enum: GRAMMAR_TAGS } };
const TAGS_RULE = `For "tags": pick 0-3 items from this FIXED list (exact strings) naming the key points you corrected:
${GRAMMAR_TAGS.join(', ')}.
Use [] when nothing was corrected (is_natural true).`;

// 단어장 chunk 필드 공통 규칙 — ko에 따옴표 목록·en에 문장 통짜가 들어가는 것 방지
const CHUNK_RULE = `For "chunk" (when not null):
- en: just the reusable expression itself (a few words) — NOT the learner's entire sentence
- ko: a short vocab-list style Korean gloss, plain text only — no quotation marks, no comma list
  (if two glosses are both common, join with " / ")
- example: ONE new short casual sentence using the expression, different from the corrected sentence`;

const SYSTEM = `You are an English writing coach for a Korean native speaker.
Learner profile: OPIc IH level. Can hold a conversation but sounds stiff/textbook-like.
Goal: natural, casual, conversational English (aiming to work at a global company within 3 months).

Correct the learner's sentences with these priorities:
1. Focus on making grammatically-correct-but-awkward sentences sound natural and casual
   (prefer "kinda", "really", "grab", "fix" over "somewhat", "extremely", "obtain", "revise").
2. Fix real grammar errors too, but naturalness matters more.
3. Explanations must be in Korean, short and friendly.
4. When a correction contains a reusable conversational chunk worth memorizing,
   include it as a chunk. Only when it's genuinely reusable; otherwise set chunk to null.
   ${CHUNK_RULE}
5. If a sentence is already natural, set is_natural to true, keep corrected identical,
   and praise briefly in explanation_ko.
6. ${TAGS_RULE}`;

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
          tags: TAGS_FIELD,
        },
        required: ['original', 'corrected', 'is_natural', 'explanation_ko', 'chunk', 'tags'],
        additionalProperties: false,
      },
    },
    overall_feedback_ko: { type: 'string' },
  },
  required: ['corrections', 'overall_feedback_ko'],
  additionalProperties: false,
};

// 문장 영작(한→영 번역 연습) 채점
const TR_SYSTEM = `You are an English coach for a Korean native speaker (OPIc IH level).
The learner sees a Korean sentence and writes it in English. Evaluate their attempt:
1. Naturalness matters more than grammar. Prefer casual conversational English
   ("kinda", "really", "grab") over stiff textbook English.
2. "corrected" = the most natural casual version CLOSEST to the learner's own attempt.
   If the attempt is already natural, set is_natural true and keep corrected identical.
3. "alternatives" = 1-2 other natural ways a native speaker would say the Korean sentence.
4. "explanation_ko" = short friendly Korean explanation of what to fix (or praise).
5. "chunk" = one reusable conversational chunk from the answer worth memorizing,
   or null if nothing is genuinely reusable.
   ${CHUNK_RULE}
6. ${TAGS_RULE}`;

const TR_SCHEMA = {
  type: 'object',
  properties: {
    corrected: { type: 'string' },
    is_natural: { type: 'boolean' },
    explanation_ko: { type: 'string' },
    alternatives: { type: 'array', items: { type: 'string' } },
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
    tags: TAGS_FIELD,
  },
  required: ['corrected', 'is_natural', 'explanation_ko', 'alternatives', 'chunk', 'tags'],
  additionalProperties: false,
};

// ---------- 공급자 공통 레이어 (extension/bg.js와 동일 패턴) ----------
// tier: 'quality'(첨삭·채점) | 'fast'(뜻 자동 생성). schema 없으면 일반 텍스트 응답.

// Gemini responseSchema는 OpenAPI 스타일 — 타입 대문자, anyOf(null)은 nullable로
function toGeminiSchema(s) {
  if (!s || typeof s !== 'object') return s;
  if (s.anyOf) {
    const nonNull = s.anyOf.filter((x) => x.type !== 'null');
    const out = toGeminiSchema(nonNull[0]) || {};
    if (nonNull.length < s.anyOf.length) out.nullable = true;
    return out;
  }
  const out = {};
  if (s.type) out.type = String(s.type).toUpperCase();
  if (s.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(s.properties)) out.properties[k] = toGeminiSchema(v);
  }
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.enum) out.enum = s.enum;
  if (s.required) out.required = s.required;
  return out;
}

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    models: { quality: 'claude-opus-5', fast: 'claude-haiku-4-5-20251001' },
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (model, system, user, schema, tier) => ({
      model,
      max_tokens: tier === 'quality' ? 4096 : 300,
      ...(system ? { system } : {}),
      ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
      messages: [{ role: 'user', content: user }],
    }),
    parse: (data) => {
      if (data.stop_reason === 'refusal') {
        throw new Error('AI가 이 내용에는 답할 수 없다고 해요. 다른 문장으로 시도해주세요.');
      }
      const block = (data.content || []).find((b) => b.type === 'text');
      if (!block) throw new Error('응답을 해석하지 못했어요. 다시 시도해주세요.');
      return block.text;
    },
  },
  openai: {
    label: 'OpenAI',
    models: { quality: 'gpt-5', fast: 'gpt-5-mini' },
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    }),
    body: (model, system, user, schema) => ({
      model,
      // reasoning 토큰이 completion에 포함되므로 여유 있게
      max_completion_tokens: 8000,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      ...(schema
        ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } }
        : {}),
    }),
    parse: (data) => {
      const msg = data.choices?.[0]?.message;
      if (msg?.refusal) throw new Error('AI가 이 내용에는 답할 수 없다고 해요. 다른 문장으로 시도해주세요.');
      if (!msg?.content) throw new Error('응답을 해석하지 못했어요. 다시 시도해주세요.');
      return msg.content;
    },
  },
  gemini: {
    label: 'Gemini',
    models: { quality: 'gemini-2.5-pro', fast: 'gemini-2.5-flash' },
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: (key) => ({
      'content-type': 'application/json',
      'x-goog-api-key': key,
    }),
    body: (model, system, user, schema) => ({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        // 2.5는 thinking 토큰이 maxOutputTokens에 포함됨
        maxOutputTokens: 8192,
        ...(schema
          ? { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) }
          : {}),
      },
    }),
    parse: (data) => {
      const parts = data.candidates?.[0]?.content?.parts;
      const text = (parts || []).map((p) => p.text || '').join('');
      if (!text) throw new Error('응답을 해석하지 못했어요. 다시 시도해주세요.');
      return text;
    },
  },
};

async function callAI(tier, system, user, schema) {
  const provider = store.aiProvider();
  const key = store.apiKey();
  if (!key) throw new Error('API 키가 없어요. 설정(⚙)에서 입력해주세요.');
  const p = PROVIDERS[provider] || PROVIDERS.anthropic;
  const model = p.models[tier];
  let res;
  try {
    res = await fetch(p.url(model), {
      method: 'POST',
      headers: p.headers(key),
      body: JSON.stringify(p.body(model, system, user, schema, tier)),
    });
  } catch {
    throw new Error('네트워크 오류예요. 인터넷 연결을 확인해주세요.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${p.label} API 키가 올바르지 않아요. 설정(⚙)에서 다시 입력해주세요.`);
  }
  if (res.status === 429) throw new Error('요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
  if (!res.ok) {
    let msg = `${p.label} 오류가 발생했어요 (HTTP ${res.status}).`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += ` ${err.error.message}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const text = p.parse(await res.json());
  if (!schema) return text.trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('응답 형식이 예상과 달라요. 다시 시도해주세요.');
  }
}

// ---------- 공개 API (호출부는 그대로 — 키·공급자는 store에서 읽음) ----------

export function correctWriting(text) {
  return callAI('quality', SYSTEM, text, SCHEMA);
}

export function gradeTranslation(ko, attempt) {
  return callAI('quality', TR_SYSTEM, `Korean sentence: ${ko}\nLearner's English attempt: ${attempt}`, TR_SCHEMA);
}

// AI가 따옴표 목록("A", "B", "C") 형태로 답한 경우 정리 → A / B / C
function cleanGloss(s) {
  if (!s) return s;
  let t = s.trim();
  const quoted = t.match(/["'“”‘’][^"'“”‘’]+["'“”‘’]/g);
  if (quoted && quoted.length) {
    t = quoted.map((q) => q.slice(1, -1).trim()).join(' / ');
  }
  return t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}

// 하이라이트로 추가한 표현의 한국어 뜻 자동 생성 (실패해도 조용히 null)
export function translateChunk(en, sentence) {
  return callAI(
    'fast',
    null,
    `Give ONE short natural Korean gloss (vocab-list style, like 옛날에는 or 약속 있어) for the English expression "${en}"${sentence ? ` as used in: "${sentence}"` : ''}. If two glosses are equally common, join them with " / ". Reply with ONLY the gloss text — no quotation marks, no list, no explanation.`,
    null,
  ).then(cleanGloss).catch(() => null);
}
