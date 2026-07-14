# 朝夕相伴（AI4ALL Companion）

“朝夕相伴”是 AI4ALL 的 React Native 双端客户端。V1 已打通手机号注册/登录、文字聊天，以及“录音 → 语音转文字 → 编辑后发送”的最小闭环；AI 在 V1 只回复文字。

产品范围与验收标准见 [V1 PRD](docs/product/ai_companion_app_v1_prd.md)。后端位于相邻仓库 `../weixin_bot`。

## 当前状态

- Expo SDK 52、React Native 0.76.9、TypeScript、Prebuild 工作流。
- iOS Release Simulator 已构建、安装并启动验证。
- Android `v0.1.1`（versionCode 4）Release APK 已构建并通过签名/包信息校验，且已在 Android 实体机完成安装和手机号登录验证。
- RN 类型检查和 6 个单元测试已通过。
- App API 的认证、建号、聊天、幂等、历史、ASR、退出登录真实 HTTP 冒烟已通过。

## V1 功能

- `+86` 手机号注册/登录合一，支持阿里云验证码 WebView 和短信 OTP。
- 30 天 App Session，凭证保存在 Keychain/Keystore；支持启动恢复和服务端退出撤销。
- App 独立聊天 scope、历史分页、乐观发送、幂等重试及 401/409/429/超时恢复。
- 录音、取消、60 秒自动停止、批量 ASR、转写回填和本地临时音频清理。
- 设置页、脱敏手机号、协议入口和退出登录。

V1 不包含实时语音、AI 语音回复、多会话、图片/文件、推送和付费。实时语音通话属于 V2。

## 环境要求

- Node.js 18 或 20、npm。
- iOS：Xcode 15.4、CocoaPods；真机包还需要 Apple Developer Team 和发布签名。
- Android：Android Studio/JDK 17+、Android SDK Platform 34 或 35、Build Tools 35、NDK `26.1.10909125`、CMake `3.22.1`。
- Python 后端依赖需包含 `python-multipart==0.0.20`。

## 安装与生成原生工程

```bash
npm ci
cp .env.example .env
npm run prebuild
```

`ios/`、`android/` 是 Expo Prebuild 生成目录，当前不纳入版本控制。修改 `app.json` 或原生依赖后，用 `npm run prebuild` 重建；需要彻底重建时可用 `npx expo prebuild --clean`，但先确认没有需要保留的本地原生改动。

iOS 首次构建还需安装 Pods：

```bash
cd ios
pod install
```

## API 地址

通过 `EXPO_PUBLIC_API_BASE_URL` 注入完整 `/api/v1` 前缀：

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8180/api/v1 npm run ios
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8180/api/v1 npm run android
```

- iOS Simulator 访问宿主机使用 `127.0.0.1`。
- Android Emulator 访问宿主机使用 `10.0.2.2`。
- 真机必须使用同一局域网内可访问的电脑 IP，且后端监听 `0.0.0.0`；稳定内测应改用 HTTPS staging 地址。
- 未显式设置时，客户端默认使用端口 `8180` 的上述模拟器地址。
- 不要把 ASR、短信、LLM 或其他服务端密钥写入 `.env`；`EXPO_PUBLIC_*` 会进入客户端 bundle。

后端使用 `../weixin_bot/.env` 中的既有配置启动，例如：

```bash
cd ../weixin_bot
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8180
```

真机联调时把 `--host` 改为 `0.0.0.0`，并仅在可信局域网使用；生产部署必须走 HTTPS 和反向代理。

### Android 实体机连接 loopback 测试后端

如果隔离后端只监听 `127.0.0.1`，可在可信 Wi-Fi 内使用仓库提供的临时 TCP 转发器。假设后端监听 `8182`、电脑局域网 IP 为 `<LAN_IP>`：

```bash
../weixin_bot/.venv/bin/python scripts/lan_test_proxy.py \
  --listen-host 0.0.0.0 \
  --listen-port 8183 \
  --target-host 127.0.0.1 \
  --target-port 8182
```

另开终端构建实体机包：

```bash
NODE_ENV=production \
EXPO_PUBLIC_API_BASE_URL=http://<LAN_IP>:8183/api/v1 \
./android/gradlew -p android assembleRelease -Pandroid.compileSdkVersion=34
```

需要让手机直接下载时，可临时启动静态文件服务：

```bash
python -m http.server 8198 --bind 0.0.0.0 --directory dist
```

然后用手机访问 `http://<LAN_IP>:8198/<APK 文件名>`。该方式是无 TLS 的临时内测方案：电脑和手机必须在可信的同一 Wi-Fi，测试结束后立即停止 TCP 转发器和文件服务；不要用于公网或生产数据。

## 开发与测试

```bash
npm run typecheck
npm test
npm exec expo install -- --check
```

后端运行后可执行真实 HTTP 冒烟：

```bash
python scripts/smoke_app_api.py \
  --base-url http://127.0.0.1:8182/api/v1 \
  --database /tmp/ai4all-app-v1-e2e.sqlite3
```

该脚本会创建临时手机号账号并检查认证、聊天幂等、历史、ASR 和退出；应只对隔离测试数据库运行。若使用 `ASR_MOCK_TRANSCRIPT`，不要把它配置到生产环境。

## Release 构建

iOS Simulator：

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8180/api/v1 \
npx expo run:ios --configuration Release
```

Android 内测 APK（下面是本机已验证通过的 API 34 构建方式）：

```bash
NODE_ENV=production \
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8180/api/v1 \
./android/gradlew -p android assembleRelease -Pandroid.compileSdkVersion=34
```

如果 Google Maven 在当前网络不可用，可启用仓库内的阿里云镜像初始化脚本：

```bash
NODE_ENV=production \
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8180/api/v1 \
./android/gradlew -p android \
  -I "$PWD/scripts/gradle-cn.init.gradle" \
  assembleRelease -Pandroid.compileSdkVersion=34
```

APK 输出位置：`android/app/build/outputs/apk/release/app-release.apk`。

当前生成的 APK 使用 Android Debug 证书签名，仅用于受控内测侧载。公开分发前必须配置独立 release keystore，并由 CI/安全存储管理密码和证书。局域网 HTTP 测试由 `withAndroidCleartextTraffic` 配置插件临时放行；切换到 HTTPS 生产地址时必须把插件的 `enabled` 设为 `false`。

## 后端接口

客户端只依赖版本化 App API，不应调用 `/web/*`、微信 Bridge 或 OpenClaw 内部接口：

- `GET /api/v1/app/config`
- `POST /api/v1/auth/otp/send`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/session`
- `DELETE /api/v1/auth/session/current`
- `GET /api/v1/me`
- `GET /api/v1/chat/messages`
- `POST /api/v1/chat/turn`
- `POST /api/v1/audio/transcriptions`

## 受控内测前仍需完成

- 部署可由手机访问的 HTTPS staging App API，并放行 `/api/v1/*`。
- 确认真实 ASR provider，配置 `ASR_BASE_URL`、`ASR_API_KEY`、`ASR_MODEL`，完成普通话/方言/噪声样本测试。
- 用真实阿里云短信与验证码配置在 iOS、主流国内 Android 真机完成登录主链路。
- 准备专用用户协议、隐私政策 URL；当前入口暂指向官网。
- 若公开上架，补账号注销、正式签名、开发者账号、隐私清单、监控告警和商店素材。
- Android 真机验证录音权限、后台/来电中断和厂商 ROM 兼容性。
