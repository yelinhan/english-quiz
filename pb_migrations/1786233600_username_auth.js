/// <reference path="../pb_data/types.d.ts" />
// 이메일 대신 아이디(username)로 가입·로그인. 이메일은 선택 항목이 됨.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.add(new TextField({ name: 'username', required: true, min: 2, max: 30 }));
  users.indexes.push('CREATE UNIQUE INDEX idx_users_username ON `users` (username)');
  users.passwordAuth.identityFields = ['username'];
  users.fields.getByName('email').required = false;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.passwordAuth.identityFields = ['email'];
  users.fields.getByName('email').required = true;
  users.indexes = users.indexes.filter((i) => !i.includes('idx_users_username'));
  users.fields.removeByName('username');
  app.save(users);
});
