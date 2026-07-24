# 私人平行世界：后端演进设计与客户端契约镜像

> 状态：V0.2，原后端 gap analysis 已结案；保留演进记录并镜像客户端所需冻结契约  
> 日期：2026-07-24  
> 后端仓库：`/Users/suchong/workspace/ai4all/weixin_bot`  
> 原始核查版本：`main@abe6e2b`  
> 后端 3.0 实现基线：`origin/main@3403380`（M5 PR #48 合并点；后续提交以配套仓库为准）  
> Git origin：`git@github.com:huanshanxiaoyao/ai4all_bridge.git`  
> 关联客户端设计：[React Native 客户端架构](./mobile_client_architecture.md)
> 关联产品规则：[AI 居民生活与内容主线](../product/character_personas/resident_life_and_content.md)

## 0. 结论

配套后端已经完成 Companion World 3.0 的 M0–M5 重构并合入 `main`，私人世界、多居民、世界动态/通知、生命周期/信箱、来访和真人会话均已有正式契约与 SQLite/PostgreSQL 测试。P1/M3/M4/M5 feature flag 仍默认关闭，尚未完成生产 migration、开 flag 和客户端接入；“已实现”不能误写成“当前生产已开放”。

本文的 gap 调研、阶段清单和早期代码发现保留为演进记录，不再作为后端当前状态源。当前实现、冻结决策和发布门以配套后端的 `docs/tech_design/companion_world_3_0_refactor_design.md`、M5 spec、正式路由和测试为准。

已经落地的核心结构是：

1. 保留 `platform_user` 作为真人身份。
2. 新增一人一个 `universe` 作为私人世界边界。
3. 新增角色模板和 `universe_resident` 关系实例。
4. 每个 active/offline AI 居民关系复用一个独立 AI4ALL runtime `account_id`，继续利用现有 Soul、Profile、Session、Message、Memory、Moderation 和 turn 隔离。
5. 新增显式世界/居民/会话 API，停止在新接口中默认取“第一个 active account”。
6. AI 动态、离开、信箱、来访和真人聊天分别新增持久化与权限模型；不混入现有 AI `messages`。
7. 居民 runtime 建号已与 owner binding、容量和新用户赠送解耦；配额/钱包按真人聚合，成本事件仍记录实际 resident runtime。

后端 M0–M5 已完成；客户端仍应按 feature flag、schema → read/history → write 的灰度顺序接入，不能绕过动态配置或用本地假数据模拟服务端状态。

## 1. 核查范围

本结论以以下真实代码为依据：

- `app/routers/app_api.py`：当前 `/api/v1` App API。
- `app/channels.py`：App channel 能力与 `__app_active__` scope。
- `app/db/_core.py`：SQLite/PostgreSQL 共用迁移和核心 schema。
- `app/db/billing.py`：platform user、account owner、建号、钱包与计费。
- `app/db/accounts.py`：session/message/history 和 App session token。
- `app/turn_service.py`、`app/user_profiles.py`、`app/memory_writer.py`：按 account 隔离的 turn/Profile/Memory。
- `tests/test_app_api.py`：App 登录、隔离历史、turn、ASR、logout 的现有回归。
- `docs/STATUS.md` 和 `docs/tech_design/web_app_channel_access_design.md`。

本次只读核查后端，没有修改后端仓库。

## 2. 原始核查时已具备能力（历史快照）

| 能力 | 当前实现 | 可否直接复用 |
| --- | --- | --- |
| 手机号登录 | Aliyun Captcha + SMS OTP | 是 |
| App session | 30 天 opaque token、当前设备可撤销 | 是；公开发布仍需安全加固/注销 |
| 真人身份 | `platform_users` | 是 |
| 真人拥有 AI account | `account_owner_bindings` | 是；支持多 account 关系，但未硬性执行居民规则 |
| AI 隔离容器 | `accounts` + `profiles` + account profile files | 是，适合作为 resident runtime |
| 短期会话 | `sessions`，App 使用 `__app_active__` | 是，每个 runtime account 一条 App 对话线 |
| 消息与幂等 | `messages`、account/message 唯一索引、`client_message_id` 映射 | 是，但需 conversation-aware API 和多节点并发加固 |
| Prompt/Soul/Memory | 大量逻辑严格按 `account_id` 读写 | 是，这是采用“一居民一 runtime account”的主要原因 |
| 内容审核/限流/成本记录 | 已在 turn 核心中 | AI 私聊可复用；Feed/Human chat 需单独接入 |
| ASR | `/audio/transcriptions` | 是，与居民无关 |
| App feature config | `/app/config`，当前只有 voice flag | 扩展后复用 |
| 双数据库 | SQLite 开发/测试、PostgreSQL 生产 | 新功能必须同时支持 |

