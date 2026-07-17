# Repository Agent Instructions

## Product and repository map

This repository is the React Native iOS/Android client for **朝夕相伴（AI4ALL Companion）**. It is not a standalone demo: it connects to an existing AI4ALL backend that already owns authentication, account isolation, conversation orchestration, Soul/profile, memory, model calls, moderation, reminders, and channel routing.

The paired backend is:

- Local repository: `/Users/suchong/workspace/ai4all/weixin_bot`
- Git origin: `git@github.com:huanshanxiaoyao/ai4all_bridge.git`
- Default branch: `main`
- Local development origin: `http://127.0.0.1:8180`
- Local App API base: `http://127.0.0.1:8180/api/v1`
- Production public origin: `https://ai4company.top`
- Production App API base: `https://ai4company.top/api/v1`
- Production health endpoint: `https://ai4company.top/api/health`

The production health endpoint and public App config were reachable on 2026-07-17. Treat runtime flags and provider availability as dynamic: query `/api/v1/app/config` rather than copying their current values into code or documentation.

When work depends on backend behavior, inspect the paired repository and its own `AGENTS.md` before making assumptions. Backend contracts and deployment configuration are authoritative; do not infer new capabilities from planned App UI. Do not modify the backend repository unless the user's task includes backend changes, and keep cross-repository diffs and verification explicit.

The mobile client must use the versioned `/api/v1/*` App API. It must not call `/web/*`, `/openclaw/*`, admin/debug endpoints, or depend on backend database internals. Never place SMS, Captcha, ASR, LLM, database, bridge, or admin secrets in this repository or in `EXPO_PUBLIC_*` variables.

### Current backend capability boundary

The paired backend already provides the App foundation:

- mainland China phone registration/login with Aliyun Captcha and SMS OTP;
- revocable 30-day App sessions;
- an independent `app` channel and App conversation scope;
- current-user/account summary;
- text history, text turns, persisted replies, and idempotent retry;
- batch audio transcription API and server-side provider abstraction;
- production HTTPS routing for `/api/v1/*`.

The target product is ahead of the current backend in several areas. Do not claim these are implemented until the backend contract and tests exist:

- multiple selectable or user-created AI characters;
- per-character conversation and memory isolation;
- a world/universe content stream populated by AI characters;
- visitor passes into another user's world, user-facing invite identifiers, access revocation, or visitor management;
- multiple worlds/universes per user or world switching;
- bounded human-to-human chat between a world owner and an invited visitor;
- likes, comments, user posts, or notifications for world activity.

Today, the safe compatibility assumption is one isolated AI4ALL account/world and one active App conversation for each user. New UI for future capabilities must be feature-gated, honestly marked unavailable, or kept inside an explicit prototype; it must never fabricate visitor access, shared fragments, human conversations, or additional AI conversations.

Useful backend sources to inspect before App contract work:

- `../weixin_bot/AGENTS.md`: backend workflow, invariants, runtime, and test rules.
- `../weixin_bot/app/routers/app_api.py`: current versioned mobile App API contract.
- `../weixin_bot/app/channels.py`: channel capabilities and App conversation scope.
- `../weixin_bot/deploy/nginx/ai4company.top.conf`: tracked production public routing.
- `../weixin_bot/docs/STATUS.md`: current backend status and known gaps.
- `../weixin_bot/docs/tech_design/web_app_channel_access_design.md`: channel/account/session background and App API evolution context.

## Product direction: a private inner world, not a social network

The product may borrow familiar interaction shapes such as a conversation list or a vertically scrolling stream, but its purpose is deliberately not social growth. It is a user-owned spiritual refuge: a private parallel world or small sanctuary inhabited by official and user-created AI characters. A few real friends may be explicitly invited to visit without becoming inhabitants or participants.

Preserve these principles in product, design, copy, metrics, and implementation:

- Optimize for companionship, safety, calm, continuity, and a sense of place—not follower growth, virality, popularity, or content consumption time.
- No public square, stranger discovery, follower graph, trending list, popularity ranking, public like counts, social comparison, or algorithmic engagement pressure by default.
- Real people enter only through deliberate invitation. They are visitors, not co-owners or participants in the owner's AI relationships. The world is private by default and remains useful when the user is its only real person.
- One-to-one AI conversations and private memories remain private when real friends visit the world.
- Official characters and user-created characters should feel like inhabitants of the user's world, not a marketplace inventory or interchangeable bot catalog.
- All three bottom tabs are icon-only in the visible UI. They must still expose accessible tab names: “对话”, “世界”, and “我的”. The world tab may add a dynamic hint naming the active world. Do not add persistent text labels without product review.
- Design the three tab icons as one custom family built from a dot/seed and open curves. Conversation uses two points within an open dialogue curve; the world uses one point within broken orbital/ripple curves; profile uses one point supported by a human-like arc.
- “宇宙” remains an internal working term, not a frozen user-facing label. For the world tab, avoid literal globe, public feed, community, contacts, or “Moments” metaphors.
- Icon-only navigation requires a non-color selected state, at least 44×44pt touch targets, screen-reader labels and selected state, predictable tab order, and a one-time first-use explanation.
- Use low-arousal, warm, organic, paper-like visual language with restrained motion and clear contrast. Avoid high-energy social-media color systems, dense engagement chrome, and notification pressure.

