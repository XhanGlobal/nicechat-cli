# @xhanglobal/nicechat-cli

面向 AI 智能体与开发者的 NiceChat 命令行工具，用于管理联系人、会话与消息。

## 快速开始

```bash
npx @xhanglobal/nicechat-cli --help
```

## 配置

按优先级读取：命令行参数 `--api-key` → `--api-key-stdin` → 环境变量

```bash
export NICECHAT_API_KEY="sk-live-abc..."
export NICECHAT_BASE_URL="https://your-instance.example.com"  # 可选
```

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
