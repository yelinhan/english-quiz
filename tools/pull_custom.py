#!/usr/bin/env python3
"""PocketBase에서 유저들이 추가한 표현(eq.custom)을 꺼내 vocab 마크다운 행으로 출력

앱의 "내가 추가한 표현"은 계정별로 user_data 컬렉션(key='eq.custom')에 동기화된다.
이 스크립트는 관리자 권한으로 전 유저의 커스텀 표현을 모아, 이미 기본 단어장
(data/vocab.json)에 있는 것을 제외하고 vocab/chunks.md 형식의 표 행으로 출력한다.

사용법:
  python3 tools/pull_custom.py                          # 로컬 테스트 서버 기준
  PB_URL=https://quiz.example.com/pb PB_ADMIN=... PB_PASS=... python3 tools/pull_custom.py
"""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

PB = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
ADMIN = os.environ.get("PB_ADMIN", "admin@test.com")
PASS = os.environ.get("PB_PASS", "adminpass123")
VOCAB = Path(__file__).resolve().parent.parent / "data" / "vocab.json"


def api(path, token="", data=None):
    req = urllib.request.Request(
        PB + path,
        data=json.dumps(data).encode() if data else None,
        headers={"Content-Type": "application/json", **({"Authorization": token} if token else {})},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main():
    tok = api("/api/collections/_superusers/auth-with-password",
              data={"identity": ADMIN, "password": PASS})["token"]
    q = urllib.parse.quote("key='eq.custom'")
    recs = api(f"/api/collections/user_data/records?perPage=500&expand=user&filter={q}", tok)["items"]

    base = json.loads(VOCAB.read_text(encoding="utf-8")) if VOCAB.exists() else []
    known = {c["ko"] for c in base}

    rows = []
    for r in recs:
        who = r.get("expand", {}).get("user", {}).get("username", "?")
        for c in r["value"] or []:
            ko, en = (c.get("ko") or "").strip(), (c.get("en") or "").strip()
            if not ko or not en or ko in known:
                continue
            known.add(ko)  # 유저 간 중복도 1번만
            rows.append((ko, en, (c.get("example") or "").strip(), c.get("added") or "", who))

    if not rows:
        print("새로 반영할 커스텀 표현이 없어요 (전부 기본 단어장에 이미 있음).")
        return
    print(f"# 새 커스텀 표현 {len(rows)}개 — vocab/chunks.md 표에 추가할 행:\n")
    for ko, en, ex, added, who in rows:
        print(f"| {ko} | {en} | {ex} | {added} | {who} |")
    print("\n# 반영 후 english_study 루트에서: python3 app/tools/build_vocab.py")
    print("# 예문 해석은 vocab/example_ko.json에 추가 (build 시 경고로 알려줌)")


if __name__ == "__main__":
    main()
