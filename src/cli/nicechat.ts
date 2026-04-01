import "dotenv/config";
import { pathToFileURL } from "node:url";
import { Command, CommanderError, Option } from "commander";
import packageJson from "../../package.json";
import {
  contactListQuerySchema,
  findOrCreateConversationSchema,
  patchContactSchema,
  presencePostBodySchema,
  sendContactRequestSchema,
  sendMessageBodySchema,
  userSearchQuerySchema,
} from "../lib/nicechat-schemas";
import {
  NiceChatClient,
  NiceChatClientError,
  type NiceChatMessageType,
} from "../lib/nicechat-client";
import {
  resolveNiceChatCliConfig,
  type NiceChatCliGlobalOptions,
} from "../lib/nicechat-cli-config";
import {
  maybeWarnAboutOutdatedNiceChatCli,
  type NiceChatCliUpdateNotifierFactory,
} from "../lib/nicechat-cli-update-notifier";
import { z } from "zod";

type FetchImpl = typeof fetch;

type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

type RunCliOptions = CliIo & {
  env?: NodeJS.ProcessEnv;
  fetch?: FetchImpl;
  readStdin?: () => Promise<string>;
  updateNotifierFactory?: NiceChatCliUpdateNotifierFactory;
};

type OutputOptions = NiceChatCliGlobalOptions & {
  compact?: boolean;
};

const messageTypeChoices: NiceChatMessageType[] = [
  "text",
  "image",
  "file",
  "system",
];

const csvUserIdsSchema = z
  .string({ message: "userIds 不能为空。" })
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .refine((value) => value.length > 0, { message: "userIds 不能为空。" })
  .refine((value) => value.length <= 50, {
    message: "一次最多查询 50 个 userId。",
  });

// 通过注入 fetch / env / stdio，CLI 既能真实运行，也能在测试里完全隔离外部依赖。
export async function runNiceChatCli(
  argv: string[],
  options: Partial<RunCliOptions> = {},
) {
  const io: CliIo = {
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
  };

  maybeWarnAboutOutdatedNiceChatCli({
    stderr: io.stderr,
    pkg: {
      name: packageJson.name,
      version: packageJson.version,
    },
    notifierFactory: options.updateNotifierFactory,
  });

  const program = buildNiceChatProgram({
    env: options.env ?? process.env,
    fetch: options.fetch ?? fetch,
    readStdin: options.readStdin,
    io,
  });

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed") {
        return 0;
      }

      writeJson(io.stderr, {
        ok: false,
        error: error.message,
        code: "COMMAND_USAGE_ERROR",
      });
      return error.exitCode || 1;
    }

    writeJson(io.stderr, formatCliError(error));
    return 1;
  }
}

// bin/nicechat 会显式调用这个入口，避免 CLI 被 import 时主模块检测短路。
export async function runNiceChatCliFromProcess(
  argv: string[] = process.argv.slice(2),
) {
  const exitCode = await runNiceChatCli(argv);
  process.exitCode = exitCode;
  return exitCode;
}

