import { useEffect, useState } from "react";
import type { Work, WorkPayload } from "../api";

type WorkFormProps = {
  initial?: Work;
  submitLabel?: string;
  onSubmit: (payload: WorkPayload) => Promise<void>;
};

function toPayload(initial?: Work): WorkPayload {
  return {
    id: initial?.id ?? "",
    title: initial?.title ?? "",
    aliases: initial?.aliases ?? [],
    tags: initial?.tags ?? [],
    summaryShort: initial?.summaryShort ?? "",
    summaryFull: initial?.summaryFull ?? "",
    sourcePrimary: initial?.sourcePrimary ?? "",
    recordStatus: initial?.recordStatus ?? "draft",
    visibility: initial?.visibility ?? "public"
  };
}

export function WorkForm({ initial, submitLabel = "保存", onSubmit }: WorkFormProps) {
  const [payload, setPayload] = useState<WorkPayload>(() => toPayload(initial));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPayload(toPayload(initial));
    setMessage("");
  }, [initial]);

  function setField<K extends keyof WorkPayload>(key: K, value: WorkPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="work-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(payload).then(() => setMessage("已保存")).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "保存失败");
        });
      }}
    >
      <label>ID <input value={payload.id} onChange={(event) => setField("id", event.target.value)} disabled={Boolean(initial)} /></label>
      <label>标题 <input value={payload.title} onChange={(event) => setField("title", event.target.value)} /></label>
      <label>一句话简介 <textarea value={payload.summaryShort} onChange={(event) => setField("summaryShort", event.target.value)} /></label>
      <label>完整简介 <textarea value={payload.summaryFull ?? ""} onChange={(event) => setField("summaryFull", event.target.value)} /></label>
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
      <label>别名，逗号分隔 <input value={payload.aliases.join(",")} onChange={(event) => setField("aliases", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
      <label>标签，逗号分隔 <input value={payload.tags.join(",")} onChange={(event) => setField("tags", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
      <button type="submit">{submitLabel}</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
