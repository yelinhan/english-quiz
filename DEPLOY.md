# 배포 가이드

## 흐름

```
git push (main) → GitHub Actions가 Docker 이미지 빌드 → ghcr.io/yelinhan/english-quiz:latest 푸시
→ 개인 서버에서 pull 받아 실행
```

## 최초 1회 설정

### 1. GHCR 이미지 공개 설정 (또는 로그인)

첫 push 후 이미지는 **private**으로 생성됨. 둘 중 하나 선택:

- **공개로 전환 (간단)**: GitHub → 프로필 → Packages → `english-quiz` → Package settings → Change visibility → Public
- **private 유지**: 서버에서 `docker login ghcr.io -u yelinhan` (비밀번호는 `read:packages` 권한의 PAT)

### 2. 서버에서 실행

`docker-compose.yml`을 서버에 복사한 뒤:

```bash
docker compose up -d
```

→ `http://서버주소:8080` 접속.

### 3. HTTPS 필수 (PWA)

서비스워커·홈화면 설치는 **HTTPS에서만** 동작함 (localhost 제외).
이미 쓰는 리버스 프록시(nginx/caddy/traefik)가 있으면 그 뒤에 붙이고, 없으면 Caddy가 제일 간단:

```
# Caddyfile 예시 — 인증서 자동 발급
quiz.example.com {
    reverse_proxy localhost:8080
}
```

## 업데이트 배포

단어장/코드 변경 후 push하면 이미지가 자동 빌드됨. 서버 반영은:

```bash
docker compose pull && docker compose up -d
```

수동이 귀찮으면 `docker-compose.yml`의 watchtower 주석을 해제 — 5분마다 새 이미지를 확인해 자동 재시작함.
