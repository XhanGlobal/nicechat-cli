import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type NiceChatCliStoredAuth = {
  accessToken: string;
  expiresAt?: string | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

const CLI_CONFIG_DIR = path.join(os.homedir(), ".config", "nicechat");
const CLI_AUTH_PATH = path.join(CLI_CONFIG_DIR, "auth.json");

// 本地 CLI 登录态默认落在用户目录下的受限文件中。
// 这样人类开发者不需要再把密钥写进 shell profile，同时也避免把凭据塞进仓库。
export async function readNiceChatCliAuthStore() {
  try {
    const raw = await fs.readFile(CLI_AUTH_PATH, "utf8");
    return JSON.parse(raw) as NiceChatCliStoredAuth;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeNiceChatCliAuthStore(value: NiceChatCliStoredAuth) {
  await fs.mkdir(CLI_CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CLI_AUTH_PATH, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(CLI_AUTH_PATH, 0o600);
}

export async function deleteNiceChatCliAuthStore() {
  try {
    await fs.unlink(CLI_AUTH_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function getNiceChatCliAuthPath() {
  return CLI_AUTH_PATH;
}
