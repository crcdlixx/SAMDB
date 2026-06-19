import { useState } from "react";
import type { ReleasePayload } from "../api";

type ReleaseFormProps = {
  onSubmit: (payload: ReleasePayload) => Promise<void>;
};

export function ReleaseForm({ onSubmit }: ReleaseFormProps) {
  const [payload, setPayload] = useState<ReleasePayload>({
    releaseId: "",
    releaseTitle: "",
    releaseDate: "",
    edition: "",
    episodeCount: null,
    duration: "",
    fileSize: "",
    resolution: "",
    audioTracks: [],
    subtitleTracks: [],
    qualityNote: "",
    releaseStatus: "published"
  });
  const [message, setMessage] = useState("");

  return (
    <form
      className="work-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(payload).then(() => {
          setMessage("版本已添加");
          setPayload((current) => ({ ...current, releaseId: "", releaseTitle: "" }));
        }).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "添加失败");
        });
      }}
    >
      <strong>添加版本</strong>
      <label>版本 ID <input value={payload.releaseId} onChange={(event) => setPayload({ ...payload, releaseId: event.target.value })} /></label>
      <label>版本标题 <input value={payload.releaseTitle ?? ""} onChange={(event) => setPayload({ ...payload, releaseTitle: event.target.value })} /></label>
      <label>发布日期 <input value={payload.releaseDate ?? ""} onChange={(event) => setPayload({ ...payload, releaseDate: event.target.value })} placeholder="YYYY-MM-DD" /></label>
      <label>分辨率 <input value={payload.resolution ?? ""} onChange={(event) => setPayload({ ...payload, resolution: event.target.value })} /></label>
      <label>质量备注 <textarea value={payload.qualityNote ?? ""} onChange={(event) => setPayload({ ...payload, qualityNote: event.target.value })} /></label>
      <button type="submit">添加版本</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
