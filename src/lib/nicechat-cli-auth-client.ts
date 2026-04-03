import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

const NICECHAT_AUTH_BASE_PATH = "/api/auth";

export function createNiceChatCliAuthClient(options: {
  baseUrl: string;
  fetch: typeof fetch;
}) {
  return createAuthClient({
    baseURL: options.baseUrl,
    basePath: NICECHAT_AUTH_BASE_PATH,
    fetchOptions: {
      customFetchImpl: options.fetch,
    },
    plugins: [deviceAuthorizationClient()],
  });
}
