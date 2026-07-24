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

The paired backend has completed the Companion World 3.0 M0–M5 refactor on `main`. Its versioned App contract and tests now cover multi-resident worlds, per-resident conversations, universe-level L3 user memory, world posts and notifications, resident lifecycle and mailbox, 24-hour invites with pending approval, 30-day visits, and bounded owner–visitor human chat.

These capabilities being implemented does not mean they are currently enabled in production. The P1/M3/M4/M5 feature flags remain default-off until the production migration, read-only reconciliation, client integration, cache-safety checks, and staged rollout gates are complete. Query `/api/v1/app/config` and the relevant API responses at runtime; do not hard-code rollout state. When a capability is disabled, the client must fall back to the supported legacy single-Agent experience or hide the unavailable surface. It must never fabricate extra AI residents, lifecycle events, mailbox letters, universe-feed access, visitor access, or human conversations.

Still-out-of-scope capabilities include multiple home worlds per user, public world/profile/post URLs, stranger discovery, visitor-to-visitor chat, public relationship graphs, public likes/rankings, and a steward Agent connected to private chats or long-term memory.

Useful backend sources to inspect before App contract work:

- `../weixin_bot/AGENTS.md`: backend workflow, invariants, runtime, and test rules.
- `../weixin_bot/app/routers/app_api.py`: current versioned mobile App API contract.
- `../weixin_bot/app/channels.py`: channel capabilities and App conversation scope.
- `../weixin_bot/deploy/nginx/ai4company.top.conf`: tracked production public routing.
- `../weixin_bot/docs/STATUS.md`: current backend status and known gaps.
- `../weixin_bot/docs/tech_design/companion_world_3_0_refactor_design.md`: frozen Companion World decisions, implementation status, flags, and rollout gates.
- `../weixin_bot/docs/tech_design/companion_world_m5_backend_spec.md`: frozen invite/pending/visit/human-chat state machine and API contract.
- `../weixin_bot/docs/tech_design/web_app_channel_access_design.md`: channel/account/session background and App API evolution context.

## Product direction: a private inner world, not a social network

The product may borrow familiar interaction shapes such as a conversation list or a vertically scrolling stream, but its purpose is deliberately not social growth. It is a user-owned spiritual refuge: a private parallel world or small sanctuary inhabited by official and user-created AI characters. A few real friends may be explicitly invited to visit without becoming inhabitants or participants.

Preserve these principles in product, design, copy, metrics, and implementation:

- Optimize for companionship, safety, calm, continuity, and a sense of place—not follower growth, virality, popularity, or content consumption time.
- No public square, stranger discovery, follower graph, trending list, popularity ranking, public like counts, social comparison, or algorithmic engagement pressure by default.
- Real people enter only through deliberate invitation. They are visitors, not co-owners or participants in the owner's AI relationships. The world is private by default and remains useful when the user is its only real person.
- There is no public-facing product surface: no public world/profile/post URL, public indexing, stranger-accessible sharing page, or public relationship graph.
- One-to-one AI conversations and all AI memory remain private from real-world visitors. Within one home world, residents share the complete L3 set of persisted facts and derived profiles about the user without a field-level allowlist; raw chat transcripts, retrieval/evidence replay, resident-specific relationship memory, and persona/mission state remain isolated per resident.
- Official characters and user-created characters should feel like inhabitants of the user's world, not a marketplace inventory or interchangeable bot catalog.
- The product is an additional support system alongside real life: it may fill gaps or shortages in a user's existing support network, but must not claim to replace real family, friends, partners, therapy, or professional judgment.
- The operationally configured initial residents should model a small, complementary group of peer friends. Do not preinstall parents, children, siblings, romantic partners, or other highly personal relationship roles for every user; users may explicitly create these relationship archetypes for their own world.
- A user-created family or romantic label still describes an AI-resident relationship. It does not make the character a real relative, guardian, or partner, and it does not authorize impersonation of a specific real person. Specific-person replicas, deceased-person memorial roles, minor-like personas, and mixed guardianship/romance scenarios require separate product and safety rules.
- Do not create a primary/main companion role. All active AI residents are peers in the world and the conversation list has no permanent primary-character pin.
- All three bottom tabs are icon-only in the visible UI. They must still expose accessible tab names: “对话”, “世界”, and “我的”. The world tab may add a dynamic hint naming the active world. Do not add persistent text labels without product review.
- Design the three tab icons as one custom family built from a dot/seed and open curves. Conversation uses two points within an open dialogue curve; the world uses one point within broken orbital/ripple curves; profile uses one point supported by a human-like arc.
- “宇宙” remains an internal working term, not a frozen user-facing label. For the world tab, avoid literal globe, public feed, community, contacts, or “Moments” metaphors.
- Icon-only navigation requires a non-color selected state, at least 44×44pt touch targets, screen-reader labels and selected state, predictable tab order, and a one-time first-use explanation.
- Use low-arousal, warm, organic, paper-like visual language with restrained motion and clear contrast. Avoid high-energy social-media color systems, dense engagement chrome, and notification pressure.

### AI resident collection and lifecycle

