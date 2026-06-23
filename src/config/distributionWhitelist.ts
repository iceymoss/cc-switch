/**
 * 发行版（PrimeRouter 二开）预设白名单
 *
 * 目的：以最小改动注入 PrimeRouter 并隐藏其它第三方中转站预设，
 * 同时保留上游全部预设定义不删除，方便持续跟随上游版本迭代、降低 rebase 冲突。
 *
 * 实现：不从数组中移除任何预设，只把非白名单预设标记为 `hidden`，
 * 由 UI 现有的 `!hidden` 过滤负责对终端用户隐藏。白名单预设需置于各数组最前，
 * 以保证「过滤后下标」与「原始数组下标」对齐（多处按下标反查 preset）。
 */

/** 对终端用户可见的预设名称（各工具官方 + PrimeRouter） */
export const DISTRIBUTION_VISIBLE_PRESETS = new Set<string>([
  "Claude Official", // Claude 官方
  "OpenAI Official", // Codex 官方
  "PrimeRouter", // 本中转站
]);

/**
 * 应用发行版白名单：非白名单预设标记为 hidden（保留定义，仅不展示）。
 */
export function applyDistributionWhitelist<
  T extends { name: string; hidden?: boolean },
>(presets: T[]): T[] {
  return presets.map((preset) =>
    DISTRIBUTION_VISIBLE_PRESETS.has(preset.name)
      ? preset
      : { ...preset, hidden: true },
  );
}
