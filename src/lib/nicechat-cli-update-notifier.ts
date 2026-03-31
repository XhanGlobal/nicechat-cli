import updateNotifier from "update-notifier";

const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24;

type PackageMetadata = {
  name: string;
  version: string;
};

type CliStderr = Pick<NodeJS.WriteStream, "write">;

export type NiceChatCliUpdateInfo = {
  name: string;
  current: string;
  latest: string;
  type?: string;
};

type NiceChatCliUpdateNotifier = {
  update?: NiceChatCliUpdateInfo;
};

export type NiceChatCliUpdateNotifierFactory = (options: {
  pkg: PackageMetadata;
  updateCheckInterval: number;
  shouldNotifyInNpmScript: boolean;
}) => NiceChatCliUpdateNotifier;

// 版本提醒必须是“尽量提醒、绝不阻塞”：检查失败时静默跳过，避免影响任何 CLI 正常命令。
export function maybeWarnAboutOutdatedNiceChatCli(options: {
  stderr: CliStderr;
  pkg: PackageMetadata;
  notifierFactory?: NiceChatCliUpdateNotifierFactory;
}) {
  try {
    const notifier = (options.notifierFactory ?? updateNotifier)({
      pkg: options.pkg,
      updateCheckInterval: UPDATE_CHECK_INTERVAL_MS,
      shouldNotifyInNpmScript: false,
    });
    const update = notifier.update;

    if (!update || update.current === update.latest) {
      return;
    }

    options.stderr.write(
      `warning: 检测到 ${update.name} 有新版本可用（当前 ${update.current}，最新 ${update.latest}）。请尽快运行 \`npm install -g ${update.name}@latest\` 升级。\n`,
    );
  } catch {
    // update-notifier 是体验增强能力，不应影响命令执行。
  }
}
