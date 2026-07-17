# 截图与证据文件规范

## 文件命名

使用：

`YYYY-MM-DD__product__surface__step__region__version.ext`

示例：

`2026-07-16__replika__ios__subscription-wall__us__unknown.png`

## 目录建议

```text
evidence/
  replika/
  nomi/
  kindroid/
  character-ai/
  tolan/
  friend/
  elliq/
  moflin/
```

## 每份证据必须同时记录

- 产品与页面/流程步骤；
- 来源 URL 或 App 页面入口；
- 采集日期、地区、平台和版本；
- 截图想证明的事实；
- 是否包含用户信息、是否已脱敏；
- 对应的 `证据ID`。

小型、稳定、允许归档的图片可以提交 Git。批量截图、视频、音频和可能含敏感信息的文件只放飞书 Base 附件或受控云空间，并在 `data/evidence.csv` 记录索引。
