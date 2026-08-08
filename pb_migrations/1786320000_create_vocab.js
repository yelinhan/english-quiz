/// <reference path="../pb_data/types.d.ts" />
// 기본 단어장(모두 공유) 컬렉션. 읽기는 공개, 쓰기는 관리자(대시보드/시드 스크립트)만.
// 카드 id는 콘텐츠 해시(cid)를 유지해서 기존 학습 기록(eq.srs)과 이어진다.
migrate((app) => {
  const collection = new Collection({
    type: 'base',
    name: 'vocab',
    listRule: '',
    viewRule: '',
    fields: [
      { name: 'cid', type: 'text', required: true, max: 40 },
      { name: 'wtype', type: 'text', max: 20 },
      { name: 'ko', type: 'text', required: true, max: 500 },
      { name: 'en', type: 'text', required: true, max: 500 },
      { name: 'example', type: 'text', max: 2000 },
      { name: 'example_ko', type: 'text', max: 2000 },
      { name: 'category', type: 'text', max: 100 },
      { name: 'added', type: 'text', max: 20 },
      { name: 'source', type: 'text', max: 100 },
      { name: 'ord', type: 'number' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_vocab_cid ON vocab (cid)'],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('vocab'));
});
