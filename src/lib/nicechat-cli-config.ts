import { z } from "zod";
import {
  readNiceChatCliAuthStore,
  type NiceChatCliStoredAuth,
} from "./nicechat-cli-auth-store";

const NICECHAT_CLI_BASE_URL = "https://clawersity.hanshi.tech";

export type NiceChatCliGlobalOptions = {
  apiKey?: string;
  apiKeyStdin?: boolean;
  accessToken?: string;
  baseUrl?: string;
  timeout?: string | number;
};

export type NiceChatCliConfig = {
  apiKey?: string;
  accessToken?: string;
  baseUrl: string;
  timeoutMs: number;
  authSource: "bearer" | "api-key";
};

type ResolveOptions = {
  env?: NodeJS.ProcessEnv;
  readStdin?: () => Promise<string>;
  storedAuth?: NiceChatCliStoredAuth | null;
};

const envSchema = z.object({
  NICECHAT_API_KEY: z.string().trim().min(1).optional(),
  NICECHAT_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  NICECHAT_BASE_URL: z.string().trim().url().optional(),
  NICECHAT_TIMEOUT_MS: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: "NICECHAT_TIMEOUT_MS 必须是正整数毫秒值。" })
    .optional(),
});

const timeoutSchema = z.coerce
  .number({ message: "timeout 必须是数字毫秒值。" })
  .int({ message: "timeout 必须是整数毫秒值。" })
  .positive({ message: "timeout 必须大于 0。" })
  .max(60_000, { message: "timeout 不能超过 60000ms。" });

// CLI 配置统一在这里解析，保证命令层不直接碰 process.env，测试也能注入假环境。
export async function resolveNiceChatCliConfig(
  options: NiceChatCliGlobalOptions,
  overrides: ResolveOptions = {},
): Promise<NiceChatCliConfig> {
  const env = envSchema.parse(overrides.env ?? process.env);
  const storedAuth = overrides.storedAuth ?? (await readNiceChatCliAuthStore());

  const apiKeyFromStdin = options.apiKeyStdin
    ? (await (overrides.readStdin ?? readStdinText)()).trim()
    : undefined;

  const accessToken =
    options.accessToken?.trim() ||
    env.NICECHAT_ACCESS_TOKEN ||
    storedAuth?.accessToken;

  const apiKey =
    options.apiKey?.trim() || apiKeyFromStdin || env.NICECHAT_API_KEY;

  if (!accessToken && !apiKey) {
    throw new Error(
      "缺少 NiceChat 认证信息。请先运行 `nicechat auth login`，或通过 --api-key、--api-key-stdin、NICECHAT_API_KEY 提供 API Key。",
    );
  }

  const baseUrl = normalizeBaseUrl(
    options.baseUrl?.trim() || env.NICECHAT_BASE_URL || NICECHAT_CLI_BASE_URL,
  );

  const timeoutCandidate = options.timeout ?? env.NICECHAT_TIMEOUT_MS ?? 10_000;

  return {
    apiKey,
    accessToken,
    baseUrl,
    timeoutMs: timeoutSchema.parse(timeoutCandidate),
    authSource: accessToken ? "bearer" : "api-key",
  };
}

async function readStdinText() {
  const chunks: string[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  }

  return chunks.join("");
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}
