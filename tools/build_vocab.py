#!/usr/bin/env python3
"""vocab/*.md 마크다운 표 → app/data/vocab.json (+ sentences.md → app/data/sentences.json)

사용법: python3 app/tools/build_vocab.py  (english_study 루트에서 실행)
id는 (type + ko) 해시 기반이라 표 순서가 바뀌어도 학습 기록이 유지된다.

영어 칸의 변형 표기:
- 띄어쓴 " / " = 같은 뜻의 다른 표현. 앱이 표현마다 카드를 따로 만든다 (I'm [swamped]. / I'm [behind on] work.)
- [ ] 안에 붙여 쓴 a/b = 같은 빈칸의 대안. 한 카드이고 어느 쪽을 써도 정답 (I'm not too [happy/thrilled] about it.)
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
SENTENCES = ROOT / "vocab" / "sentences.md"
SENTENCES_OUT = ROOT / "app" / "data" / "sentences.json"


def make_id(item_type: str, ko: str) -> str:
    h = hashlib.sha1(f"{item_type}:{ko}".encode()).hexdigest()[:8]
    return f"{item_type}-{h}"


def split_keys(en: str) -> tuple[str, list]:
    """영어 칸의 [ ]는 빈칸 퀴즈에서 비울 핵심 단어. 변형(/)마다 [ ] 묶음 목록 — 구동사처럼 떨어진 짝은
    [set] ~ [up]처럼 여러 개 — 이고, 없으면 None(= 표현 전체를 비움)"""
    keys = [re.findall(r"\[([^\]]+)\]", v) or None for v in split_variants(en)]
    return re.sub(r"[\[\]]", "", en), keys


def split_variants(en: str) -> list[str]:
    """띄어쓴 " / "만 표현 구분 ([happy/thrilled]처럼 붙여 쓴 건 같은 빈칸의 대안)"""
    return [v.strip() for v in re.split(r"\s+/\s+", en) if v.strip()]


def variant_without_example(item: dict) -> list[str]:
    """카드가 표현별로 나뉠 때 예문이 하나도 없는 표현 (대략: 핵심 단어 앞부분이 예문에 없으면)"""
    variants = split_variants(item["en"])
    if len(variants) < 2:
        return []
    keys = item.get("keys") or [None] * len(variants)
    ex = re.sub(r"[^a-z ]", "", item["example"].lower())
    missing = []
    for v, segs in zip(variants, keys):
        words = " ".join(segs).split() if segs else v.split()
        stems = [re.sub(r"[^a-z]", "", w.lower().split("/")[0])[:4] for w in words]
        if not all(st in ex for st in stems if st):
            missing.append(v)
    return missing


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
        en, keys = split_keys(en)
        item = {
            "id": make_id(item_type, ko),
            "type": item_type,
            "ko": ko,
            "en": en,
            "example": cells[2] if len(cells) > 2 else "",
            "category": category,
            "added": cells[3] if len(cells) > 3 else "",
            "source": cells[4] if len(cells) > 4 else "",
        }
        if any(keys):
            item["keys"] = keys
        items.append(item)
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
        for v in variant_without_example(it):
            print(f"  ⚠ 예문 없는 표현: {it['ko']} → \"{v}\" (표현마다 카드가 나뉘니 이 표현이 든 예문 필요)")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ {OUT.relative_to(ROOT)} 생성 — {len(items)}개 표현")
    by_cat = {}
    for it in items:
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
    for cat, n in by_cat.items():
        print(f"  - {cat}: {n}")
    build_sentences()


def build_sentences():
    """vocab/sentences.md (통문장) → app/data/sentences.json. 표 순서 = 출제 순서."""
    if not SENTENCES.exists():
        return
    items = []
    for line in SENTENCES.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2 or cells[0] == "한국어" or set(cells[0]) <= {"-", ":", " "}:
            continue
        ko, en = cells[0], cells[1]
        if not ko or not en:
            continue
        items.append({
            "id": make_id("sent", ko),
            "ko": ko,
            "en": en,
            "note": cells[2] if len(cells) > 2 else "",
            "added": cells[3] if len(cells) > 3 else "",
            "source": cells[4] if len(cells) > 4 else "",
        })
    SENTENCES_OUT.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ {SENTENCES_OUT.relative_to(ROOT)} 생성 — {len(items)}개 문장")


if __name__ == "__main__":
    main()
