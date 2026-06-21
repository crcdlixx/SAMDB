import { useEffect, useMemo, useState } from "react";
import type { Work, WorkPayload } from "../api";

export type DraftRelation = {
  targetWorkId: string;
  relationType: string;
  direction: "directed" | "bidirectional";
  note: string;
  visibility: string;
};

type WorkFormProps = {
  initial?: Work;
  submitLabel?: string;
  works?: Work[];
  onSubmit: (payload: WorkPayload, relations?: DraftRelation[]) => Promise<void>;
};

const languages = ["zh-CN", "ja", "en"];
const relationTypes = [
  "same_series",
  "sequel",
  "prequel",
  "remake",
  "adaptation_of",
  "spin_off",
  "alternate_version",
  "fanwork_of",
  "references",
  "related"
];

function toPayload(initial?: Work): WorkPayload {
  return {
    id: initial?.id,
    title: initial?.title ?? "",
    titleI18n: Object.keys(initial?.titleI18n ?? {}).length > 0 ? initial?.titleI18n : (initial?.title ? { "zh-CN": initial.title } : {}),
    sourceLanguage: initial?.sourceLanguage ?? "zh-CN",
    aliases: initial?.aliases ?? [],
    tags: initial?.tags ?? [],
    summaryShort: initial?.summaryShort ?? "",
    summaryShortI18n: Object.keys(initial?.summaryShortI18n ?? {}).length > 0 ? initial?.summaryShortI18n : (initial?.summaryShort ? { "zh-CN": initial.summaryShort } : {}),
    summaryFull: initial?.summaryFull ?? "",
    summaryFullI18n: Object.keys(initial?.summaryFullI18n ?? {}).length > 0 ? initial?.summaryFullI18n : (initial?.summaryFull ? { "zh-CN": initial.summaryFull } : {}),
    sourcePrimary: initial?.sourcePrimary ?? "",
    recordStatus: initial?.recordStatus ?? "draft",
    visibility: initial?.visibility ?? "public"
  };
}

function compactLocalized(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
}

function updateLocalized(
  payload: WorkPayload,
  key: "titleI18n" | "summaryShortI18n" | "summaryFullI18n",
  language: string,
  value: string
): WorkPayload {
  const next = { ...(payload[key] ?? {}), [language]: value };
  return { ...payload, [key]: next };
}

