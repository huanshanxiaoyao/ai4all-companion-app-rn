# 朝夕相伴 React Native 客户端架构设计

> 状态：V0.2，后端 M0–M5 契约对齐，供客户端正式化评审  
> 日期：2026-07-24  
> 关联产品文档：[私人平行世界 PRD](../product/ai_companion_universe_prd.md)  
> 关联后端契约：[私人世界后端演进设计与客户端契约镜像](./private_world_backend_gap_analysis.md)

## 0. 结论

客户端继续使用 **React Native + Expo Prebuild + TypeScript**，不切换 Flutter，也不拆成两套原生工程。

当前仓库已经是 React Native：

- Expo `52.0.49`
- React Native `0.76.9`
- React `18.3.1`
- TypeScript `5.3.x`
- iOS / Android 共享业务代码，必要原生能力通过 Expo module 或 config plugin 接入

`app.json` 中的 `newArchEnabled: false` 只表示暂未开启 React Native 的 Fabric/TurboModules “New Architecture”，不表示项目没有使用 RN。首个正式多角色版本继续保持该值，避免在信息架构、后端契约和原生运行时三个维度同时迁移；Expo/RN 升级和 New Architecture 开启应作为独立技术任务验证。

当前可交互界面是视觉原型，不应直接扩写成生产代码。正式化过程要保留设计结果，但将导航、领域状态、API、缓存、权限和页面拆开。

## 1. 现状与主要问题

### 1.1 可以保留的基础

- 手机号 + Captcha + OTP 登录链路已接入真实 `/api/v1/*`。
- access token 已使用 `expo-secure-store` 保存。
- 单 Agent 历史、文字 turn、幂等重试和批量 ASR 已形成可运行闭环。
- 配套后端 Companion World M0–M5 已实现并通过双数据库测试，但相关 feature flag 默认关闭，RN 客户端尚未完成正式接入。
- API base URL、品牌色和本地/生产环境已有基础配置。
- iOS Simulator 与 Mate 60 真机均已运行视觉原型。
- 视觉原型通过 `EXPO_PUBLIC_UI_PREVIEW=1` 与真实数据路径隔离。

### 1.2 正式化前需要解决的问题

| 现状 | 风险 | 正式方案 |
| --- | --- | --- |
| `App.tsx` 用字符串手写 `boot/login/chat/settings` 路由 | 三 Tab、详情页、返回栈和深链会快速失控 | 使用正式导航容器和类型化路由参数 |
| `CompanionPrototype.tsx` 同时包含数据、页面、图标和交互 | 无法测试、复用或接真实 API | 按 feature 和 shared UI 拆分 |
| 页面直接调用全局 `api` 并自己管理 loading/error | 多列表刷新、分页、失效和竞态口径不一致 | 统一 server-state 查询层与 mutation |
| 所有 DTO 放在单个 `types.ts` | 多领域后容易命名冲突和契约漂移 | DTO 按 API 领域组织，领域模型与传输模型分离 |
| 当前正式客户端只接 legacy 单 Agent `/chat/*` | 尚未消费后端已实现的居民、真人会话和只读状态 | 统一 Conversation 读模型，AI/Human 写链路分开，按 flag 渐进接入 World API |
| 原型使用本地假居民、动态和来信 | 误入正式包会伪造关系事件 | 编译期原型开关 + 服务端 feature gate 双层隔离 |

## 2. 架构原则

1. **服务端是关系事实来源**：居民是否在场、是否离开、来信是否可接受、来访是否有效，都不能由客户端随机或单独决定。
2. **认证与世界访问分离**：登录只恢复自己的身份；pending/active/历史来访在登录后单独拉取，不能进入 auth DTO。
3. **领域隔离**：AI 会话、真人会话、世界动态、来访和信箱可以共享 UI 基础件，但不能共享错误的写入链路。
4. **默认回到自己的世界**：重启或重新登录后 `activeWorld` 默认 home；有效来访不会替换 home。
5. **最小长期缓存**：token 安全保存；M5 响应遵循 `Cache-Control: no-store`，好友世界动态只保留内存缓存，visit 终止后立即清除。
6. **功能开关先于入口**：后端能力已实现但 flag 未开启或客户端未兼容时，正式客户端不展示能产生虚假成功的入口。
7. **渐进迁移**：后端 M0–M5 已完成；客户端先重构现有单 Agent 闭环而不改变行为，再逐阶段接 P1–P5。