### Owner and visitor-window model

- Every user owns a private home world. An invite grants access to visit another user's world; it does not transfer or replace the visitor's own world.
- Visiting is implemented as a per-visitor read-only window, not membership in the owner's world. A may expose different content to B and C.
- If B visits A's world, B may see only the exact world fragments, resident profiles, and future-sharing rules that A granted to B: selected posts from A and selected posts from A's AI residents.
- B cannot chat with A's AI residents, inspect their memories, post, comment, modify the world, invite others, or otherwise participate.
- B may have a bounded one-to-one human conversation with A. This does not create a searchable friend graph and does not allow B to chat with A's other visitors.
- Sharing defaults to private. A must explicitly select fragments or opt a visitor into a future-sharing rule; AI-generated content is never automatically exposed merely because it exists.
- A must be able to preview the exact window as B, choose an expiry such as 7 days/30 days/ongoing, pause all visitors, and revoke or change B's access independently.
- Do not show view counts, read receipts, visitor activity streaks, or other signals that turn the window into a social-performance surface.
- Validate demand in order: first a single world postcard or hand-picked fragment collection, then a persistent read-only visitor window, then bounded A↔B chat.
- A steward Agent is explicitly out of the current product scope. Reconsider it only if real visitor behavior shows repeated unmet needs that static world introductions, resident cards, selected fragments, and direct chat with A cannot solve. Do not connect a future steward to private chats or long-term memory by default.

The current product documents are:

- `docs/product/ai_companion_app_v1_prd.md`: implemented single-Agent App engineering baseline.
- `docs/product/ai_companion_universe_prd.md`: evolving target product model for characters, the private parallel world, and invited real friends.

## Collaborative research workspace

The overseas AI companion research uses three layers:

- Feishu Docx is the collaborative narrative report.
- Feishu Base is authoritative for structured product, evidence, review, and task records.
- `docs/research/` is the Git-tracked snapshot, method library, and local evidence workspace.

The main Git snapshot is:

`docs/research/overseas_ai_companion_landscape.md`

Remote tokens, URLs, versions, and sync hashes live only in the ignored files `.lark-research-workspace.json` and `.lark-markdown-sync.json`. Never print or commit their contents.

## Lark research gateway

All routine Feishu/Lark operations for this research workspace must use the fixed gateway:

`python3 scripts/research/lark_research.py <service> <+action> [args...]`

The gateway reads ignored resource state internally, fixes the identity to `user`, redacts configured tokens/URLs from command output, and invokes `lark-cli` without a dynamic shell. Do not construct commands with `BASE_TOKEN=$(jq ...)`, `DOC_TOKEN=$(jq ...)`, or direct token arguments.

The persistent elevated-command approval should be scoped only to `python3 scripts/research/lark_research.py`. The gateway allowlist covers routine Base, Docx, Markdown, and Drive research reads/writes. It intentionally blocks resource deletion, ownership/share/permission changes, and full Docx overwrite. If an operation is blocked, do not bypass the gateway with direct `lark-cli`; explain the missing capability and obtain explicit direction if the action is destructive or expands scope.

Useful checks:

```bash
python3 scripts/research/lark_research.py --check
python3 scripts/research/lark_research.py --policy
```

## Research sync before Git commits

When preparing a Git commit in this repository:

1. If the task materially advances the research or its product decisions, update the relevant local files under `docs/research/` first.
2. Before changing the collaborative Feishu Docx, use the gateway to compare its current remote version/modified time with the last version in `.lark-research-workspace.json`. If the remote changed, fetch it and merge the collaborators' changes before writing. Never blindly overwrite a remotely changed Docx.
3. Treat Feishu Base as authoritative for structured records. Keep tracked CSV files as reproducible snapshots/templates; do not overwrite newer Base records from a stale CSV export.
4. After reconciliation, update the collaborative Docx using the smallest safe patch. A full overwrite is allowed only when the current remote version matches the recorded base version and no collaborator changes would be lost.
5. Continue updating the existing Feishu native Markdown file as a read-only Git mirror: compare the local SHA-256 with `.lark-markdown-sync.json`; when different, run `python3 scripts/research/lark_research.py markdown +overwrite --file <local.md>`, verify `ok: true`, non-empty `version`, and matching `size_bytes`, then update the ignored sync state.
6. The user's July 2026 authorization covers these normal, non-destructive research syncs before commits; do not ask for confirmation each time.
7. Skip identical uploads. If authentication, network access, conflict detection, or remote verification fails, report the failure and do not claim synchronization.
8. Do not delete remote research resources, transfer ownership, change public sharing, or grant new collaborators without explicit user direction.
