import { useState } from "react";
import type { AccessEntryPayload } from "../api";

type AccessEntryFormProps = {
  releaseId: string;
  onSubmit: (releaseId: string, payload: AccessEntryPayload) => Promise<void>;
};

export function AccessEntryForm({ releaseId, onSubmit }: AccessEntryFormProps) {
  const [payload, setPayload] = useState<AccessEntryPayload>({
    accessId: "",
    accessType: "official_streaming",
    platform: "",
    url: "",
    availability: "可访问",
    accessNote: "",
    extractCode: "",
    internalPath: "",
    visibility: "restricted"
  });
  const [message, setMessage] = useState("");

  return (
    <form
      className="work-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(releaseId, payload).then(() => {
          setMessage("获取方式已添加");
          setPayload((current) => ({ ...current, accessId: "", url: "", extractCode: "", internalPath: "" }));
        }).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "添加失败");
        });
      }}
    >
      <strong>添加获取方式</strong>
      <label>获取 ID <input value={payload.accessId} onChange={(event) => setPayload({ ...payload, accessId: event.target.value })} /></label>
      <label>类型 <input value={payload.accessType} onChange={(event) => setPayload({ ...payload, accessType: event.target.value })} /></label>
      <label>平台 <input value={payload.platform ?? ""} onChange={(event) => setPayload({ ...payload, platform: event.target.value })} /></label>
      <label>公开链接 <input value={payload.url ?? ""} onChange={(event) => setPayload({ ...payload, url: event.target.value })} /></label>
      <label>可用状态 <input value={payload.availability ?? ""} onChange={(event) => setPayload({ ...payload, availability: event.target.value })} /></label>
      <label>公开说明 <textarea value={payload.accessNote ?? ""} onChange={(event) => setPayload({ ...payload, accessNote: event.target.value })} /></label>
      <label>提取码/口令 <input value={payload.extractCode ?? ""} onChange={(event) => setPayload({ ...payload, extractCode: event.target.value })} /></label>
      <label>内部路径 <input value={payload.internalPath ?? ""} onChange={(event) => setPayload({ ...payload, internalPath: event.target.value })} /></label>
      <button type="submit">添加获取方式</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
