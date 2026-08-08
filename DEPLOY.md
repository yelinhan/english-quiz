# 배포 가이드

## 흐름

```
git push (main) → GitHub Actions가 Docker 이미지 2개 빌드
  ├─ ghcr.io/yelinhan/english-quiz:latest      (nginx — 앱 정적 파일 + /pb/ 프록시)
  └─ ghcr.io/yelinhan/english-quiz-pb:latest   (PocketBase — 로그인 + 유저 데이터 DB)
→ 개인 서버에서 pull 받아 실행
```

앱 nginx가 `/pb/` 경로를 PocketBase 컨테이너로 프록시하므로, 외부에 열어야 하는 포트는 기존처럼 앱 하나뿐입니다. 유저 데이터는 `./pb_data`(SQLite)에 저장됩니다.

## 최초 1회 설정

### 1. GHCR 이미지 공개 설정 (또는 로그인)

첫 push 후 이미지는 **private**으로 생성됨. **두 패키지 모두** (`english-quiz`, `english-quiz-pb`) 둘 중 하나 선택:

- **공개로 전환 (간단)**: GitHub → 프로필 → Packages → 각 패키지 → Package settings → Change visibility → Public
- **private 유지**: 서버에서 `docker login ghcr.io -u yelinhan` (비밀번호는 `read:packages` 권한의 PAT)

### 2. 서버에서 실행

`docker-compose.yml`을 서버에 복사한 뒤:

```bash
docker compose up -d
```

→ `http://서버주소:8080` 접속.

### 3. PocketBase 관리자 계정 만들기

컬렉션(스키마)은 이미지에 포함된 마이그레이션이 첫 실행 때 자동 생성합니다. 관리자 계정만 만들면 됨:

```bash
docker compose exec pocketbase pocketbase superuser upsert 관리자이메일 비밀번호 --dir=/pb/pb_data
```

관리 대시보드는 보안상 서버 로컬(127.0.0.1:8090)에만 열려 있음. 접속하려면 SSH 터널:

```bash
ssh -L 8090:127.0.0.1:8090 서버주소   # 이후 브라우저에서 http://localhost:8090/_/
```

### 4. HTTPS 필수 (PWA)

서비스워커·홈화면 설치는 **HTTPS에서만** 동작함 (localhost 제외).
이미 쓰는 리버스 프록시(nginx/caddy/traefik)가 있으면 그 뒤에 붙이고, 없으면 Caddy가 제일 간단:

```
# Caddyfile 예시 — 인증서 자동 발급
quiz.example.com {
    reverse_proxy localhost:8080
}
```

## 회원가입 정책

계정은 **아이디(2~30자) + 비밀번호(8자 이상)**만으로 만듦 — 이메일 불필요.
기본값은 **누구나 가입 가능**. 친구들에게만 열고 싶으면 가입을 잠글 수 있음:

관리 대시보드 → Collections → `users` → API Rules → **Create rule**을 잠금(superuser만)으로 변경.
이후 새 유저는 대시보드에서 직접 추가.

이메일이 없으므로 비밀번호 분실 시 셀프 재설정은 불가 — 대시보드에서 해당 유저의 비밀번호를 직접 바꿔주면 됨.

## 기본 단어장 관리

기본 단어장(모든 유저 공유)은 **DB의 `vocab` 컬렉션이 원본** (읽기 공개, 쓰기는 관리자만):

- **최초 1회 시드**: `PB_URL=https://도메인/pb PB_ADMIN=... PB_PASS=... python3 tools/seed_vocab.py`
  — data/vocab.json의 카드를 DB에 넣음. 멱등이라 여러 번 실행해도 안전 (파일에서 지운 카드를 DB에서도 지우려면 `--prune`)
- **이후 카드 추가·수정**: 관리 대시보드 → `vocab` 컬렉션에서 직접. 카드 순서는 `ord`, id는 `cid`(콘텐츠 해시 — 기존 학습 기록과 연결되므로 임의로 바꾸지 말 것)
- **유저 커스텀 표현을 기본 단어장에 합치기**: `python3 tools/pull_custom.py`로 목록을 뽑아 검토 후 추가
- 앱은 DB에서 로드하고, 오프라인이면 마지막 캐시 → 번들 vocab.json 순으로 폴백
- (legacy) english_study 마크다운 → `build_vocab.py` 흐름은 초기 임포트용으로만 남음

## 백업

유저 데이터는 전부 `./pb_data` 폴더(SQLite)에 있음. 이 폴더만 주기적으로 복사하면 됨:

```bash
tar czf pb-backup-$(date +%F).tgz pb_data
```

## 업데이트 배포

단어장/코드 변경 후 push하면 이미지가 자동 빌드됨. 서버 반영은:

```bash
docker compose pull && docker compose up -d
```

수동이 귀찮으면 `docker-compose.yml`의 watchtower 주석을 해제 — 5분마다 새 이미지를 확인해 자동 재시작함.

## 로컬에서 통째로 테스트

Docker가 있으면 로컬에서도 동일 구성으로 실행 가능:

```bash
docker build -t chunky . && docker build -f Dockerfile.pb -t chunky-pb .
# docker-compose.yml의 image를 위 태그로 바꾸거나 build 지시자 사용
```

Docker 없이 프론트만 볼 때는 PocketBase 바이너리를 직접 받아 `--migrationsDir=pb_migrations`로 띄우고,
브라우저 콘솔에서 `localStorage.setItem('eq.pbUrl', 'http://127.0.0.1:8090')` 후 새로고침하면
`/pb` 프록시 없이 직접 연결됨 (CORS는 PocketBase 기본 허용).