function ChipInput({
  label,
  values,
  suggestions,
  onChange
}: {
  label: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const matches = input.trim()
    ? suggestions.filter((item) => item.includes(input.trim()) && !values.includes(item)).slice(0, 5)
    : [];

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput("");
  }

  return (
    <div className="chip-editor">
      <label>{label}
        <input
          aria-label={`添加${label}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(input);
            }
          }}
        />
      </label>
      {matches.length > 0 ? (
        <div className="suggestion-list">
          {matches.map((item) => (
            <button type="button" key={item} onClick={() => add(item)}>{item}</button>
          ))}
        </div>
      ) : null}
      <div className="tag-row">
        {values.map((value) => (
          <span className="tag tag-chip" key={value}>
            {value}
            <button type="button" aria-label={`删除${label}：${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>x</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function WorkForm({ initial, submitLabel = "保存", works = [], onSubmit }: WorkFormProps) {
  const [payload, setPayload] = useState<WorkPayload>(() => toPayload(initial));
  const [message, setMessage] = useState("");
  const [draftRelations, setDraftRelations] = useState<DraftRelation[]>([]);
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("related");
  const [relationNote, setRelationNote] = useState("");

  useEffect(() => {
    setPayload(toPayload(initial));
    setDraftRelations([]);
    setMessage("");
  }, [initial]);

  const aliasSuggestions = useMemo(() => [...new Set(works.flatMap((work) => work.aliases))], [works]);
  const tagSuggestions = useMemo(() => [...new Set(works.flatMap((work) => work.tags))], [works]);
  const relationTargets = works.filter((work) => work.id !== initial?.id);

  function setField<K extends keyof WorkPayload>(key: K, value: WorkPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  function buildPayload(): WorkPayload {
    const titleI18n = compactLocalized(payload.titleI18n ?? {});
    const summaryShortI18n = compactLocalized(payload.summaryShortI18n ?? {});
    const summaryFullI18n = compactLocalized(payload.summaryFullI18n ?? {});
    const primaryTitle = titleI18n["zh-CN"] ?? titleI18n[payload.sourceLanguage ?? ""] ?? Object.values(titleI18n)[0] ?? payload.title;
    const primaryShort = summaryShortI18n["zh-CN"] ?? summaryShortI18n[payload.sourceLanguage ?? ""] ?? Object.values(summaryShortI18n)[0] ?? payload.summaryShort;
    const primaryFull = summaryFullI18n["zh-CN"] ?? summaryFullI18n[payload.sourceLanguage ?? ""] ?? Object.values(summaryFullI18n)[0] ?? payload.summaryFull ?? null;

    return {
      ...payload,
      title: primaryTitle,
      titleI18n,
      summaryShort: primaryShort,
      summaryShortI18n,
      summaryFull: primaryFull,
      summaryFullI18n
    };
  }

  function addRelation() {
    if (!relationTarget) return;
    setDraftRelations((current) => [
      ...current,
      {
        targetWorkId: relationTarget,
        relationType,
        direction: relationType === "same_series" || relationType === "related" ? "bidirectional" : "directed",
        note: relationNote,
        visibility: "public"
      }
    ]);
    setRelationTarget("");
    setRelationNote("");
  }

  return (
    <form
      className="work-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(buildPayload(), draftRelations).then(() => setMessage("已保存")).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "保存失败");
        });
      }}
    >
      <p className="muted">{initial ? `ID ${payload.id}` : "ID 将自动生成 UUID v4"}</p>
      <label>源语言
        <select value={payload.sourceLanguage ?? "zh-CN"} onChange={(event) => setField("sourceLanguage", event.target.value)}>
          {languages.map((language) => <option value={language} key={language}>{language}</option>)}
        </select>
      </label>

      <fieldset>
        <legend>标题</legend>
        {languages.map((language) => (
          <label key={language}>标题 {language}
            <input
              value={payload.titleI18n?.[language] ?? ""}
              onChange={(event) => setPayload((current) => updateLocalized(current, "titleI18n", language, event.target.value))}
            />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>一句话简介</legend>
        {languages.map((language) => (
          <label key={language}>一句话简介 {language}
            <textarea
              value={payload.summaryShortI18n?.[language] ?? ""}
              onChange={(event) => setPayload((current) => updateLocalized(current, "summaryShortI18n", language, event.target.value))}
            />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>完整简介</legend>
        {languages.map((language) => (
          <label key={language}>完整简介 {language}
            <textarea
              value={payload.summaryFullI18n?.[language] ?? ""}
              onChange={(event) => setPayload((current) => updateLocalized(current, "summaryFullI18n", language, event.target.value))}
            />
          </label>
        ))}
      </fieldset>

      <label>主来源 <input value={payload.sourcePrimary} onChange={(event) => setField("sourcePrimary", event.target.value)} /></label>
      <label>记录状态
        <select value={payload.recordStatus} onChange={(event) => setField("recordStatus", event.target.value)}>
          <option value="draft">draft</option>
          <option value="reviewing">reviewing</option>
          <option value="published">published</option>
          <option value="frozen">frozen</option>
          <option value="offline">offline</option>
        </select>
      </label>
      <label>可见性
        <select value={payload.visibility} onChange={(event) => setField("visibility", event.target.value)}>
          <option value="public">public</option>
          <option value="restricted">restricted</option>
          <option value="internal">internal</option>
        </select>
      </label>

      <ChipInput label="别名" values={payload.aliases} suggestions={aliasSuggestions} onChange={(values) => setField("aliases", values)} />
      <ChipInput label="标签" values={payload.tags} suggestions={tagSuggestions} onChange={(values) => setField("tags", values)} />

      {!initial ? (
        <fieldset>
          <legend>创建时关系</legend>
          <label>关联目标作品
            <select value={relationTarget} onChange={(event) => setRelationTarget(event.target.value)}>
              <option value="">选择作品</option>
              {relationTargets.map((work) => <option value={work.id} key={work.id}>{work.title}</option>)}
            </select>
          </label>
          <label>关系类型
            <select value={relationType} onChange={(event) => setRelationType(event.target.value)}>
              {relationTypes.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
          </label>
          <label>关系备注 <input value={relationNote} onChange={(event) => setRelationNote(event.target.value)} /></label>
          <button type="button" onClick={addRelation}>添加到创建关系</button>
          <div className="tag-row">
            {draftRelations.map((relation, index) => (
              <span className="tag tag-chip" key={`${relation.targetWorkId}-${index}`}>
                {relation.relationType}: {relation.targetWorkId}
                <button type="button" aria-label={`删除创建关系：${relation.targetWorkId}`} onClick={() => setDraftRelations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>x</button>
              </span>
            ))}
          </div>
        </fieldset>
      ) : null}

      <button type="submit">{submitLabel}</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