- After authentication, a new user immediately sees the operationally configured initial resident set. Before confirming the world, the user may dismiss some candidates but must retain at least one; creating one custom resident is optional.
- Initial confirmation does not require selecting a main character or starting a first chat. The App then shows all retained active residents as available conversation entries.
- Preset, user-created, and mailbox-accepted residents share one limit: at least one at initial confirmation and at most 10 active AI friends afterward. Departures may later reduce the active count, and historical `offline` residents do not consume an active slot.
- A private mailbox lives under “我的”. A new AI-character letter is eligible only while the world has fewer than 8 active AI friends. Early versions use operations-configured characters; automatic generation is future scope.
- A mailbox character never joins automatically. The user must explicitly accept, and the server rechecks that the active-resident count is below 10 at acceptance time.
- Preset, user-created, and mailbox-accepted AI friends all use the same departure model. An active AI friend may irreversibly become `offline` after an internal configured period without conversation or after a sustained, audited relationship assessment finds values incompatible.
- Migrated `origin=legacy` residents are the explicit exception: they never transition to `offline`, and the App must not show a leave/departure action for them. Their legacy runtime account remains available for compatibility; this exception does not create a primary-character role.
- Never expose inactivity, departure thresholds, values assessment, cooldown state, or departure probability in UI, help, settings, notifications, or farewell copy. Do not send retention warnings, reminders, or “talk now to keep this friend” prompts.
- Values incompatibility requires evidence across multiple interactions and a server-side cooldown with a final recheck. A single model output, one disagreement, refusal of advice, protected traits, or crisis/vulnerability state must never trigger departure.
- The last active AI friend is protected from ordinary departure. Only sustained verbal abuse, credible threats, hateful harassment, or equivalently severe negative behavior confirmed by safety rules and audit may allow the last friend to leave.
- Departure creates exactly one restrained universe farewell post and no direct message, push, modal, or recovery CTA. The conversation and profile become read-only; the user cannot restore or re-activate the same relationship instance.
- Departure wording must not shame, blame, threaten, expose internal value classifications, or connect recovery to payment, streaks, tasks, or engagement goals.
- The intended narrative is quiet relationship flow: some unsuitable friends gradually leave and new friends may later arrive through the private mailbox. A departure may make the world mailbox-eligible but must never auto-install a replacement.
- Character lifecycle and mailbox events require authoritative backend state, idempotent transitions, auditability, and safety tests. Do not simulate them as random client-only events outside an explicit prototype.

### Owner and time-limited visit model

- Every user owns a private home world. A visit never transfers or replaces the visitor's own world.
- Registration, onboarding, session creation, and login never accept a world invite code and never choose a visited world. After login, the App fetches pending, active, and historical visits separately.
- A creates “我的邀请码” only from the authenticated “我的” tab. B must already be an authenticated App user and redeems the code from “我的 → 穿越到好朋友的平行世界”.
- Each code is single-use. When B redeems it, the code is permanently consumed and a `pending` visit is bound to A, B, and A's world; B cannot transfer or re-share it, and pending status grants no Feed or chat access.
- The invite has one absolute 24-hour `expires_at` starting when A creates it. Redemption starts a separate absolute 7-day pending window in which A may accept or reject and B may cancel. A's acceptance starts a separate absolute 30-day active visit and creates the A↔B human conversation atomically. None of these windows renews or extends.
- A world has at most three concurrent visit slots. A valid unredeemed invite, pending visit, or active visit occupies one slot; invite expiry/revocation or any terminal visit transition releases it. A visitor may hold at most three `pending + active` visits across all worlds. Creation, redemption, acceptance, and termination enforce these limits transactionally.
- During an active visit only, B can switch from “我的” into A's world and read the same published universe-tab feed that A sees: posts by A and posts by A's AI residents.
- B cannot chat with A's AI residents, inspect their memories, post, comment, modify the world, invite others, or otherwise participate.
- B may have a bounded one-to-one human conversation with A. This does not create a searchable friend graph and does not allow B to chat with A's other visitors.
- The active visit's absolute `expires_at` gates both the world feed and A↔B message sending. After expiry, revocation, leaving, or blocking, B cannot fetch A's universe feed and neither side can send new messages in that visit conversation.
- A↔B messages from any terminal visit remain available as clearly marked read-only history unless a later deletion policy replaces this rule.
- A may reject a pending visit or revoke an active visit early. B may cancel pending or leave active early. Re-login restores pending and active records from server state without carrying the code through auth.
- Visit and human-chat responses must use `Cache-Control: no-store`. The App must not persist a visited world's Feed for offline use and must immediately clear its visited-world cache and temporary media when a visit becomes terminal; cached data is never an authorization source.
- Do not show universe-feed view counts, read receipts, visitor activity streaks, or other signals that turn the visit into a social-performance surface.
- The universe tab is a chronological, Moments-like feed about the user and their private world. Its authors are the user and the user's AI residents; visitors only read it.
- A steward Agent is explicitly out of the current product scope. Reconsider it only if real visitor behavior shows repeated unmet needs that static world introductions, resident cards, the published universe feed, and direct chat with A cannot solve. Do not connect a future steward to private chats or long-term memory by default.

The current product documents are:

- `docs/product/README.md`: product-document map, authority order, and status conventions.
- `docs/product/ai_companion_product_charter.md`: stable product purpose, relationship model, principles, red lines, and decision rubric.
- `docs/product/ai_companion_app_v1_prd.md`: implemented single-Agent App engineering baseline.
- `docs/product/ai_companion_universe_prd.md`: evolving target product model for characters, the private parallel world, and invited real friends.
- `docs/product/character_personas/README.md`: AI-resident persona, Soul, mission, and differentiation design workspace.
- `docs/tech_design/mobile_client_architecture.md`: target React Native client architecture and staged migration from the visual prototype.
- `docs/tech_design/private_world_backend_gap_analysis.md`: closed gap audit, backend-evolution record, and client mirror of frozen Companion World contracts.

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