export function buildNiceChatProgram(options: {
  env: NodeJS.ProcessEnv;
  fetch: FetchImpl;
  readStdin?: () => Promise<string>;
  io: CliIo;
}) {
  const program = new Command();

  program
    .name("nicechat")
    .description("NiceChat terminal CLI for AI agents and developers")
    .version(packageJson.version)
    .allowExcessArguments(false)
    .configureOutput({
      writeOut: (str) => options.io.stdout.write(str),
      writeErr: (str) => options.io.stderr.write(str),
      outputError: () => undefined,
    })
    .exitOverride();

  addGlobalOptions(program);

  const users = program.command("users").description("Search NiceChat users");
  users
    .command("search")
    .description("Search users by name or email")
    .requiredOption("--q <query>", "Search query")
    .action(async function action(this: Command, values: { q: string }) {
      const parsed = userSearchQuerySchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.searchUsers(parsed),
      );
    });

  const contacts = program
    .command("contacts")
    .description("Manage contact relationships");
  contacts
    .command("list")
    .description("List contacts by status")
    .option("--status <status>", "accepted | pending | blocked", "accepted")
    .action(async function action(this: Command, values: { status: string }) {
      const parsed = contactListQuerySchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.listContacts(parsed),
      );
    });

  contacts
    .command("send")
    .description("Send a contact request")
    .requiredOption(
      "--addressee-id <userId>",
      "Better Auth user ID of the recipient",
    )
    .action(async function action(
      this: Command,
      values: { addresseeId: string },
    ) {
      const parsed = sendContactRequestSchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.sendContactRequest(parsed),
      );
    });

  contacts
    .command("get <contactId>")
    .description("Get a single contact record")
    .action(async function action(this: Command, contactId: string) {
      await runWithClient(this, options, (client) =>
        client.getContact(contactId),
      );
    });

  contacts
    .command("update <contactId>")
    .description("Accept or block a contact request")
    .requiredOption("--status <status>", "accepted | blocked")
    .action(async function action(
      this: Command,
      contactId: string,
      values: { status: "accepted" | "blocked" },
    ) {
      const parsed = patchContactSchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.updateContact(contactId, parsed),
      );
    });

  contacts
    .command("delete <contactId>")
    .description("Delete a contact relationship")
    .action(async function action(this: Command, contactId: string) {
      await runWithClient(this, options, (client) =>
        client.deleteContact(contactId),
      );
    });

  const conversations = program
    .command("conversations")
    .description("Manage direct conversations");

  conversations
    .command("list")
    .description("List visible conversations")
    .action(async function action(this: Command) {
      await runWithClient(this, options, (client) =>
        client.listConversations(),
      );
    });

  conversations
    .command("open")
    .description("Find or create a direct conversation")
    .requiredOption("--user-id <userId>", "The other participant user ID")
    .action(async function action(this: Command, values: { userId: string }) {
      const parsed = findOrCreateConversationSchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.openConversation(parsed),
      );
    });

  conversations
    .command("get <conversationId>")
    .description("Get conversation details")
    .action(async function action(this: Command, conversationId: string) {
      await runWithClient(this, options, (client) =>
        client.getConversation(conversationId),
      );
    });

  conversations
    .command("mute <conversationId>")
    .description("Mute or unmute a conversation")
    .addOption(new Option("--on", "Mute the conversation").conflicts("off"))
    .addOption(new Option("--off", "Unmute the conversation").conflicts("on"))
    .action(async function action(
      this: Command,
      conversationId: string,
      values: { on?: boolean; off?: boolean },
    ) {
      if (values.on === values.off) {
        throw new Error("请通过 --on 或 --off 指定静音状态。");
      }

      await runWithClient(this, options, (client) =>
        client.muteConversation(conversationId, {
          is_muted: Boolean(values.on),
        }),
      );
    });

  conversations
    .command("hide <conversationId>")
    .description("Hide a conversation from your list")
    .action(async function action(this: Command, conversationId: string) {
      await runWithClient(this, options, (client) =>
        client.hideConversation(conversationId),
      );
    });

  const messages = program
    .command("messages")
    .description("List and send messages");

  messages
    .command("list <conversationId>")
    .description("List messages in a conversation")
    .option("--before <createdAt>", "Cursor timestamp from previous page")
    .option("--limit <count>", "Page size, max 100")
    .action(async function action(
      this: Command,
      conversationId: string,
      values: { before?: string; limit?: string },
    ) {
      await runWithClient(this, options, (client) =>
        client.listMessages(conversationId, values),
      );
    });

  messages
    .command("send <conversationId>")
    .description("Send a message")
    .option(
      "--type <type>",
      `Message type: ${messageTypeChoices.join(" | ")}`,
      "text",
    )
    .option("--content <content>", "Text message content")
    .option("--media-url <url>", "Media URL for image/file messages")
    .option("--media-name <name>", "Media name for file messages")
    .option("--media-size <bytes>", "Media size in bytes")
    .option("--reply-to-id <messageId>", "Reply target message ID")
    .action(async function action(
      this: Command,
      conversationId: string,
      values: {
        type: NiceChatMessageType;
        content?: string;
        mediaUrl?: string;
        mediaName?: string;
        mediaSize?: string;
        replyToId?: string;
      },
    ) {
      const parsed = sendMessageBodySchema.parse({
        type: values.type,
        content: values.content,
        mediaUrl: values.mediaUrl,
        mediaName: values.mediaName,
        mediaSize: values.mediaSize ? Number(values.mediaSize) : undefined,
        replyToId: values.replyToId,
      });

      await runWithClient(this, options, (client) =>
        client.sendMessage(conversationId, parsed),
      );
    });

  messages
    .command("recall <conversationId> <messageId>")
    .description("Recall a message")
    .action(async function action(
      this: Command,
      conversationId: string,
      messageId: string,
    ) {
      await runWithClient(this, options, (client) =>
        client.recallMessage(conversationId, messageId),
      );
    });

  messages
    .command("read <conversationId>")
    .description("Mark a conversation as read")
    .action(async function action(this: Command, conversationId: string) {
      await runWithClient(this, options, (client) =>
        client.markConversationRead(conversationId),
      );
    });

  const notifications = program
    .command("notifications")
    .description("Notification summary helpers");
  notifications
    .command("summary")
    .description("Get pending contact and unread message counts")
    .action(async function action(this: Command) {
      await runWithClient(this, options, (client) =>
        client.getNotificationSummary(),
      );
    });

  const presence = program
    .command("presence")
    .description("Presence heartbeat and lookup");
  presence
    .command("set")
    .description("Update your own presence")
    .option("--status <status>", "online | away | offline")
    .action(async function action(this: Command, values: { status?: string }) {
      const parsed = presencePostBodySchema.parse(values);
      await runWithClient(this, options, (client) =>
        client.setPresence(parsed),
      );
    });

  presence
    .command("get")
    .description("Get presence for one or more users")
    .requiredOption("--user-ids <ids>", "Comma-separated Better Auth user IDs")
    .action(async function action(this: Command, values: { userIds: string }) {
      const userIds = csvUserIdsSchema.parse(values.userIds);
      await runWithClient(this, options, (client) =>
        client.getPresence(userIds),
      );
    });

  return program;
}