## 3. 原始核查的关键代码发现（历史快照）

> 本节中的“当前”均指原始核查版本 `main@abe6e2b`，只保留问题形成背景；不得用来否定后续 M0–M5 已实现契约。

### 3.1 App 登录仍接受遗留邀请码字段

`AppSessionRequest` 当前仍包含：

```text
invite_code
campaign_code
```

`invite_code` 会进入既有 referral 注册逻辑，`campaign_code` 会进入营销归因。这些不是私人世界来访码，但字段名和入口与当前产品决策冲突。

处理建议：

- 从 App `/auth/session` DTO 移除两字段并增加“传入未知字段应拒绝”的契约测试。
- 既有 Web/运营 referral 和 campaign 子系统可保留在原入口，不做全局删除。
- 世界邀请码只允许登录后由 visit endpoint 兑换，绝不复用 referral code 表或 auth 参数。

### 3.2 当前 App API固定选择第一个 account

`/me`、`/chat/messages`、`/chat/turn` 都通过 `get_first_active_account_for_user()` 选择最早 account。多居民后这会产生：

- 无法知道用户正在和哪个角色聊天。
- 错误 account 的 Soul、Memory 和历史被调用。
- 客户端即使传展示名也不能形成安全业务键。

新 API 必须由服务端在当前用户的 home universe 中解析 `conversation_id → resident_id → runtime_account_id`，并校验 owner。旧 `/chat/*` 可保留为 legacy 兼容层，客户端迁移完成后再下线。

### 3.3 account 是天然的居民运行时隔离边界

现有以下资产都按 `account_id` 隔离：

- Soul / Identity / User / Memory profile files。
- `profiles`、`sessions`、`messages`。
- session lifecycle、dreaming、memory writer。
- prompt build、turn、moderation、usage trace。

因此不建议在所有表上新增 `character_id` 并重写隔离逻辑。新增 `universe_residents.runtime_account_id` 指向 account，可以让每个角色拥有独立关系和记忆。

注意：角色模板不是 runtime account。同一个官方模板进入两个用户世界时，应生成两个不同 resident 关系和两个不同 runtime account，不能共享展示名、私聊、记忆、使命进度或生活状态。首版实例化只在模板基础上更换展示名，后续多样性扰动另行评审。

### 3.4 计费与赠送是 P1 阻断项

当前 `get_or_create_default_ai4all_account_for_user()` / `create_ai4all_account_for_user()` 会：

- 建 owner binding。
- upsert subscription。
- 为该 account 创建 wallet。
- 按 account id 发放一次新用户贝壳。

`record_chat_usage_charge()` 同样按当前 runtime account 找/建 wallet。若每新增一个居民直接调用该流程，会出现每居民一个余额和每居民一次新客赠送。

P1 前必须新增“居民 runtime account 创建”路径：

- 不重复创建 platform subscription。
- 不发 new-user grant。
- 计费归属到该用户的 home billing account / user wallet。
- 成本事件仍记录实际 resident runtime account，便于成本和角色质量分析。

短期推荐新增显式 billing binding：

```text
runtime_account_id → billing_account_id / wallet_id
```

长期是否把 wallet 完全迁为 `platform_user_id` 唯一，可另做计费专题；不要把计费大迁移和 P1 首次居民闭环强绑定。

### 3.5 App channel 当前禁止主动投递与 TDAI

`CHANNEL_APP` 当前：

- `supports_proactive = false`
- `tdai_enabled = false`
- 所有回复同步 HTTP 返回

这对现有 App 私聊是正确的。AI 世界动态和离别动态不应通过把 `supports_proactive` 改成 true 来实现，否则会误开启当前没有 APNs/FCM 投递能力的提醒工具。

正确做法是新增 world-content scheduler/service：生成、审核并持久化 `universe_posts`。Feed 由客户端主动拉取；是否 Push 是后续独立能力。

### 3.6 当前 turn single-flight 仅为进程内锁

