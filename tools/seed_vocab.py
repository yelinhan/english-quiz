#!/usr/bin/env python3
"""data/vocab.json → PocketBase vocab 컬렉션 시드 (멱등 upsert)

기본 단어장의 원본을 DB로 옮기는 스크립트. cid(콘텐츠 해시) 기준으로
- DB에 없으면 생성, 내용이 다르면 갱신, 같으면 건너뜀
- --prune: vocab.json에 없는 카드를 DB에서 삭제

사용법:
  python3 tools/seed_vocab.py                  # 로컬 테스트 서버
  PB_URL=https://quiz.example.com/pb PB_ADMIN=... PB_PASS=... python3 tools/seed_vocab.py

시드 후에는 PocketBase 대시보드에서 직접 카드를 추가·수정해도 된다 (DB가 원본).
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PB = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
ADMIN = os.environ.get("PB_ADMIN", "admin@test.com")
PASS = os.environ.get("PB_PASS", "adminpass123")
VOCAB = Path(__file__).resolve().parent.parent / "data" / "vocab.json"
FIELDS = ["cid", "wtype", "ko", "en", "example", "example_ko", "category", "added", "source", "ord"]


def api(path, token="", data=None, method=None):
    req = urllib.request.Request(
        PB + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": token} if token else {})},
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return json.loads(body) if body else None


def fetch_all(path, token):
    items, page = [], 1
    while True:
        d = api(f"{path}&page={page}&perPage=500", token)
        items += d["items"]
        if page >= d["totalPages"]:
            return items
        page += 1


def main():
    prune = "--prune" in sys.argv
    cards = json.loads(VOCAB.read_text(encoding="utf-8"))
    tok = api("/api/collections/_superusers/auth-with-password",
              data={"identity": ADMIN, "password": PASS})["token"]

    existing = {r["cid"]: r for r in fetch_all("/api/collections/vocab/records?sort=ord", tok)}
    created = updated = skipped = 0
    seen = set()
    for i, c in enumerate(cards):
        row = {
            "cid": c["id"], "wtype": c.get("type", ""), "ko": c["ko"], "en": c["en"],
            "example": c.get("example", ""), "example_ko": c.get("example_ko", ""),
            "category": c.get("category", ""), "added": c.get("added", ""),
            "source": c.get("source", ""), "ord": i,
        }
        seen.add(c["id"])
        old = existing.get(c["id"])
        if old is None:
            api("/api/collections/vocab/records", tok, row)
            created += 1
        elif any(old.get(f) != row[f] for f in FIELDS):
            api(f"/api/collections/vocab/records/{old['id']}", tok, row, method="PATCH")
            updated += 1
        else:
            skipped += 1

    pruned = 0
    for cid, old in existing.items():
        if cid not in seen:
            if prune:
                api(f"/api/collections/vocab/records/{old['id']}", tok, method="DELETE")
                pruned += 1
            else:
                print(f"  ⚠ DB에만 있는 카드 (삭제하려면 --prune): {cid} ({old['ko']})")

    print(f"✓ 시드 완료 — 생성 {created}, 갱신 {updated}, 동일 {skipped}"
          + (f", 삭제 {pruned}" if prune else ""))


if __name__ == "__main__":
    main()
