#!/usr/bin/env python3
"""Restricted lark-cli gateway for this repository's research workspace.

The gateway keeps resource tokens out of shell commands, avoids dynamic shell
wrappers that defeat persistent approvals, and limits elevated execution to a
reviewed set of non-destructive research operations.
"""

from __future__ import annotations

import json
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, Tuple


ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_STATE = ROOT / ".lark-research-workspace.json"
MARKDOWN_STATE = ROOT / ".lark-markdown-sync.json"
MIRROR_STATE = ROOT / ".lark-research-mirrors.json"

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
        "+create",
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


def save_json_atomic(path: Path, data: Mapping[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    except OSError as exc:
        raise GatewayError(f"cannot update state file: {path.name}") from exc


def local_markdown_path(raw: str) -> Tuple[Path, str]:
    path = Path(raw)
    if path.is_absolute():
        resolved = path.resolve(strict=False)
    else:
        resolved = (ROOT / path).resolve(strict=False)
    if not is_within(resolved, ROOT.resolve()):
        raise GatewayError("markdown mirror must be inside the repository")
    if resolved.suffix.lower() != ".md":
        raise GatewayError("markdown mirror path must end in .md")
    if not resolved.is_file():
        raise GatewayError(f"markdown mirror does not exist: {raw}")
    return resolved, resolved.relative_to(ROOT.resolve()).as_posix()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
    if MIRROR_STATE.exists():
        mirrors = load_json(MIRROR_STATE)
        for section in ("folders", "files"):
            entries = mirrors.get(section, {})
            if not isinstance(entries, Mapping):
                raise GatewayError(f"invalid {section} in {MIRROR_STATE.name}")
            for key, entry in entries.items():
                if not isinstance(entry, Mapping):
                    raise GatewayError(f"invalid mirror entry: {key}")
                alias = entry.get("alias")
                token = entry.get("token")
                if not isinstance(alias, str) or not alias.startswith("@research-"):
                    raise GatewayError(f"invalid mirror alias: {key}")
                if not isinstance(token, str) or not token.strip():
                    raise GatewayError(f"invalid mirror token: {key}")
                if alias in resources:
                    raise GatewayError(f"duplicate research alias: {alias}")
                resources[alias] = token.strip()
        sensitive_values.extend(collect_sensitive_strings(mirrors))
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
        if action == "+create":
            if has_option(args, "--file-token"):
                raise GatewayError("markdown +create does not accept --file-token")
        elif not has_option(args, "--file-token"):
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


def parse_cli_json(process: subprocess.CompletedProcess[str], sensitive_values: Iterable[str]) -> Dict[str, Any]:
    if process.returncode != 0:
        if process.stdout:
            sys.stdout.write(redact(process.stdout, sensitive_values))
        if process.stderr:
            sys.stderr.write(redact(process.stderr, sensitive_values))
        raise GatewayError(f"lark-cli exited with status {process.returncode}")
    try:
        payload = json.loads(process.stdout)
    except json.JSONDecodeError as exc:
        raise GatewayError("lark-cli returned invalid JSON") from exc
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        raise GatewayError("lark-cli did not return a successful result")
    return payload


def create_markdown_mirror(argv: Sequence[str]) -> int:
    if len(argv) not in {2, 3}:
        raise GatewayError(
            "usage: --create-markdown-mirror <repo-relative.md> <@research-alias> [@research-folder-alias]"
        )
    path, relative_path = local_markdown_path(argv[0])
    alias = argv[1]
    folder_alias = argv[2] if len(argv) == 3 else "@research-folder"
    if not alias.startswith("@research-"):
        raise GatewayError("markdown mirror alias must start with @research-")

    resources, sensitive_values = workspace_resources()
    if alias in resources:
        raise GatewayError(f"markdown mirror alias already exists: {alias}")
    if folder_alias not in resources:
        raise GatewayError(f"unknown research folder alias: {folder_alias}")

    mirrors = load_json(MIRROR_STATE)
    files = mirrors.get("files")
    if not isinstance(files, dict):
        raise GatewayError(f"invalid files in {MIRROR_STATE.name}")
    if relative_path in files:
        raise GatewayError(f"markdown mirror path already exists: {relative_path}")

    process = subprocess.run(
        [
            "lark-cli",
            "markdown",
            "+create",
            "--folder-token",
            resources[folder_alias],
            "--file",
            relative_path,
            "--as",
            "user",
        ],
        cwd=str(ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    payload = parse_cli_json(process, sensitive_values)
    data = payload.get("data")
    token = data.get("file_token") if isinstance(data, Mapping) else None
    if not isinstance(token, str) or not token:
        raise GatewayError("markdown create result is missing file token")

    files[relative_path] = {
        "alias": alias,
        "token": token,
        "remote_name": path.name,
        "folder_alias": folder_alias,
        "last_synced_sha256": file_sha256(path),
        "last_synced_size_bytes": path.stat().st_size,
        "last_synced_version": str(data.get("version", "")),
    }
    save_json_atomic(MIRROR_STATE, mirrors)
    print(f"OK: created and registered Markdown mirror {relative_path} as {alias}; resource values redacted")
    return 0


def sync_markdown_mirror(argv: Sequence[str]) -> int:
    if len(argv) != 1:
        raise GatewayError("usage: --sync-markdown-mirror <repo-relative.md>")
    path, relative_path = local_markdown_path(argv[0])
    mirrors = load_json(MIRROR_STATE)
    files = mirrors.get("files")
    if not isinstance(files, dict):
        raise GatewayError(f"invalid files in {MIRROR_STATE.name}")
    entry = files.get(relative_path)
    state_path = MIRROR_STATE
    state_payload: Dict[str, Any] = mirrors
    if not isinstance(entry, dict):
        primary = load_json(MARKDOWN_STATE)
        if primary.get("local_file") != relative_path:
            raise GatewayError(f"markdown mirror is not registered: {relative_path}")
        entry = primary
        state_path = MARKDOWN_STATE
        state_payload = primary
    token = entry.get("token") or entry.get("file_token")
    if not isinstance(token, str) or not token:
        raise GatewayError(f"markdown mirror token is missing: {relative_path}")

    _, sensitive_values = workspace_resources()
    process = subprocess.run(
        [
            "lark-cli",
            "markdown",
            "+overwrite",
            "--file-token",
            token,
            "--file",
            relative_path,
            "--as",
            "user",
        ],
        cwd=str(ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    payload = parse_cli_json(process, sensitive_values)
    data = payload.get("data")
    if not isinstance(data, Mapping):
        raise GatewayError("markdown overwrite result is missing data")
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise GatewayError("markdown overwrite result is missing version")

    entry.update(
        {
            "last_synced_sha256": file_sha256(path),
            "last_synced_size_bytes": path.stat().st_size,
            "last_synced_version": version,
        }
    )
    if state_path == MIRROR_STATE:
        entry["remote_name"] = path.name
    save_json_atomic(state_path, state_payload)
    print(f"OK: synchronized Markdown mirror {relative_path}; version and resource values redacted")
    return 0


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
    required = {"@research-base", "@research-report", "@research-folder", "@research-markdown"}
    if not required.issubset(resources):
        raise GatewayError("research resource configuration is incomplete")
    mirror_count = len(resources) - len(required)
    print(
        "OK: lark-cli and 4 core research resources are configured; "
        f"{mirror_count} mirror aliases loaded; values are redacted"
    )
    return 0


def main(argv: Sequence[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print(
            "Usage: lark_research.py --check | --policy | "
            "--create-markdown-mirror <path> <alias> [folder-alias] | "
            "--sync-markdown-mirror <path> | "
            "<base|docs|markdown|drive> <+action> [args...]"
        )
        return 0
    if argv[0] == "--policy":
        print_policy()
        return 0
    if argv[0] == "--check":
        return check_configuration()
    if argv[0] == "--create-markdown-mirror":
        return create_markdown_mirror(argv[1:])
    if argv[0] == "--sync-markdown-mirror":
        return sync_markdown_mirror(argv[1:])
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
