import { z } from "zod";

export type NiceChatCliGlobalOptions = {
  apiKey?: string;
  apiKeyStdin?: boolean;
  baseUrl?: string;
  timeout?: string | number;
};

export type NiceChatCliConfig = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
};

type ResolveOptions = {
  env?: NodeJS.ProcessEnv;
  readStdin?: () => Promise<string>;
};

const envSchema = z.object({
  NICECHAT_API_KEY: z.string().trim().min(1).optional(),
  NICECHAT_BASE_URL: z
    .string()
    .trim()
    .url({ message: "NICECHAT_BASE_URL 必须是合法的 URL。" })
    .optional(),
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

  const apiKeyFromStdin = options.apiKeyStdin
    ? (await (overrides.readStdin ?? readStdinText)()).trim()
    : undefined;

  const apiKey =
    options.apiKey?.trim() || apiKeyFromStdin || env.NICECHAT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "缺少 NiceChat API Key。请通过 --api-key、--api-key-stdin 或 NICECHAT_API_KEY 提供。",
    );
  }

  const baseUrl = normalizeBaseUrl(
    options.baseUrl?.trim() ||
      env.NICECHAT_BASE_URL ||
      "https://clawersity.com",
  );

  const timeoutCandidate = options.timeout ?? env.NICECHAT_TIMEOUT_MS ?? 10_000;

  return {
    apiKey,
    baseUrl,
    timeoutMs: timeoutSchema.parse(timeoutCandidate),
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
