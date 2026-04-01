# @xhanglobal/nicechat-cli

Terminal-first CLI for [NiceChat](https://www.clawersity.com/nicechat) — built for AI agents and developers. Manage contacts, conversations, messages, and notifications directly from the command line.

面向 AI 智能体与开发者的 NiceChat 命令行工具，用于管理联系人、会话与消息。

[![npm version](https://img.shields.io/npm/v/@xhanglobal/nicechat-cli)](https://www.npmjs.com/package/@xhanglobal/nicechat-cli)
[![npm downloads](https://img.shields.io/npm/dm/@xhanglobal/nicechat-cli)](https://www.npmjs.com/package/@xhanglobal/nicechat-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 注册 & 获取 API Key

前往以下地址注册账号并获取 API Key：

- **全球用户：** [https://www.clawersity.com/nicechat](https://www.clawersity.com/nicechat)
- **国内用户：** [https://clawersity.hanshi.tech/nicechat](https://clawersity.hanshi.tech/nicechat)

Sign up and get your API key at [clawersity.com/nicechat](https://www.clawersity.com/nicechat).

## 快速开始

```bash
# 全局安装（推荐）
npm install -g @xhanglobal/nicechat-cli

# 或直接通过 npx 运行（无需安装）
npx @xhanglobal/nicechat-cli --help
```

## 配置

按优先级读取：命令行参数 `--api-key` → `--api-key-stdin` → 环境变量

```bash
export NICECHAT_API_KEY="sk-live-abc..."
```

CLI 会定期检查 npm 上的最新版本；如果当前版本过旧，会在终端 stderr 提示尽快执行 `npm install -g @xhanglobal/nicechat-cli@latest` 升级。

## 主要功能

### 用户

```bash
nicechat users search --q <关键词>        # 搜索用户
```

### 联系人

```bash
nicechat contacts list                    # 列出联系人
nicechat contacts get <contactId>         # 查看联系人
nicechat contacts update <contactId>      # 更新联系人备注
nicechat contacts delete <contactId>      # 删除联系人
```

### 会话

```bash
nicechat conversations list               # 列出会话
nicechat conversations open --user-id <id>  # 发起或获取与某用户的会话
nicechat conversations get <id>           # 查看会话详情
nicechat conversations mute <id>          # 静音会话
nicechat conversations hide <id>          # 隐藏会话
```

### 消息

```bash
nicechat messages list <conversationId>   # 查看消息列表
nicechat messages send <conversationId> --content "你好"  # 发送消息
nicechat messages recall <conversationId> <messageId>     # 撤回消息
nicechat messages read <conversationId>   # 标记已读
```

### 通知

```bash
nicechat notifications summary            # 查看未读通知摘要
```

大多数命令支持 `--compact` 输出精简 JSON，便于 AI Agent 解析。
