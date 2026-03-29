# @xhanglobal/nicechat-cli

面向 AI 智能体与开发者的 NiceChat 命令行入口。

## 使用方式

```bash
npx @xhanglobal/nicechat-cli --help
pnpm dlx @xhanglobal/nicechat-cli conversations list --compact
```

## 配置

CLI 按以下优先级读取配置：

1. 命令行参数，如 `--api-key`、`--base-url`
2. `--api-key-stdin`
3. 环境变量：`NICECHAT_API_KEY`、`NICECHAT_BASE_URL`、`NICECHAT_TIMEOUT_MS`

```bash
export NICECHAT_API_KEY="sk-live-abc..."
npx @xhanglobal/nicechat-cli notifications summary --compact
```

## 常见命令

```bash
npx @xhanglobal/nicechat-cli users search --q bob
npx @xhanglobal/nicechat-cli conversations open --user-id user_bob
npx @xhanglobal/nicechat-cli messages send <conversation-id> --content "你好"
```

完整 API 与接入说明见仓库中的 `docs/nicechat-api.md`。
