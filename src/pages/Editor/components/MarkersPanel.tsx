/**
 * MarkersPanel — floating list of every marker the user has dropped.
 * Click a row to seek the playhead. Inline-edit the label. Trash icon
 * removes. Sorted by timeline position. Triggered by Shift+M.
 *
 * Same floating language as TakesDrawer / CommentsPanel — frosted
 * glass since it has to float over canvas + timeline.
 */
import { useState } from "react";
import { Flag, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import { Surface, SurfaceHeader, SurfaceBody } from "./Surface";
import {
  setPlayhead,
  removeMarker,
  updateMarker,
  addMarkerAtPlayhead,
} from "@/lib/editor/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export function MarkersPanel({ open, onClose }: Props) {
  const { markers, playheadSec } = useEditor();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (id: string, current: string) => {
    setEditing(id);
    setDraft(current);
  };
  const commitEdit = () => {
    if (editing) {
      const label = draft.trim() || "Untitled";
      updateMarker(editing, { label });
    }
    setEditing(null);
    setDraft("");
  };

  return (
    <Surface open={open} onClose={onClose} size="sm">
      <SurfaceHeader
        eyebrow="◆ Markers"
        title={
          markers.length === 0
            ? "None yet."
            : `${markers.length} ${markers.length === 1 ? "marker" : "markers"}.`
        }
        description="Click any row to seek there. Inline-edit the label."
        onClose={onClose}
      />
      <SurfaceBody noPadding className="px-3 py-2">
            {markers.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Flag className="h-5 w-5 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
                <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
                  Press M to drop one at the playhead
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {markers.map((m) => {
                  const isEditing = editing === m.id;
                  return (
                    <li key={m.id}>
                      <div
                        className={cn(
                          "group/m flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors",
                          "hover:bg-white/[0.025]",
                        )}
                      >
                        {/* Color dot — also click target to seek */}
                        <button
                          type="button"
                          onClick={() => setPlayhead(m.timelineSec)}
                          aria-label={`Seek to ${m.label}`}
                          className="shrink-0 h-2.5 w-2.5 rounded-full"
                          style={{
                            background: m.color,
                            boxShadow: `0 0 6px ${m.color}`,
                          }}
                        />
                        {/* Label — click to edit */}
                        {isEditing ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value.slice(0, 60))}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditing(null);
                                setDraft("");
                              }
                            }}
                            className="flex-1 bg-transparent outline-none text-[13px] text-foreground border-b border-accent/40 focus:border-accent caret-accent"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(m.id, m.label)}
                            className="flex-1 text-left text-[13px] text-foreground/90 truncate hover:text-foreground transition-colors"
                            title="Click to rename"
                          >
                            {m.label}
                          </button>
                        )}
                        {/* Timecode — click to seek */}
                        <button
                          type="button"
                          onClick={() => setPlayhead(m.timelineSec)}
                          className={cn(
                            TYPE_META,
                            "font-mono tabular-nums text-muted-foreground/65 hover:text-accent transition-colors",
                          )}
                        >
                          {fmtTC(m.timelineSec)}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMarker(m.id)}
                          className="opacity-0 group-hover/m:opacity-100 text-muted-foreground/55 hover:text-rose-300 transition-all"
                          aria-label="Remove marker"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
      </SurfaceBody>

      <div className="relative shrink-0 px-5 pt-3.5 pb-4">
        <span
          aria-hidden
          className="absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
        <button
          type="button"
          onClick={() => addMarkerAtPlayhead()}
          className="group/add flex w-full items-center gap-2 text-left text-[13px] text-foreground/80 hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <span>Drop marker at {fmtTC(playheadSec)}</span>
          <span className={cn(TYPE_META, "ml-auto font-mono text-muted-foreground/40")}>
            M
          </span>
        </button>
      </div>
    </Surface>
  );
}