function addGlobalOptions(program: Command) {
  program
    .option("--api-key <key>", "NiceChat API key")
    .option("--api-key-stdin", "Read API key from stdin")
    .option("--timeout <ms>", "Request timeout in milliseconds")
    .option("--compact", "Print single-line JSON output");
}

async function runWithClient(
  command: Command,
  options: {
    env: NodeJS.ProcessEnv;
    fetch: FetchImpl;
    readStdin?: () => Promise<string>;
    io: CliIo;
  },
  callback: (client: NiceChatClient) => Promise<unknown>,
) {
  const globalOptions = command.optsWithGlobals<OutputOptions>();
  const config = await resolveNiceChatCliConfig(globalOptions, {
    env: options.env,
    readStdin: options.readStdin,
  });

  const client = new NiceChatClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    fetch: options.fetch,
  });

  const result = await callback(client);
  writeJson(options.io.stdout, result, {
    compact: Boolean(globalOptions.compact),
  });
}

function writeJson(
  stream: Pick<NodeJS.WriteStream, "write">,
  payload: unknown,
  options: { compact?: boolean } = {},
) {
  stream.write(
    `${JSON.stringify(payload, null, options.compact ? undefined : 2)}\n`,
  );
}

function formatCliError(error: unknown) {
  if (error instanceof NiceChatClientError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "命令参数无效。",
      code: "CLI_VALIDATION_ERROR",
      details: error.flatten(),
    };
  }

  return {
    ok: false,
    error: error instanceof Error ? error.message : "CLI 执行失败。",
    code: "CLI_RUNTIME_ERROR",
  };
}

const isMainModule =
  typeof process !== "undefined" &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void runNiceChatCliFromProcess();
}