`app_api.py` 的 `_turn_locks` 是 Python `threading.Lock`。生产已经是多节点 PostgreSQL，两个进程可能同时处理同一 account 的不同/重复 turn。

P1 应将并发门禁下沉为数据库可见的 conversation turn 状态、PostgreSQL advisory lock 或可替换的分布式锁，并继续用 `(conversation_id, sender_id, client_message_id)` 唯一约束防重。不能把内存锁作为最终一致性保证。

### 3.7 App 响应契约仍需加固

当前 App API 已设置 `Cache-Control: no-store`，但仍存在：

- 错误使用 `detail`，有的为稳定英文 code，有的为中文文案。
- 产品基线要求的 `request_id` 未形成统一响应 envelope。
- `/me` 没有 world onboarding/capability 状态。
- `is_new_user` 只判断 platform user 是否第一次创建，不能覆盖老账号升级或中断的 world onboarding。

新接口统一返回稳定 `code`、`request_id`、`server_time`，展示文案由客户端本地化。

### 3.8 原始核查时不存在的业务能力

代码中没有以下目标实体或 App contract：

- Universe / home world。
- Character template / custom character。
- Universe resident / presence / offline。
- AI/用户世界动态。
- 私密信箱和角色来信。
- App 世界邀请码、visit 和三席事务。
- 主人—访客真人会话。
- 访问到期后的 Feed ACL 和缓存语义。
- 多居民会话列表、未读和只读状态。

现有 `faq_messages` 是公开/运营 FAQ 数据形态，不具备 owner universe、resident author 和 visitor ACL，不能改名复用为世界动态。

## 4. 推荐数据模型

### 4.1 身份与世界

#### `universes`

| 字段 | 说明 |
| --- | --- |
| `id` | 内部世界 ID，不作为可永久分享的公开码 |
| `owner_platform_user_id` | UNIQUE；每个真人一个 home world |
| `legacy_primary_account_id` | 老用户迁移/计费锚点 |
| `status` | active / disabled |
| `onboarding_state` | preparing / selecting / confirmed |
| `created_at/updated_at` | 审计 |

登录不会选择 universe；home universe 由当前 session 的 platform user 解析。

### 4.2 模板与居民关系

#### `character_templates`

保存运营预设、用户自建或未来自动生成的基础设定：

- `source_type`: official / operations / user_created / generated。
- `owner_platform_user_id`: 自建模板时非空；官方模板为空。
- 模板工作名、基础头像、简介、标签、三层生活主线和 persona 版本；模板工作名不默认成为实例展示名。
- 内部 prompt/策略不通过 App DTO 返回。
- `status` 与版本字段，保证运营更新不静默改写既有关系。

#### `universe_residents`

| 字段 | 说明 |
| --- | --- |
| `id` | resident/关系实例 ID |
| `universe_id` | 所属私人世界 |
| `character_template_id` | 模板及版本 |
| `display_name` | 实例展示名；与模板 key、resident ID 分离，不要求跨世界全局唯一 |
| `runtime_account_id` | 激活后唯一指向 AI4ALL account；candidate 可为空 |
| `origin` | preset / custom / mailbox / legacy |
| `status` | candidate / active / offline / dismissed |
| `joined_at/offline_at` | 生命周期时间 |
| `departure_event_id` | 唯一离开事务引用 |

`active` 总数硬限制 10。`offline` 不计数但保留历史。`dismissed` 仅用于首次确认前的候选，不等价于 AI 主动离开。

#### `ai_conversations`

客户端需要一个跨 session lifecycle 稳定的 conversation ID。现有 `sessions` 会按生命周期关闭并生成新的 active segment，不能把数值 `session.id` 直接当长期会话 ID。

- 一个 resident 关系对应一个稳定 AI conversation。
- conversation 保存 `resident_id`、owner、runtime account、active/read-only 状态。
- 现有 `sessions/messages` 继续作为底层会话段和消息存储；通过 runtime account + App scope 或新增关联字段归入稳定 conversation。
- offline 后 conversation 原子切为 read-only，不删除历史 session segment。
- 对话列表可以把 `ai_conversations` 与 `human_conversations` 汇总成统一读模型，但二者无需共用消息表。

#### `resident_lifecycle_events`

保存内部、不可下发给用户的：

- 评估类型、证据窗口和模型/规则版本。
- cooldown 起止、最终复核。
- crisis freeze / last-resident protection。
- 审核人/自动策略和幂等键。
- 最终 transition 结果。

