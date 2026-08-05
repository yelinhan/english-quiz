#!/usr/bin/env python3
"""vocab/*.md 마크다운 표 → app/data/vocab.json

사용법: python3 app/tools/build_vocab.py  (english_study 루트에서 실행)
id는 (type + ko) 해시 기반이라 표 순서가 바뀌어도 학습 기록이 유지된다.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # english_study/
SOURCES = [
    (ROOT / "vocab" / "chunks.md", "chunk"),
    (ROOT / "vocab" / "wordbook.md", "word"),
]
EXAMPLE_KO = ROOT / "vocab" / "example_ko.json"  # card id → 예문 전체 해석
OUT = ROOT / "app" / "data" / "vocab.json"


def make_id(item_type: str, ko: str) -> str:
    h = hashlib.sha1(f"{item_type}:{ko}".encode()).hexdigest()[:8]
    return f"{item_type}-{h}"


def parse_file(path: Path, item_type: str) -> list[dict]:
    if not path.exists():
        return []
    items = []
    category = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^##\s+(.*)", line)
        if m:
            category = m.group(1).strip()
            continue
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        # 헤더/구분선 행 건너뛰기
        if cells[0] in ("한국어", "한국어 뜻") or set(cells[0]) <= {"-", ":", " "}:
            continue
        ko, en = cells[0], cells[1]
        if not ko or not en:
            continue
        items.append({
            "id": make_id(item_type, ko),
            "type": item_type,
            "ko": ko,
            "en": en,
            "example": cells[2] if len(cells) > 2 else "",
            "category": category,
            "added": cells[3] if len(cells) > 3 else "",
            "source": cells[4] if len(cells) > 4 else "",
        })
    return items


def main():
    items = []
    seen = set()
    for path, item_type in SOURCES:
        for it in parse_file(path, item_type):
            if it["id"] in seen:
                print(f"  ⚠ 중복 건너뜀: {it['ko']}")
                continue
            seen.add(it["id"])
            items.append(it)
    ex_ko = json.loads(EXAMPLE_KO.read_text(encoding="utf-8")) if EXAMPLE_KO.exists() else {}
    for it in items:
        it["example_ko"] = ex_ko.get(it["id"], "")
        if it["example"] and not it["example_ko"]:
            print(f"  ⚠ 예문 해석 없음: {it['id']} ({it['ko']}) → vocab/example_ko.json에 추가 필요")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ {OUT.relative_to(ROOT)} 생성 — {len(items)}개 표현")
    by_cat = {}
    for it in items:
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
    for cat, n in by_cat.items():
        print(f"  - {cat}: {n}")


if __name__ == "__main__":
    main()
