/// <reference path="../pb_data/types.d.ts" />
// 유저별 학습 데이터 저장소. 키(eq.srs, eq.log, ...)당 레코드 1개, 값은 JSON blob.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const collection = new Collection({
    type: 'base',
    name: 'user_data',
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
    updateRule: "@request.auth.id != '' && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      },
      { name: 'key', type: 'text', required: true, max: 64 },
      { name: 'value', type: 'json', maxSize: 5000000 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_user_data_user_key ON user_data (user, `key`)'],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('user_data'));
});