用户可见离别文案只存于世界动态，不返回内部 reason。

#### Universe L3 用户沉淀记忆（D-05，已冻结并实现）

同一 universe 内，“关于真人用户”的全部持久事实、画像和长期沉淀记忆进入 L3，并向该世界全部 resident 共享，不做字段级白名单。USER 资料段、MEMORY 中的用户事实段以及八字等派生画像都遵循这一规则。

- 不共享各 resident 与用户的聊天原文、session 逐字稿、检索结果或证据回放；resident 不能横向读取其他 runtime account 的 `messages` 或 retrieval。
- L1 人设/使命与 L2 关系专属记忆继续按 resident/runtime account 隔离。
- L3 的写入来源、更新时间和用户侧可见/编辑/清空能力可审计，但这些治理能力不把全量共享退回字段白名单。
- 发布面和访客面仍只读取明确发布的内容；L3 共享不等于向真实访客公开记忆，也不等于自动进入世界动态。

### 4.3 世界动态

#### `universe_posts`

- `universe_id`。
- `author_type`: owner / resident / system。
- `author_platform_user_id` 或 `author_resident_id`。
- `post_type`: normal / farewell / world_event。
- `body`、媒体引用。
- `status`: draft / published / hidden / deleted / moderation_blocked。
- `published_at`、`idempotency_key`、moderation metadata。
- `source_private_message_ids` 不应出现在 App 响应；生成过程即使记录，也必须是受限审计引用。

farewell post 与 resident offline transition 在同一事务中创建，并以 departure event 建唯一约束，保证恰好一条。

### 4.4 信箱

#### `character_letters`

- `universe_id`、候选 template/version。
- `status`: unread / read / deferred / accepted / declined / expired。
- 投递资格快照、触发策略版本和幂等键。
- `accepted_resident_id`。
- 创建/查看/处理/过期时间。

投递时校验 active `< 8`；接受时再次校验 active `< 10`。接受和 resident/runtime account 创建必须是一个可回滚事务。

### 4.5 邀请与来访

#### `universe_invites`

- `universe_id`、inviter user。
- 只存 `code_hash`，原始高熵 code 仅创建响应显示一次。
- `status`: active / redeemed / revoked / expired。
- `expires_at` 是生成时确定的绝对时间，固定为创建后 24 小时。
- `redeemed_by_platform_user_id`、`visit_id`。

#### `universe_visits`

- `universe_id`、owner、visitor。
- `status`: pending / active / expired / rejected / cancelled / left / revoked / blocked。
- 兑换后写入独立的 7 天 `pending_expires_at`；pending 不授予 Feed/chat ACL。
- A 接受时写入独立的 30 天绝对 `expires_at`，并在同一事务创建真人会话；不继承 invite expiry，也不续期。
- 状态变更原因和审计时间。

为可靠执行“未兑换有效邀请码 + pending visit + active visit ≤ 3”，使用 1–3 号 `universe_visit_slots`：生成邀请时在 world row lock 下占一个 slot，兑换只把 slot 的 occupant 从 invite 切换为 visit，不新增占位。邀请作废/到期，以及 visit 拒绝、取消、到期、撤销、离开或拉黑均释放 slot。访客侧跨世界的 `pending + active` visit 也不得超过 3。

### 4.6 真人会话

#### `human_conversations` / `human_messages`

真人消息必须与 AI `messages` 分表：

- conversation 一对一绑定 visit、owner 和 visitor。
- message 记录真实 sender platform user。
- `(conversation_id, sender_id, client_message_id)` 唯一。
- 每次发送读取 visit status + `expires_at`。
- visit 终止后保留 read-only history；默认长期保留，不因 30 天 visit 到期自动删除。

这样可以从结构上保证真人消息不会进入 LLM、Soul、Dreaming、AI Memory 或 AI moderation prompt。真人内容仍需独立内容安全、举报和封禁能力。

## 5. 目标 API 分期

以下路径是设计建议，最终以 OpenAPI 评审为准。客户端只调用 `/api/v1/*`。

