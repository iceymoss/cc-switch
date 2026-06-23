import { describe, expect, it } from "vitest";
import {
  providerPresets,
  type ProviderPreset,
} from "@/config/claudeProviderPresets";
import { codexProviderPresets } from "@/config/codexProviderPresets";

// 发行版（PrimeRouter 二开）相关断言：
// - 注入 PrimeRouter 置顶预设（Claude / Codex）
// - 白名单过滤：终端可见预设仅保留各自官方 + PrimeRouter（其余标记 hidden）

const visibleNames = (presets: { name: string; hidden?: boolean }[]) =>
  presets.filter((p) => !p.hidden).map((p) => p.name);

describe("PrimeRouter Claude 预设", () => {
  const primerouter = providerPresets.find((p) => p.name === "PrimeRouter");

  it("存在 PrimeRouter 预设且置顶", () => {
    expect(primerouter).toBeDefined();
    expect(primerouter!.primePartner).toBe(true);
  });

  it("env 指向 PrimeRouter 中转站且默认模型正确", () => {
    const env = (primerouter!.settingsConfig as any).env;
    expect(env.ANTHROPIC_BASE_URL).toBe("https://www.primerouter.xyz");
    expect(env).toHaveProperty("ANTHROPIC_AUTH_TOKEN", "");
    expect(env).toHaveProperty("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1");
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("claude-sonnet-4-6");
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("claude-opus-4-7");
  });

  it("使用 ANTHROPIC_AUTH_TOKEN 字段并带主题色", () => {
    expect(primerouter!.apiKeyField).toBe("ANTHROPIC_AUTH_TOKEN");
    expect(primerouter!.theme?.backgroundColor).toBe("#6366F1");
    expect(primerouter!.theme?.textColor).toBe("#FFFFFF");
  });

  it("不被 hidden 过滤", () => {
    expect(primerouter!.hidden).toBeFalsy();
  });
});

describe("Claude 预设白名单", () => {
  it("终端可见预设仅保留 Claude Official + PrimeRouter", () => {
    expect(visibleNames(providerPresets as ProviderPreset[])).toEqual([
      "Claude Official",
      "PrimeRouter",
    ]);
  });

  it("上游预设定义仍保留（仅隐藏，便于跟随上游）", () => {
    // 上游测试依赖的预设仍可被 find 到
    expect(providerPresets.find((p) => p.name === "Kimi For Coding")).toBeDefined();
    expect(providerPresets.find((p) => p.name === "Shengsuanyun")).toBeDefined();
  });
});

describe("PrimeRouter Codex 预设", () => {
  const primerouter = codexProviderPresets.find(
    (p) => p.name === "PrimeRouter",
  );

  it("存在 PrimeRouter 预设且置顶", () => {
    expect(primerouter).toBeDefined();
    expect(primerouter!.primePartner).toBe(true);
  });

  it("config.toml 指向 PrimeRouter /v1 且用 chat 协议与默认模型", () => {
    const config = primerouter!.config;
    expect(config).toContain("https://www.primerouter.xyz/v1");
    expect(config).toContain('wire_api = "chat"');
    expect(config).toContain('model = "claude-sonnet-4-6"');
  });
});

describe("Codex 预设白名单", () => {
  it("终端可见预设仅保留 OpenAI Official + PrimeRouter", () => {
    expect(
      visibleNames(codexProviderPresets as { name: string; hidden?: boolean }[]),
    ).toEqual(["OpenAI Official", "PrimeRouter"]);
  });
});

describe("PrimeRouter 图标", () => {
  it("已注册 primerouter 图标且为内联 SVG", async () => {
    const { hasIcon, getIcon, isUrlIcon } = await import("@/icons/extracted");
    expect(hasIcon("primerouter")).toBe(true);
    expect(isUrlIcon("primerouter")).toBe(false);
    expect(getIcon("primerouter")).toContain("<svg");
  });
});
