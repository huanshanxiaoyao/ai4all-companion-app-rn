#!/usr/bin/env python3
"""Validate the local research catalog before syncing or committing it."""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_PRODUCT_COLUMNS = {
    "产品ID",
    "产品名称",
    "类型",
    "平台",
    "证据状态",
    "最近核验日期",
    "Android Package",
    "iOS App ID",
    "规模指标类型",
    "规模下限",
    "规模上限",
    "规模原文",
    "规模数据源",
    "规模核验日期",
    "规模置信度",
    "入选状态",
    "研究层级",
    "数据缺口",
    "扫描批次",
}

REQUIRED_EVIDENCE_COLUMNS = {
    "证据ID",
    "产品ID",
    "证据类型",
    "标题",
    "来源URL",
    "证据等级",
    "采集日期",
    "核验状态",
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"{path}: missing header")
        rows = list(reader)
        if any(None in row for row in rows):
            raise ValueError(f"{path}: at least one row has more cells than the header")
        return reader.fieldnames, rows


def find_duplicates(rows: list[dict[str, str]], field: str) -> list[str]:
    values = [row[field].strip() for row in rows if row[field].strip()]
    return sorted(value for value, count in Counter(values).items() if count > 1)


def valid_http_url(value: str) -> bool:
    if not value:
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def validate(products_path: Path, evidence_path: Path) -> list[str]:
    errors: list[str] = []
    product_fields, products = read_csv(products_path)
    evidence_fields, evidence = read_csv(evidence_path)

    missing_product_fields = REQUIRED_PRODUCT_COLUMNS - set(product_fields)
    missing_evidence_fields = REQUIRED_EVIDENCE_COLUMNS - set(evidence_fields)
    if missing_product_fields:
        errors.append(f"products missing columns: {sorted(missing_product_fields)}")
    if missing_evidence_fields:
        errors.append(f"evidence missing columns: {sorted(missing_evidence_fields)}")
    if errors:
        return errors

    for field in ("产品ID", "Android Package", "iOS App ID"):
        duplicates = find_duplicates(products, field)
        if duplicates:
            errors.append(f"duplicate {field}: {duplicates}")

    evidence_duplicates = find_duplicates(evidence, "证据ID")
    if evidence_duplicates:
        errors.append(f"duplicate 证据ID: {evidence_duplicates}")

    product_ids = {row["产品ID"].strip() for row in products}
    for line_number, row in enumerate(products, start=2):
        product_id = row["产品ID"].strip() or f"line {line_number}"
        if not row["产品名称"].strip():
            errors.append(f"{product_id}: missing 产品名称")
        for field in ("官网", "Web域名", "规模数据源"):
            if not valid_http_url(row.get(field, "").strip()):
                errors.append(f"{product_id}: invalid {field} URL")
        lower = row["规模下限"].strip()
        upper = row["规模上限"].strip()
        try:
            if lower and int(lower) < 0:
                errors.append(f"{product_id}: 规模下限 must be non-negative")
            if upper and int(upper) < 0:
                errors.append(f"{product_id}: 规模上限 must be non-negative")
            if lower and upper and int(lower) > int(upper):
                errors.append(f"{product_id}: 规模下限 exceeds 规模上限")
        except ValueError:
            errors.append(f"{product_id}: scale bounds must be integers")
        if lower and not row["规模数据源"].strip():
            errors.append(f"{product_id}: scale bound has no 规模数据源")
        if row["规模原文"].strip() and not row["规模核验日期"].strip():
            errors.append(f"{product_id}: scale observation has no 规模核验日期")

    for line_number, row in enumerate(evidence, start=2):
        evidence_id = row["证据ID"].strip() or f"line {line_number}"
        if row["产品ID"].strip() not in product_ids:
            errors.append(f"{evidence_id}: unknown 产品ID {row['产品ID']!r}")
        if not valid_http_url(row["来源URL"].strip()):
            errors.append(f"{evidence_id}: invalid 来源URL")

    products_with_evidence = {row["产品ID"].strip() for row in evidence}
    missing_evidence = sorted(product_ids - products_with_evidence)
    if missing_evidence:
        errors.append(f"products without evidence: {missing_evidence}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--products",
        type=Path,
        default=Path("docs/research/data/products.csv"),
    )
    parser.add_argument(
        "--evidence",
        type=Path,
        default=Path("docs/research/data/evidence.csv"),
    )
    args = parser.parse_args()

    try:
        errors = validate(args.products, args.evidence)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    with args.products.open(encoding="utf-8-sig", newline="") as handle:
        product_count = sum(1 for _ in csv.DictReader(handle))
    with args.evidence.open(encoding="utf-8-sig", newline="") as handle:
        evidence_count = sum(1 for _ in csv.DictReader(handle))
    print(f"OK: {product_count} products, {evidence_count} evidence records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