### P0：契约准备

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/app/config` | 增加 resident/feed/mailbox/visit/human-chat flags |
| POST | `/auth/session` | App DTO 移除 referral/campaign 字段 |
| GET | `/me/bootstrap` | user、home world、onboarding、capabilities、server_time |

### P1：居民与多会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/worlds/home/bootstrap` | 幂等创建世界和候选集合 |
| GET | `/worlds/home/resident-candidates` | 初始运营候选 |
| POST | `/worlds/home/residents/confirm` | 事务确认 1–10 人 |
| GET | `/worlds/home/residents` | active/offline 居民摘要 |
| POST | `/worlds/home/residents` | 创建自建角色；服务端校验容量 |
| GET | `/conversations` | AI/Human 统一只读列表模型 |
| GET | `/ai-conversations/{id}/messages` | 显式 conversation 历史 |
| POST | `/ai-conversations/{id}/turn` | 显式 resident runtime turn |

`/ai-conversations/{id}/turn` 不接受 `account_id`。服务端从 current user + conversation 解析 runtime account，防止猜测 ID 越权。

### P2：世界动态

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/worlds/home/feed` | 主人 Feed，游标分页 |
| POST | `/worlds/home/posts` | 首版文字发布 |
| DELETE | `/worlds/home/posts/{id}` | 删除自己的动态 |
| POST | `/worlds/home/posts/{id}/hide` | 隐藏 AI 动态 |

首版建议文字优先；图片上传需对象存储、受控签名 URL、EXIF 清理、审核和删除联动后再开。

### P3：生命周期与信箱

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/mailbox/letters` | 当前用户私密来信 |
| POST | `/mailbox/letters/{id}/accept` | 容量事务 + resident/runtime 创建 |
| POST | `/mailbox/letters/{id}/decline` | 拒绝 |
| POST | `/mailbox/letters/{id}/defer` | 暂后处理 |

离开评估、冷静期和调度使用内部 service/admin contract，不暴露 App 触发接口。App 只读取最终 resident state 和 farewell post。

### P4：限时来访

以下均为公网 `/api/v1` App API；表中省略 `/api` 前缀。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/world/invites` | 创建固定 24h invite；明文 code 只返回一次 |
| GET | `/v1/world/invites` | A 查看 slot/invite/pending/active 状态 |
| DELETE | `/v1/world/invites/{id}` | A 作废未兑换 invite |
| POST | `/v1/visits/redeem` | B 登录后兑换，单次绑定并进入 7d pending |
| GET | `/v1/visits` | 登录后恢复 pending/active/历史及 owner 待审批面 |
| POST | `/v1/visits/{id}/accept` | A 接受 pending，原子创建 30d active visit 与真人会话 |
| POST | `/v1/visits/{id}/reject` | A 拒绝 pending |
| POST | `/v1/visits/{id}/cancel` | B 取消 pending |
| POST | `/v1/visits/{id}/leave` | B 提前离开 |
| POST | `/v1/visits/{id}/revoke` | A 提前结束 active visit |
| GET | `/v1/visits/{id}/feed` | 只读 published Feed；不用任意 world_id |

### P5：真人聊天

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/human-conversations` | 当前参与者的会话列表与 active/read-only 状态 |
| GET | `/v1/human-conversations/{id}/messages` | 双方历史；终态后只读 |
| POST | `/v1/human-conversations/{id}/messages` | active visit 内发送 |
| POST | `/v1/human-conversations/{id}/read` | 更新当前参与者已读位置 |
| DELETE | `/v1/human-conversations/{id}/entry` | 仅隐藏自己的列表入口 |
| POST | `/v1/human-conversations/{id}/report` | 举报并保存 evidence snapshot |
| POST | `/v1/human-conversations/{id}/block` | 拉黑并终止双方 open visits |

## 6. 强事务与权限不变量

### 6.1 世界和居民

- `owner_platform_user_id` 唯一；重复 bootstrap 返回同一 world。
- 初始 confirm 幂等，最终 active 数量必须 1–10。
- 日常创建/来信接受在 world row lock 下校验 active `< 10`。
- 来信投递在同一口径下校验 active `< 8`。
- offline transition 不可由客户端请求触发。
- `origin=legacy` resident 永不 offline，App 不提供离开入口；该兼容豁免不构成主角色或永久置顶。
- 最后一个 active resident 的普通离开必须由数据库事务再次阻止，不能只在模型 prompt 中提醒。
- crisis/vulnerability freeze 和例外审核必须有审计记录。
- offline + farewell post + conversation read-only 是一个原子事务。

### 6.2 来访

