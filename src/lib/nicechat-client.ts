import {
  contactListQuerySchema,
  findOrCreateConversationSchema,
  MAX_MESSAGE_PAGE_LIMIT,
  messageListQuerySchema,
  patchContactSchema,
  patchConversationParticipantSchema,
  presencePostBodySchema,
  sendContactRequestSchema,
  sendMessageBodySchema,
  userSearchQuerySchema,
} from "./nicechat-schemas";
import { z } from "zod";

type FetchImpl = typeof fetch;

type QueryValue = string | number | boolean | null | undefined;

type RequestOptions = {
  query?: Record<string, QueryValue>;
  body?: unknown;
};

type ErrorResponseBody = {
  ok?: boolean;
  error?: string;
  code?: string;
};

export class NiceChatClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { code: string; status?: number; details?: unknown },
  ) {
    super(message);
    this.name = "NiceChatClientError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type NiceChatClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetch?: FetchImpl;
  userAgent?: string;
};

export type NiceChatMessageType = z.infer<typeof sendMessageBodySchema>["type"];
export type NiceChatContactStatus = z.infer<
  typeof contactListQuerySchema
>["status"];
export type NiceChatPresenceStatus = z.infer<
  typeof presencePostBodySchema
>["status"];

// CLI 通过这个极薄的 HTTP client 调用现有 NiceChat REST API，
// 这样既能复用 schema，又不会把 Next.js route handler 强耦合到终端环境。
export class NiceChatClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchImpl;
  private readonly userAgent: string;

  constructor(options: NiceChatClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetch ?? fetch;
    this.userAgent = options.userAgent ?? "nicechat-cli/0.1.0";
  }

  searchUsers(params: z.input<typeof userSearchQuerySchema>) {
    const query = userSearchQuerySchema.parse(params);
    return this.requestJson("GET", "/api/nicechat/users/search", { query });
  }

  listContacts(params: Partial<z.input<typeof contactListQuerySchema>> = {}) {
    const query = contactListQuerySchema.parse(params);
    return this.requestJson("GET", "/api/nicechat/contacts", { query });
  }

  sendContactRequest(body: z.input<typeof sendContactRequestSchema>) {
    return this.requestJson("POST", "/api/nicechat/contacts", {
      body: sendContactRequestSchema.parse(body),
    });
  }

  getContact(contactId: string) {
    return this.requestJson("GET", `/api/nicechat/contacts/${contactId}`);
  }

  updateContact(contactId: string, body: z.input<typeof patchContactSchema>) {
    return this.requestJson("PATCH", `/api/nicechat/contacts/${contactId}`, {
      body: patchContactSchema.parse(body),
    });
  }

  deleteContact(contactId: string) {
    return this.requestJson("DELETE", `/api/nicechat/contacts/${contactId}`);
  }

  listConversations() {
    return this.requestJson("GET", "/api/nicechat/conversations");
  }

  openConversation(body: z.input<typeof findOrCreateConversationSchema>) {
    return this.requestJson("POST", "/api/nicechat/conversations", {
      body: findOrCreateConversationSchema.parse(body),
    });
  }

  getConversation(conversationId: string) {
    return this.requestJson(
      "GET",
      `/api/nicechat/conversations/${conversationId}`,
    );
  }

  muteConversation(
    conversationId: string,
    body: z.input<typeof patchConversationParticipantSchema>,
  ) {
    return this.requestJson(
      "PATCH",
      `/api/nicechat/conversations/${conversationId}`,
      {
        body: patchConversationParticipantSchema.parse(body),
      },
    );
  }

  hideConversation(conversationId: string) {
    return this.requestJson(
      "DELETE",
      `/api/nicechat/conversations/${conversationId}`,
    );
  }

  listMessages(
    conversationId: string,
    params: Partial<z.input<typeof messageListQuerySchema>> = {},
  ) {
    const query = messageListQuerySchema.parse({
      before: params.before,
      limit:
        typeof params.limit === "number"
          ? String(Math.min(params.limit, MAX_MESSAGE_PAGE_LIMIT))
          : params.limit,
    });

    return this.requestJson(
      "GET",
      `/api/nicechat/conversations/${conversationId}/messages`,
      { query },
    );
  }

  sendMessage(
    conversationId: string,
    body: z.input<typeof sendMessageBodySchema>,
  ) {
    return this.requestJson(
      "POST",
      `/api/nicechat/conversations/${conversationId}/messages`,
      {
        body: sendMessageBodySchema.parse(body),
      },
    );
  }

  recallMessage(conversationId: string, messageId: string) {
    return this.requestJson(
      "DELETE",
      `/api/nicechat/conversations/${conversationId}/messages/${messageId}`,
    );
  }

  markConversationRead(conversationId: string) {
    return this.requestJson(
      "POST",
      `/api/nicechat/conversations/${conversationId}/read`,
    );
  }

  getNotificationSummary() {
    return this.requestJson("GET", "/api/nicechat/notifications/summary");
  }

  setPresence(body: z.input<typeof presencePostBodySchema> = {}) {
    return this.requestJson("POST", "/api/nicechat/presence", {
      body: presencePostBodySchema.parse(body),
    });
  }

  getPresence(userIds: string[]) {
    return this.requestJson("GET", "/api/nicechat/presence", {
      query: { userIds: userIds.join(",") },
    });
  }

  async requestJson<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = buildRequestUrl(this.baseUrl, path, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: buildHeaders(
          this.apiKey,
          Boolean(options.body),
          this.userAgent,
        ),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const raw = await response.text();
      const parsed = raw ? tryParseJson(raw) : null;

      if (!response.ok) {
        const errorBody = isErrorResponseBody(parsed) ? parsed : null;
        throw new NiceChatClientError(
          errorBody?.error ?? `请求失败（HTTP ${response.status}）。`,
          {
            code: errorBody?.code ?? "NICECHAT_API_ERROR",
            status: response.status,
            details: parsed ?? raw,
          },
        );
      }

      if (!raw) {
        return {} as T;
      }

      if (parsed === undefined) {
        throw new NiceChatClientError("服务端返回了无法解析的 JSON。", {
          code: "INVALID_JSON_RESPONSE",
          status: response.status,
          details: raw,
        });
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof NiceChatClientError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new NiceChatClientError("请求超时，请稍后重试。", {
          code: "REQUEST_TIMEOUT",
        });
      }

      throw new NiceChatClientError(
        error instanceof Error ? error.message : "请求 NiceChat API 失败。",
        {
          code: "REQUEST_FAILED",
          details: error,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildHeaders(apiKey: string, hasBody: boolean, userAgent: string) {
  const headers = new Headers({
    Accept: "application/json",
    "x-api-key": apiKey,
    "user-agent": userAgent,
  });

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

function buildRequestUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
) {
  const url = new URL(path, `${normalizeBaseUrl(baseUrl)}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return typeof value === "object" && value !== null && "error" in value;
}