## 3. 目标分层

```text
AppRoot
├── Providers
│   ├── SessionProvider
│   ├── QueryProvider
│   ├── ThemeProvider
│   └── Accessibility / Telemetry
├── RootNavigator
│   ├── AuthStack
│   ├── WorldOnboardingStack
│   ├── MainTabs
│   │   ├── ConversationStack
│   │   ├── WorldStack
│   │   └── ProfileStack
│   └── AppModalStack
├── Feature modules
│   ├── auth / onboarding / residents / conversations / chat
│   ├── world-feed / mailbox / visits / human-chat / profile
│   └── feature-gates
└── Shared infrastructure
    ├── api / storage / design-system / icons
    ├── errors / time / idempotency / logging
    └── testing
```

依赖方向固定为：`app → features → entities/shared`。`shared` 不反向 import 具体 feature；feature 之间通过领域 ID、导航参数或公开 hook 交互，不读取彼此内部 state。

## 4. 推荐目录

```text
src/
  app/
    AppRoot.tsx
    providers/
    navigation/
      RootNavigator.tsx
      routeTypes.ts
      linking.ts
    bootstrap/
  features/
    auth/
    world-onboarding/
    residents/
    conversations/
    ai-chat/
    human-chat/
    world-feed/
    mailbox/
    visits/
    profile/
  entities/
    session/
    world/
    resident/
    conversation/
    post/
    visit/
  shared/
    api/
      httpClient.ts
      errors.ts
      queryKeys.ts
    config/
    design-system/
      theme/
      components/
      icons/
    storage/
    telemetry/
    utils/
  prototype/
    CompanionPrototype.tsx
```

原型目录继续存在，但只允许从显式预览入口加载。正式页面不 import 原型假数据。

## 5. 启动与导航

### 5.1 启动状态机

```text
booting
  ├─ 无 token → unauthenticated
  └─ 有 token → restoring_session
                  ├─ 401 → unauthenticated
                  ├─ 网络失败 + 有安全的本地摘要 → degraded_authenticated
                  └─ 成功 → fetching_bootstrap
                               ├─ world onboarding 未完成 → world_onboarding
                               └─ 已完成 → ready
```

`is_new_user` 只能辅助首登体验，不能长期决定世界引导。权威条件应来自服务端 home world 的 `onboarding_state`，这样老账号升级、跨设备和中断恢复才一致。

### 5.2 导航结构

- `AuthStack`：手机号、OTP、协议和 Captcha。
- `WorldOnboardingStack`：初始居民集合、角色预览、轻量创建、确认。
- `MainTabs`：三个纯图标 Tab，不显示持久文字标签。
- `ConversationStack`：会话列表 → AI chat / Human chat → 角色或访客资料。
- `WorldStack`：自己的世界动态、好友世界只读动态、动态详情/发布。
- `ProfileStack`：我的、居民管理、信箱、邀请码、穿越入口、设置。
- `AppModalStack`：邀请时长、确认、举报、媒体预览等跨 Tab modal。

建议引入 React Navigation 的 native stack + bottom tabs，并为所有 route params 建立 TypeScript 类型。最终自定义底栏只复用导航状态，不自己模拟历史栈。

Android 系统返回规则：

- 详情页返回上一级。
- 好友世界动态返回“我的”中的来访入口或自己的世界，不退出 App。
- MainTabs 根页面再次返回时遵循 Android 系统退出语义。
- 邀请码、过期访问和原型深链都必须经过当前权限重新校验。

## 6. 状态划分

### 6.1 安全持久状态

仅存储：

- access token / session metadata：SecureStore。
- 非敏感偏好：是否看过 Tab 说明、减少动效的 App 内补充偏好等，可用 AsyncStorage。

不得持久化：

- 好友世界完整 Feed。
- 邀请码明文。
- AI 私聊或真人聊天全文镜像。
- 角色私密 prompt、内部离开原因或审计信息。

### 6.2 Server state

建议使用 TanStack Query 管理服务端状态，不用 Redux 存 API 副本。核心 query key：

```text
['app-config']
['bootstrap']
['home-world']
['residents', worldId]
['conversations']
['messages', conversationId]
['world-feed', worldIdOrVisitId]
['mailbox']
['visits']
['invites']
```

Mutation 成功后只失效受影响的 key。例如接受来信应失效 `mailbox/residents/conversations/home-world`，不能粗暴清空所有缓存。