- code 高熵、哈希存储、单次使用、限流，不允许自邀。
- invite 创建即确定固定 24 小时 `expires_at`；兑换永久 consumed，并创建独立 7 天 pending，不授予 Feed/chat ACL。
- A 接受 pending 时创建独立 30 天 active visit 与真人会话；invite、pending、active 三个绝对窗口都不续期。
- invite → pending visit 转换不得多占或释放 slot；终态转换必须释放 slot。
- 每次 Feed 读取和真人发送都校验同一个 visit。
- 到期、撤销、离开或拉黑用一个状态迁移同时关闭 Feed 和 send，并将真人会话转为只读。
- 访客 API 只返回 published posts 和访客可见 resident summary。
- 永不返回私聊、Memory、Prompt、草稿、隐藏/删除内容和内部审计字段。
- M5 响应使用 `Cache-Control: no-store`；客户端在 visit 终止时立即清除被访世界缓存和媒体临时文件，缓存永不作为 ACL。

### 6.3 多节点一致性

生产 PostgreSQL 下使用 `SELECT ... FOR UPDATE`、唯一约束和 advisory lock；SQLite 测试路径用等价事务语义。必须覆盖：

- 两次并发确认居民。
- 第 10/11 个居民竞争。
- 两次接受同一封来信。
- 两人同时兑换同一 code。
- 第 3/4 个 visit slot 竞争。
- 撤销与 Feed/发送并发。
- offline 与新 turn 并发。

## 7. 老用户迁移

### 7.1 基本策略

对每个已有 platform user：

1. 幂等创建一个 home universe。
2. 将该真人的全部 active account binding 分别映射为 `origin=legacy`、`status=active` 的 resident runtime；最早 binding 仅作为旧 `/chat/*` 的兼容锚点，不是主角色。
3. 保留其原 Soul、Profile、Session、Message、Memory 和 wallet，不复制历史。
4. 不写入主角色字段，也不永久置顶。
5. legacy resident 永不 offline，App 不提供离开入口；迁移不重放 onboarding，也不自动补初始预设居民。

### 7.2 新用户目标路径

为兼容旧客户端，auth 暂时仍可能创建一个默认 account。P1 初始确认时可将该 account 绑定给用户保留的第一个模板，其余模板创建无赠送权益的 resident runtime account。

长期更干净的路径是 auth 只创建 platform user/session，world confirm 才创建 runtime accounts；但这会改变现有 SessionResponse 和旧客户端假设，应在客户端最低版本门禁和数据迁移就绪后单独切换。

### 7.3 回滚与兼容

- 新表全部加性迁移，不重写原消息和 profile。
- legacy `/chat/*` 在过渡期继续指向 legacy primary resident。
- 新客户端只在 feature flag 开启后使用新 conversation API。
- 关闭 P1 flag 后，已有多居民数据不删除，只暂停新入口；legacy 单 Agent 仍可用。

## 8. 历史后端工作清单

> 本节冻结原 P0–P5 计划形态，不再表示未完成工作。后端 M0–M5 已合入 `main`；当前剩余的是生产 migration、对账、客户端接入和分阶段开 flag。

### P0：开始正式客户端架构前

- [ ] App auth DTO 移除 `invite_code` / `campaign_code`；不影响 Web/运营 referral。
- [ ] 扩展 `/app/config` feature flags。
- [ ] 统一 App error code、request id、server time。
- [ ] 设计并评审 world/resident OpenAPI 和迁移策略。
- [ ] 冻结 resident runtime 的 billing binding。
- [ ] 为新契约加入 SQLite + PostgreSQL 测试框架。

### P1：多居民最小闭环

- [ ] 新增 universes/templates/residents/conversations 与迁移。
- [ ] 运营可配置初始模板集合和版本。
- [ ] 幂等 bootstrap、候选整理和 1–10 人确认事务。
- [ ] 无赠送权益的 runtime account 创建。
- [ ] 显式 conversation history/turn，按 owner + resident 授权。
- [ ] 多节点 turn single-flight 和幂等约束。
- [ ] 老用户 primary account backfill。
- [ ] 跨 resident Soul/Memory/Session 不串线测试。

### P2：世界动态

- [ ] universe_posts、分页、发布/隐藏/删除。
- [ ] AI 动态生成调度、持久化、幂等、质量与审核。
- [ ] 私聊敏感信息不得进入发布面测试。
- [ ] 媒体存储和审核在文字版稳定后增量加入。

