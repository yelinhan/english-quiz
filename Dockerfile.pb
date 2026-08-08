# PocketBase (인증 + 유저 데이터 DB) — 마이그레이션을 이미지에 포함해서 배포
FROM alpine:3.21 AS fetch
ARG PB_VERSION=0.39.10
ARG TARGETARCH
RUN apk add --no-cache unzip && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /tmp/pb

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=fetch /tmp/pb/pocketbase /usr/local/bin/pocketbase
COPY pb_migrations /pb/pb_migrations

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://127.0.0.1:8090/api/health || exit 1

CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
