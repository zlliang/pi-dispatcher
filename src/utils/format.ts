import type { ModelThinkingLevel, ProviderId } from "@earendil-works/pi-ai";

export function formatModel(provider?: ProviderId | string, model?: string, thinkingLevel?: ModelThinkingLevel): string {
  return provider && model ? `${provider}/${model}${thinkingLevel ? `:${thinkingLevel}` : ""}` : "no-model";
}

/** Replace newlines, tabs, carriage returns with space, then collapse multiple spaces. */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}
