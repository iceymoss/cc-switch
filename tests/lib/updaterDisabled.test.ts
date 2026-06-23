import { describe, expect, it } from "vitest";
import { checkForUpdate } from "@/lib/updater";

// 发行版关闭自动更新：checkForUpdate 始终返回 up-to-date，
// 不调用 tauri updater 插件、不访问 GitHub 更新源。
describe("发行版自动更新已关闭", () => {
  it("checkForUpdate 始终返回 up-to-date", async () => {
    const result = await checkForUpdate();
    expect(result).toEqual({ status: "up-to-date" });
  });

  it("即使传入 channel/timeout 也不触发更新检查", async () => {
    const result = await checkForUpdate({ timeout: 1, channel: "beta" });
    expect(result.status).toBe("up-to-date");
  });
});