### 6.3 本地 UI state

表单内容、当前 Tab、展开状态、录音状态使用组件 state/reducer。首阶段不引入 Redux/Zustand；只有跨多个无父子关系页面的复杂客户端工作流出现后再评估。

`activeWorld` 是短生命周期上下文：

```ts
type ActiveWorldContext =
  | { mode: 'home'; worldId: string }
  | { mode: 'visit'; visitId: string; worldId: string; expiresAt: string };
```

重新登录默认重置为 `home`。来访模式每次前后台切换都重新校验服务端状态。

## 7. API 与领域模型

### 7.1 HTTP 层

统一 `httpClient` 负责：

- `/api/v1` base URL。
- Bearer token 注入。
- timeout、AbortController 和 JSON/empty response 解析。
- 稳定错误码映射，不用服务端中文 `detail` 作为程序分支。
- 401 统一触发 session 失效。
- `request_id` 记录到非正文日志。
- mutation idempotency key。

### 7.2 DTO 与领域模型分离

后端 DTO 使用 snake_case，组件只消费经过 mapper 的领域模型。时间统一解析为 ISO 字符串/时间对象，不在各页面重复计算。

例如会话统一读模型：

```ts
type ConversationSummary = {
  id: string;
  kind: 'ai' | 'human';
  title: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  state: 'active' | 'read_only';
  readOnlyReason?: 'resident_offline' | 'visit_ended';
  canSend: boolean;
  expiresAt?: string;
};
```

列表可以统一渲染，但发送必须分开：

- AI turn → AI conversation endpoint，进入 LLM、角色记忆与审核。
- Human message → human conversation endpoint，绝不进入 LLM、AI Memory 或 Soul。

### 7.3 契约治理

- FastAPI OpenAPI 是后端契约来源。
- 客户端保留一份经过评审的 OpenAPI snapshot，在 CI 检查 breaking change。
- 初期可手写 DTO；接口数量稳定后再生成 TypeScript 类型，不能让生成类型直接替代领域模型。
- 每个新 feature 在 UI 开发前先有：接口、错误码、权限矩阵、幂等语义和契约测试。

## 8. 设计系统

将原型中的 `PALETTE` 和散落 StyleSheet 抽成 token：

- color：background/surface/ink/muted/accent/border/danger。
- typography：display/title/body/caption，支持系统字体缩放。
- spacing：4/8/12/16/24/32。
- radius：卡片、输入框、头像和按钮语义化。
- motion：150–300ms，自然缓动，尊重 reduce motion。
- elevation：iOS shadow 与 Android elevation 由同一组件封装。

最终三个 Tab 图标使用 `react-native-svg` 的同一套矢量路径，保证 24pt、线宽、圆头和非颜色选中态一致。原型中的 View 拼图可继续用于验证，但不作为最终资产。

共享组件优先覆盖：`Screen`、`Header`、`PaperCard`、`Avatar`、`ListRow`、`StateView`、`InlineError`、`PrimaryButton`、`Composer`、`BottomTabBar`。

## 9. 聊天与实时性

P1 继续使用同步 HTTP turn，不为多角色同时引入 WebSocket。每个发送请求携带稳定的 `client_message_id`，客户端乐观消息状态为：

```text
draft → sending → persisted
                └→ failed → retry(same client_message_id)
```

超时后先用同一 id 重试/回拉历史，不能生成新 id 导致重复回复。

会话页必须由 `conversation_id` 打开，不能只传角色展示信息。服务端返回的 `can_send` 和状态是最终门禁；客户端即使缓存仍显示 active，服务端也必须拒绝给 offline 居民或过期访客发送。

真人聊天的实时收取首版可使用前台轮询 + AppState 恢复刷新；是否上 WebSocket/SSE/Push 在 P5 单独评审，不提前污染 AI turn 链路。

## 10. 来访、倒计时与缓存

- 分别展示固定 24h invite、兑换后 7d pending、主人接受后 30d active visit 的绝对到期；三段不继承、不续期。
- pending 只进入来访管理状态，不写入 `activeWorld`，不预取好友 Feed，也不创建本地真人会话入口；收到 owner accept 后才进入 active 流程。
- 剩余时间由当前阶段的服务端 `expires_at + server_time_offset` 计算，设备时间只用于显示，不作为授权依据。
- 进入前台、网络恢复、发送消息和刷新好友 Feed 时重新校准。
- 所有 M5 响应按 `Cache-Control: no-store` 处理，不把 Query cache 或已下载媒体当作离线授权。
- 服务端返回 expired/revoked/left/blocked 等终态后，立即：
  - 将真人会话切为 read-only；
  - 从 Query cache 删除该 visit 的 Feed；
  - 清理已下载的好友世界临时媒体；
  - 将 active world 切回 home。
