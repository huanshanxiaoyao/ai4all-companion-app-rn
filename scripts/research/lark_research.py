#!/usr/bin/env python3
"""Restricted lark-cli gateway for this repository's research workspace.

The gateway keeps resource tokens out of shell commands, avoids dynamic shell
wrappers that defeat persistent approvals, and limits elevated execution to a
reviewed set of non-destructive research operations.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, Tuple


ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_STATE = ROOT / ".lark-research-workspace.json"
MARKDOWN_STATE = ROOT / ".lark-markdown-sync.json"

ALLOWED_ACTIONS: Mapping[str, Set[str]] = {
    "base": {
        "+base-get",
        "+table-list",
        "+table-get",
        "+table-create",
        "+table-update",
        "+field-list",
        "+field-get",
        "+field-search-options",
        "+field-create",
        "+field-update",
        "+record-list",
        "+record-get",
        "+record-search",
        "+record-history-list",
        "+record-upsert",
        "+record-batch-create",
        "+record-batch-update",
        "+record-upload-attachment",
        "+record-download-attachment",
        "+data-query",
        "+view-list",
        "+view-get",
        "+view-create",
        "+view-rename",
        "+view-get-filter",
        "+view-set-filter",
        "+view-get-sort",
        "+view-set-sort",
        "+view-get-group",
        "+view-set-group",
        "+view-get-visible-fields",
        "+view-set-visible-fields",
        "+view-get-card",
        "+view-set-card",
        "+view-get-timebar",
        "+view-set-timebar",
    },
    "docs": {
        "+fetch",
        "+update",
        "+media-insert",
        "+media-preview",
        "+media-download",
    },
    "markdown": {
        "+fetch",
        "+diff",
        "+patch",
        "+overwrite",
    },
    "drive": {
        "+create-folder",
        "+download",
        "+export",
        "+export-download",
        "+import",
        "+inspect",
        "+pull",
        "+push",
        "+search",
        "+status",
        "+task_result",
        "+upload",
        "+version-get",
        "+version-history",
    },
}

DOC_ACTIONS_WITH_REPORT = {"+fetch", "+update", "+media-insert"}
CONFIG_TOKEN_FLAGS = {"--base-token", "--doc", "--file-token"}
TOKEN_FLAGS = {
    "--base-token",
    "--doc",
    "--file-token",
    "--folder-token",
    "--parent-token",
    "--token",
    "--wiki-token",
    "--spreadsheet-token",
    "--app-token",
}
PATH_FLAGS = {
    "--file",
    "--output",
    "--input",
    "--source",
    "--local-dir",
    "--local-path",
    "--directory",
}
ALLOWED_LOCAL_ROOTS = (ROOT, Path("/tmp"), Path("/private/tmp"))


class GatewayError(RuntimeError):
    pass


def load_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError as exc:
        raise GatewayError(f"missing state file: {path.name}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise GatewayError(f"cannot read state file: {path.name}") from exc
    if not isinstance(data, dict):
        raise GatewayError(f"invalid state object: {path.name}")
    return data


def nested_string(data: Mapping[str, Any], *keys: str) -> str:
    current: Any = data
    for key in keys:
        if not isinstance(current, Mapping) or key not in current:
            raise GatewayError("missing required research workspace state")
        current = current[key]
    if not isinstance(current, str) or not current.strip():
        raise GatewayError("invalid required research workspace state")
    return current.strip()


def workspace_resources() -> Tuple[Dict[str, str], List[str]]:
    workspace = load_json(WORKSPACE_STATE)
    markdown = load_json(MARKDOWN_STATE)
    resources = {
        "@research-base": nested_string(workspace, "research_base", "token"),
        "@research-report": nested_string(workspace, "report_docx", "token"),
        "@research-folder": nested_string(workspace, "folder", "token"),
        "@research-markdown": nested_string(markdown, "file_token"),
    }
    sensitive_values = list(resources.values())
    sensitive_values.extend(collect_sensitive_strings(workspace))
    sensitive_values.extend(collect_sensitive_strings(markdown))
    return resources, sensitive_values


def collect_sensitive_strings(value: Any, key_hint: str = "") -> List[str]:
    found: List[str] = []
    if isinstance(value, Mapping):
        for key, child in value.items():
            found.extend(collect_sensitive_strings(child, str(key).lower()))
    elif isinstance(value, list):
        for child in value:
            found.extend(collect_sensitive_strings(child, key_hint))
    elif isinstance(value, str):
        sensitive_key = any(
            marker in key_hint
            for marker in ("token", "url", "sha256", "modified_time", "version")
        )
        if sensitive_key and len(value) >= 8:
            found.append(value)
    return found


def option_value(args: Sequence[str], flag: str) -> str:
    for index, arg in enumerate(args):
        if arg == flag:
            if index + 1 >= len(args):
                raise GatewayError(f"{flag} requires a value")
            return args[index + 1]
        prefix = flag + "="
        if arg.startswith(prefix):
            return arg[len(prefix) :]
    return ""


def has_option(args: Sequence[str], flag: str) -> bool:
    return any(arg == flag or arg.startswith(flag + "=") for arg in args)


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def validate_local_path(raw: str) -> None:
    if raw in {"", "-"}:
        return
    candidate = raw[1:] if raw.startswith("@") else raw
    if candidate in {"", "-"}:
        return
    path = Path(os.path.expanduser(candidate))
    if not path.is_absolute():
        path = ROOT / path
    resolved = path.resolve(strict=False)
    if not any(is_within(resolved, root.resolve()) for root in ALLOWED_LOCAL_ROOTS):
        raise GatewayError("local file access is restricted to the repository or /tmp")


def validate_paths(args: Sequence[str]) -> None:
    for index, arg in enumerate(args):
        if arg in PATH_FLAGS:
            if index + 1 >= len(args):
                raise GatewayError(f"{arg} requires a value")
            validate_local_path(args[index + 1])
        elif any(arg.startswith(flag + "=") for flag in PATH_FLAGS):
            validate_local_path(arg.split("=", 1)[1])
        elif arg.startswith("@") and not arg.startswith("@research-"):
            validate_local_path(arg)
    for flag in ("--content", "--pattern"):
        value = option_value(args, flag)
        if value.startswith("@"):
            validate_local_path(value)


def expand_aliases(args: Sequence[str], resources: Mapping[str, str]) -> List[str]:
    expanded: List[str] = []
    for arg in args:
        if arg in resources:
            expanded.append(resources[arg])
            continue
        replaced = arg
        for alias, token in resources.items():
            suffix = "=" + alias
            if arg.endswith(suffix):
                replaced = arg[: -len(alias)] + token
                break
        expanded.append(replaced)
    return expanded


def validate_token_flags(args: Sequence[str], resources: Mapping[str, str]) -> None:
    aliases = set(resources)
    for index, arg in enumerate(args):
        for flag in TOKEN_FLAGS:
            if arg == flag:
                if index + 1 >= len(args):
                    raise GatewayError(f"{flag} requires a value")
                if args[index + 1] not in aliases:
                    raise GatewayError(f"{flag} must use a @research-* alias")
            elif arg.startswith(flag + "="):
                if arg.split("=", 1)[1] not in aliases:
                    raise GatewayError(f"{flag} must use a @research-* alias")


def build_command(
    service: str,
    action: str,
    raw_args: Sequence[str],
    resources: Mapping[str, str],
) -> List[str]:
    if service not in ALLOWED_ACTIONS:
        raise GatewayError(f"unsupported service: {service}")
    if action not in ALLOWED_ACTIONS[service]:
        raise GatewayError(f"action is outside the research allowlist: {service} {action}")
    if has_option(raw_args, "--as"):
        raise GatewayError("identity is fixed to --as user")
    validate_paths(raw_args)

    args = list(raw_args)
    if service == "base":
        if has_option(args, "--base-token"):
            raise GatewayError("base token is injected by the gateway")
        args.extend(["--base-token", "@research-base"])
    elif service == "docs":
        if action in DOC_ACTIONS_WITH_REPORT:
            if has_option(args, "--doc"):
                raise GatewayError("report token is injected by the gateway")
            args.extend(["--doc", "@research-report"])
        if action in {"+fetch", "+update"}:
            api_version = option_value(args, "--api-version")
            if api_version and api_version != "v2":
                raise GatewayError("Docx fetch/update is fixed to API v2")
            if not api_version:
                args.extend(["--api-version", "v2"])
        if action == "+update" and option_value(args, "--command") == "overwrite":
            raise GatewayError("full Docx overwrite is blocked; use a precise block update")
    elif service == "markdown":
        if has_option(args, "--file-token"):
            raise GatewayError("Markdown token is injected by the gateway")
        args.extend(["--file-token", "@research-markdown"])

    validate_token_flags(args, resources)
    args = expand_aliases(args, resources)
    args.extend(["--as", "user"])
    return ["lark-cli", service, action] + args


def redact(text: str, sensitive_values: Iterable[str]) -> str:
    redacted = text
    for value in sorted(set(sensitive_values), key=len, reverse=True):
        if len(value) >= 8:
            redacted = redacted.replace(value, "<redacted:lark-resource>")
    return redacted


def print_policy() -> None:
    print("Allowed research gateway operations:")
    for service in sorted(ALLOWED_ACTIONS):
        actions = " ".join(sorted(ALLOWED_ACTIONS[service]))
        print(f"  {service}: {actions}")
    print("Blocked by design: resource deletion, ownership/share changes, permissions, and Docx overwrite.")


def check_configuration() -> int:
    if shutil.which("lark-cli") is None:
        raise GatewayError("lark-cli is not installed")
    resources, _ = workspace_resources()
    if len(resources) != 4:
        raise GatewayError("research resource configuration is incomplete")
    print("OK: lark-cli and 4 research resources are configured; values are redacted")
    return 0


def main(argv: Sequence[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print("Usage: lark_research.py --check | --policy | <base|docs|markdown|drive> <+action> [args...]")
        return 0
    if argv[0] == "--policy":
        print_policy()
        return 0
    if argv[0] == "--check":
        return check_configuration()
    if len(argv) < 2:
        raise GatewayError("service and +action are required")

    resources, sensitive_values = workspace_resources()
    command = build_command(argv[0], argv[1], argv[2:], resources)
    process = subprocess.run(
        command,
        cwd=str(ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if process.stdout:
        sys.stdout.write(redact(process.stdout, sensitive_values))
    if process.stderr:
        sys.stderr.write(redact(process.stderr, sensitive_values))
    return process.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except GatewayError as exc:
        print(f"gateway error: {exc}", file=sys.stderr)
        raise SystemExit(2)
