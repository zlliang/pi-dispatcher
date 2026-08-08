import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { defu } from "defu";

import { userConfigSchema } from "./utils/schema";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { UserConfig } from "./utils/schema";

const CONFIG_FILE = "dispatcher.json";
const RULES_FILE = "dispatcher.rules.md";

export type RuleFile = {
  filePath: string;
  content: string;
};

type Resources = {
  config: UserConfig;
  rules: RuleFile[];
};

const cache = new Map<string, Resources>();

/** Load config and rules once per session lifecycle; later calls return the cached result. */
export function loadResources(ctx: ExtensionContext): Resources {
  const cached = cache.get(ctx.cwd);
  if (cached) return cached;

  const resources: Resources = { config: loadConfig(ctx), rules: loadRules(ctx) };
  cache.set(ctx.cwd, resources);
  return resources;
}

function loadConfig(ctx: ExtensionContext): UserConfig {
  const [globalPath, projectPath] = getResourcePaths(ctx.cwd, CONFIG_FILE);
  const raw = defu(readJson(projectPath) ?? {}, readJson(globalPath) ?? {});
  const result = userConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`).join("; ");
    ctx.ui.notify(`Invalid pi-dispatcher config: ${issues}`, "error");
    return {};
  }

  return result.data;
}

function loadRules(ctx: ExtensionContext): RuleFile[] {
  return getResourcePaths(ctx.cwd, RULES_FILE).flatMap((filePath) => {
    const content = readText(filePath);
    return content === undefined ? [] : [{ filePath, content }];
  });
}

function getResourcePaths(cwd: string, fileName: string): [globalPath: string, projectPath: string] {
  return [join(getAgentDir(), fileName), join(cwd, CONFIG_DIR_NAME, fileName)];
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