- 不提供通过旧深链、旧截图缓存或本地倒计时绕过权限的路径。

## 11. Feature gate

`GET /api/v1/app/config` 应逐步增加：

```text
features.resident_world
features.world_feed
features.resident_lifecycle
features.mailbox
features.world_visits
features.human_chat
```

规则：

- 编译期开关只用于开发/视觉原型。
- 正式能力由服务端 flag + bootstrap capability 共同决定。
- 入口、深链和 mutation 三处都检查，不能只隐藏按钮。
- gate 关闭后仍允许展示合法的只读历史，但不能继续写入。

## 12. 测试与观测

### 12.1 测试层级

- 单元：mapper、倒计时、错误码、query invalidation、幂等 ID。
- 组件：三 Tab 无障碍、居民上限、只读 composer、离别动态、来信状态。
- API integration：Mock Server 按真实 OpenAPI 响应，覆盖 401/409/410/429/5xx。
- E2E：登录、初始居民确认、两个 AI 会话不串线、Feed、来信接受、来访到期。
- 真机矩阵：至少 iOS 两档、华为/小米/标准 Android 三类，覆盖字体、键盘、安全区、录音和后台恢复。

### 12.2 观测边界

可记录：页面、请求类别、耗时、错误码、request id、crash、是否命中 feature gate。  
不可记录：手机号明文、token、聊天正文、转写正文、角色私密 prompt、邀请码、好友 Feed 正文。

## 13. 分阶段落地

### M0：架构底座，不改变现有功能

1. 引入正式导航和类型化 route。
2. 抽 design token、shared components、HTTP client 和 session provider。
3. 引入 QueryProvider，把现有 config/history/me 迁移为 hooks。
4. 保持当前单 Agent 登录、聊天和设置行为全绿。
5. 原型继续由 `EXPO_PUBLIC_UI_PREVIEW=1` 隔离。

### M1：三 Tab 正式壳 + P1 居民

1. 接 home bootstrap、初始居民、居民列表和会话列表。
2. 将现有 Agent 映射为普通居民，不保留主角色概念。
3. AI chat 改为显式 `conversation_id`。
4. 后端 gate 关闭时只展示真实单 Agent，不展示假居民。

### M2：世界动态

接分页 Feed、用户文字发布、AI 持久化动态、隐藏/删除和从动态进入私聊。

### M3：生命周期与信箱

接非 legacy resident 的 offline 只读、唯一离别动态、信箱列表和接受/拒绝事务；legacy resident 永不 offline 且不显示离开入口。客户端不参与离开判断。

### M4：限时来访

接固定 24h 邀请码、7d pending 的主人接受/拒绝与访客取消、接受后 30d active visit、A 世界三 slot 与 B 跨世界 `pending + active ≤ 3`、好友世界只读、server-time 倒计时、no-store 和终态缓存清理。

### M5：真人聊天

接独立消息链路、到期禁发、只读历史、举报/拉黑和通知策略。

## 14. 建议新增依赖

仅在 M0 增加：

- React Navigation：root stack、native stack、bottom tabs。
- `react-native-svg`：正式 Tab 图标和少量矢量资产。
- TanStack Query：服务端状态、分页、mutation 与失效。
- AsyncStorage：少量非敏感 UI 偏好。

使用 `npx expo install` 选择与当前 Expo SDK 兼容的原生依赖版本。首阶段不引入 Redux、Zustand、复杂 DI 框架或本地数据库。

## 15. 架构验收

- 正式 App 保持 RN 单代码库，iOS/Android 共享领域与页面逻辑。
- 未开启后端能力不会在正式路径产生假成功或假关系状态。
- 三个 Tab 有真实导航栈、Android 返回语义和无障碍状态。
- AI/Human 两类消息读模型可统一，写链路严格分离。
- 用户、世界、居民、会话 ID 在路由和 API 中明确，不以展示名作为业务键。
- 好友世界访问到期后，Feed、媒体缓存和发送能力同时失效。
- 每阶段可独立发布和回滚，不要求 P1–P5 一次完成。
