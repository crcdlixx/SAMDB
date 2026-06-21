import type { Work } from "./api";

function languageCandidates(sourceLanguage?: string | null): string[] {
  const host = typeof navigator === "undefined" ? "" : navigator.language;
  return [host, sourceLanguage ?? "", "zh-CN", "zh", "en"].filter(Boolean);
}

export function pickLocalizedText(
  values: Record<string, string> | undefined,
  fallback: string,
  sourceLanguage?: string | null
): string {
  if (!values || Object.keys(values).length === 0) return fallback;
  for (const language of languageCandidates(sourceLanguage)) {
    if (values[language]) return values[language];
    const base = language.split("-")[0];
    const baseMatch = Object.entries(values).find(([key]) => key === base || key.startsWith(`${base}-`));
    if (baseMatch) return baseMatch[1];
  }
  return Object.values(values)[0] ?? fallback;
}

export function displayWorkText(work: Work): Pick<Work, "title" | "summaryShort" | "summaryFull"> {
  return {
    title: pickLocalizedText(work.titleI18n, work.title, work.sourceLanguage),
    summaryShort: pickLocalizedText(work.summaryShortI18n, work.summaryShort, work.sourceLanguage),
    summaryFull: pickLocalizedText(work.summaryFullI18n, work.summaryFull ?? "", work.sourceLanguage)
  };
}
