#!/usr/bin/env python3
"""Build a typed lark-cli Base batch payload from a research CSV slice."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

DATASETS = {
    "candidates": {
        "path": ROOT / "docs/research/data/candidates.csv",
        "key": "候选ID",
        "multi": set(),
        "number": set(),
        "bool": set(),
        "exclude": set(),
    },
    "products": {
        "path": ROOT / "docs/research/data/products.csv",
        "key": "产品ID",
        "multi": {"平台", "发现市场", "规模指标类型", "数据缺口"},
        "number": {"规模下限", "规模上限"},
        "bool": set(),
        "exclude": set(),
    },
    "evidence": {
        "path": ROOT / "docs/research/data/evidence.csv",
        "key": "证据ID",
        "multi": set(),
        "number": set(),
        "bool": set(),
        "exclude": set(),
    },
    "reviews": {
        "path": ROOT / "docs/research/data/reviews.csv",
        "key": "评论ID",
        "multi": {"主题标签"},
        "number": {"评分"},
        "bool": {"已去个人信息"},
        "exclude": set(),
    },
    "tasks": {
        "path": ROOT / "docs/research/data/tasks.csv",
        "key": "任务ID",
        "multi": {"关联产品ID", "关联决策ID"},
        "number": set(),
        "bool": set(),
        "exclude": set(),
    },
}


def id_number(value: str) -> int:
    match = re.search(r"(\d+)$", value.strip())
    if not match:
        raise ValueError(f"business ID has no numeric suffix: {value!r}")
    return int(match.group(1))


def convert(value: str, field: str, spec: dict[str, object]) -> object:
    value = value.strip()
    if not value:
        return None
    if field in spec["multi"]:
        return [part.strip() for part in value.split(";") if part.strip()]
    if field in spec["number"]:
        return int(value)
    if field in spec["bool"]:
        normalized = value.lower()
        if normalized in {"是", "true", "1", "yes"}:
            return True
        if normalized in {"否", "false", "0", "no"}:
            return False
        raise ValueError(f"unsupported boolean value for {field}: {value!r}")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", choices=sorted(DATASETS))
    parser.add_argument("--min-number", type=int, required=True)
    parser.add_argument("--max-number", type=int)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    spec = DATASETS[args.dataset]
    with spec["path"].open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"missing CSV header: {spec['path']}")
        fields = [field for field in reader.fieldnames if field not in spec["exclude"]]
        rows = []
        for row in reader:
            number = id_number(row[spec["key"]])
            if number < args.min_number:
                continue
            if args.max_number is not None and number > args.max_number:
                continue
            rows.append([convert(row[field], field, spec) for field in fields])

    if not rows:
        raise ValueError("selected CSV slice is empty")
    if len(rows) > 200:
        raise ValueError("Base batch payload exceeds the 200-row limit")

    payload = {"fields": fields, "rows": rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"OK: {args.dataset} {len(rows)} rows -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