### P3：离开与信箱

- [ ] lifecycle event/cooldown/audit/safety freeze。
- [ ] 最后一位保护、唯一 farewell、offline 原子事务。
- [ ] mailbox letter eligibility、投递和接受事务。
- [ ] 管理端模板/来信配置和错误纠正审计。

### P4：邀请码与来访

- [ ] 高熵单次 code、hash、三 slot、绝对过期。
- [ ] visit ACL、只读 Feed、撤销/离开/到期。
- [ ] 跨用户、跨 world、旧缓存和深链越权测试。
- [ ] 过期清理 scheduler + 请求时实时门禁。

### P5：真人聊天

- [ ] 独立 human conversation/message 表和 API。
- [ ] 未读/轮询或实时投递、到期只读。
- [ ] 举报、拉黑、通知关闭和内容治理。
- [ ] 明确历史保留/删除和账号注销联动。

### 现有 App 发布基础仍需补齐

这些不是私人世界新增能力，但正式发布仍需要：

- [ ] App 内账号注销与数据删除。
- [ ] session token 哈希存储/轮换方案评审。
- [ ] staging、签名、CI、真实短信/Captcha/ASR 配置和告警。
- [ ] PostgreSQL 越权/并发/解绑后的 App 回归。

## 9. 测试门禁

### 契约

- App auth 不接受世界码、referral code 或 campaign code。
- 新接口不接受任意 `account_id` 来选择居民。
- 所有错误使用稳定 code，并返回 request id/server time。

### 隔离

- 同一用户两个 resident 的短期历史、聊天原文/检索、Soul、L1/L2 不串线；关于用户的 L3 沉淀记忆按 D-05 在同一 universe 全量共享。
- A 的 resident/account ID 不能被 B 调用。
- 访客只能看到 published Feed，不能看到 owner/AI 私聊或草稿。
- Human message 永不进入 AI message、prompt、dreaming 和 memory。

### 容量与生命周期

- 初始集合不能为 0；active 不能超过 10。
- `< 8` 才投递来信，接受时 `< 10`。
- 普通条件不能移除最后一位。
- 一次 departure 只生成一条 farewell。
- legacy resident 不进入 offline，且客户端无离开入口。

### 来访

- A 世界的 active invite + pending visit + active visit 总数不能超过 3；B 跨世界 pending + active 也不能超过 3。
- code 双花、自邀、过期、撤销均拒绝。
- invite 固定 24h；redeem 只建 7d pending，A accept 后才建独立 30d active visit，三个绝对窗口均不续期。
- pending 无 Feed/chat ACL；active 到期或其他终态后 Feed 和双方发送同时拒绝，客户端缓存立即清除且响应为 no-store。

### 双后端与迁移

- SQLite 聚焦测试和 PostgreSQL 真实事务测试都通过。
- backfill 可重复运行、不会重复建 world/resident/grant。
- 关闭 feature flag 可安全退回 legacy 单 Agent 路径。

## 10. 后续产品/运营待细化点

以下细化项不得重新打开已经冻结并实现的 D-05、D-08 与 M5 状态机：同世界 L3 用户沉淀记忆全量共享、legacy resident 永不 offline 且无客户端离开入口、24h invite → 7d pending → 30d active visit。

1. 初始官方模板的准确数量和版本策略。
2. 用户确认初始集合后，是否允许主动移除非 legacy 的 active resident；该操作必须与 AI 自主离开区分。
3. AI 世界动态的内容形态、生成频率、来源和运营审核方式。
4. mailbox 的投递时机、冷却、过期和待处理上限。
5. departure 的证据窗口、cooldown、危机 freeze 和人工纠错 SOP。
6. 真人历史的用户删除/隐藏体验与举报证据保留配置；visit 终止后默认长期只读保留已经冻结。

## 11. 客户端接入与发布顺序

```text
P0 契约/计费决策
  ↓
P1 world + resident + explicit AI conversation
  ↓
P2 persisted world feed
  ↓
P3 offline lifecycle + mailbox
  ↓
P4 invite + visit ACL
  ↓
P5 separated human chat
```

后端开发已经完成；客户端仍不应一次并行开放 P1–P5。按 schema/迁移与只读对账 → read/history → 各阶段 write 的顺序接入和开 flag，每一阶段都应能在没有下一阶段的情况下形成真实、完整且可回滚的体验。
