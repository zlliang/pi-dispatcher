import { uuidv7 } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel, cleanupSessionResources } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai/compat";

import { formatModel } from "./format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OptionalModelConfig } from "./schema";

const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "off";

export type ModelSettings = {
  model: Model<Api>;
  thinkingLevel: ModelThinkingLevel;
  warning: string | undefined;
};

type ModelSelection = {
  model: Model<Api> | undefined;
  warning: string | undefined;
};

type ThinkingLevelSelection = {
  thinkingLevel: ModelThinkingLevel;
  warning: string | undefined;
};

/** Complete a one-shot background request, using an isolated session for OpenAI Codex models. */
export const completeBackground: typeof completeSimple = async (model, context, options) => {
  if (model.api !== "openai-codex-responses") return completeSimple(model, context, options);

  const sessionId = uuidv7();

  try {
    return await completeSimple(model, context, { ...options, sessionId });
  } finally {
    cleanupSessionResources(sessionId);
  }
};

/**
 * Resolve the model and thinking level for a background feature (recap, title, ...).
 *
 * `feature` names the config section so warnings can point at the offending fields. When the
 * feature's model config is incomplete or unavailable, this falls back to the session's main
 * model and reports why via `warning`. Pass `notifyOnMissingModel: false` for silent features.
 *
 * The thinking level defaults to "off" (clamped to the model) when not set in config, so these
 * background features stay economical regardless of the working model's thinking level.
 */
export async function resolveModelSettings(ctx: ExtensionContext, config: OptionalModelConfig, feature: string): Promise<ModelSettings | undefined> {
  const fallbackModel = ctx.model;
  if (!fallbackModel) return;

  const { model, warning: modelWarning } = await resolveModel(ctx, config, feature, fallbackModel);
  if (!model) return;

  const { thinkingLevel, warning: thinkingLevelWarning } = resolveThinkingLevel(model, config.thinkingLevel ?? DEFAULT_THINKING_LEVEL);

  return {
    model,
    thinkingLevel,
    warning: [modelWarning, thinkingLevelWarning].filter(Boolean).join(" ") || undefined,
  };
}

/**
 * Resolve a configured model for a feature, including credential availability. When resolution
 * fails, return the fallback model if one was provided and explain whether the configured model
 * was replaced or omitted.
 */
export async function resolveModel(ctx: ExtensionContext, config: OptionalModelConfig, feature: string, fallbackModel?: Model<Api>): Promise<ModelSelection> {
  let model: Model<Api> | undefined = fallbackModel;
  let warning: string | undefined = undefined;
  const resolution = fallbackModel ? "using the current model" : `omitting the ${feature}`;

  if (config.provider && config.model) {
    const reference = formatModel(config.provider, config.model);
    const configuredModel = ctx.modelRegistry.find(config.provider, config.model);
    if (!configuredModel) {
      warning = `Model ${reference} not found; ${resolution}.`;
    } else {
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(configuredModel);
      if (auth.ok) {
        model = configuredModel;
      } else {
        warning = `Model ${reference} unavailable: ${auth.error}; ${resolution}.`;
      }
    }
  } else if (config.provider || config.model) {
    warning = `Both ${feature}.provider and ${feature}.model are required; ${resolution}.`;
  }

  return { model, warning };
}

function resolveThinkingLevel(model: Model<Api>, requested: ModelThinkingLevel): ThinkingLevelSelection {
  const thinkingLevel = clampThinkingLevel(model, requested);
  if (thinkingLevel === requested) {
    return {
      thinkingLevel,
      warning: undefined,
    };
  }

  const fallback = clampThinkingLevel(model, DEFAULT_THINKING_LEVEL);
  return {
    thinkingLevel: fallback,
    warning: `Thinking level ${requested} is not supported by ${formatModel(model.provider, model.id)}; using ${fallback}.`,
  };
}
