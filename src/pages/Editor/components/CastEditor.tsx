/**
 * CastEditor — characters on the document.
 *
 * A small surface for character CRUD. Reachable via Cmd+J (J for
 * "junior cast" — a goofy mnemonic but Cmd+C is taken) or the
 * inspector's "missing character anchor" warning.
 *
 * Each character carries: name + role + description + identityDNA +
 * wardrobe + physical description + reference image URL + voice
 * profile id. Editing happens inline; saving writes through the
 * document-store mutation API.
 */
import { useState, useSyncExternalStore } from "react";
import {
  UserCircle2,
  Plus,
  Trash2,
  Crown,
  Megaphone,
  User,
  Mic2,
  Users as UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import {
  Surface,
  SurfaceHeader,
  SurfaceBody,
  SurfaceFooter,
  SurfaceKbdHint,
} from "./Surface";
import {
  getDocumentState,
  subscribeDocument,
  addCharacter,
  flushNow,
} from "@/lib/editor/document-store";
import type { Character } from "@/lib/editor/script-document";
import { confirmAsync } from "@/components/ui/global-confirm";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CastEditor({ open, onClose }: Props) {
  const docState = useSyncExternalStore(
    subscribeDocument,
    getDocumentState,
    getDocumentState,
  );
  const doc = docState.doc;

  const handleAdd = () => {
    if (!doc) {
      toast.error("Document not loaded");
      return;
    }
    addCharacter(
      {
        name: `Character ${doc.cast.length + 1}`,
        role: doc.cast.length === 0 ? "protagonist" : "supporting",
        description: "",
      },
      { by: "user" },
    );
    void flushNow();
  };

  return (
    <Surface open={open} onClose={onClose} size="lg" labelledBy="cast-title">
      <SurfaceHeader
        id="cast-title"
        eyebrow="◆ Cast"
        title={
          doc
            ? doc.cast.length === 0
              ? "No characters yet."
              : `${doc.cast.length} ${doc.cast.length === 1 ? "character" : "characters"}.`
            : "Open a project to manage cast."
        }
        description="Characters anchor identity across every shot they appear in. Add a reference image + identity DNA to lock the look the AI generator targets."
        onClose={onClose}
      />
      <SurfaceBody>
        {!doc ? (
          <p className={cn(TYPE_META, "text-center text-muted-foreground/55 py-10")}>
            ◆ No document loaded
          </p>
        ) : doc.cast.length === 0 ? (
          <div className="py-12 text-center">
            <UsersIcon className="h-7 w-7 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-4 font-display italic text-[18px] text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Add a protagonist to start.
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55 max-w-md mx-auto")}>
              Characters travel with you across every shot. Generation locks to their identity so faces and wardrobes don't drift between cuts.
            </p>
            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                "mt-6 inline-flex items-center gap-2 px-4 h-9 rounded-full",
                "bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40",
                "text-[13px] font-display italic transition-colors",
                "hover:bg-[hsl(var(--accent)/0.22)]",
              )}
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Add character</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {doc.cast.map((c) => (
              <CharacterRow key={c.id} character={c} />
            ))}
            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 h-9 rounded-full",
                "bg-white/[0.03] text-foreground/75 ring-1 ring-inset ring-white/[0.06]",
                "text-[12.5px] font-mono uppercase tracking-[0.18em]",
                "hover:bg-white/[0.07] transition-colors",
              )}
            >
              <Plus className="h-3 w-3" strokeWidth={1.5} />
              <span>Add character</span>
            </button>
          </div>
        )}
      </SurfaceBody>
      <SurfaceFooter>
        <span className="flex items-center gap-2">
          <SurfaceKbdHint keys="⌘J" label="open" />
          <span aria-hidden>·</span>
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
        {doc && (
          <span>
            {doc.cast.length} cast · {doc.scenes.length} scenes
          </span>
        )}
      </SurfaceFooter>
    </Surface>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterRow — inline-editable card per character
// ─────────────────────────────────────────────────────────────────────────────
function CharacterRow({ character }: { character: Character }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Character>(character);

  const save = () => {
    const doc = getDocumentState().doc;
    if (!doc) return;
    const idx = doc.cast.findIndex((c) => c.id === character.id);
    if (idx >= 0) {
      doc.cast[idx] = draft;
      void flushNow();
    }
    setEditing(false);
    toast.success(`${draft.name} saved`);
  };

  const remove = () => {
    const doc = getDocumentState().doc;
    if (!doc) return;
    doc.cast = doc.cast.filter((c) => c.id !== character.id);
    void flushNow();
    toast.message(`${character.name} removed`);
  };

  if (editing) {
    return (
      <div className="rounded-xl ring-1 ring-inset ring-accent/35 bg-white/[0.012] p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
              Name
            </span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={cn(
                "mt-1 block w-full h-8 rounded-md px-2",
                "bg-white/[0.02] text-foreground text-[13px]",
                "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
              )}
            />
          </label>
          <label className="block">
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
              Role
            </span>
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  role: e.target.value as Character["role"],
                })
              }
              className={cn(
                "mt-1 block w-full h-8 rounded-md px-2",
                "bg-white/[0.02] text-foreground text-[13px]",
                "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
              )}
            >
              <option value="protagonist" className="bg-[hsl(220_30%_6%)]">Protagonist</option>
              <option value="antagonist" className="bg-[hsl(220_30%_6%)]">Antagonist</option>
              <option value="supporting" className="bg-[hsl(220_30%_6%)]">Supporting</option>
              <option value="narrator" className="bg-[hsl(220_30%_6%)]">Narrator</option>
              <option value="ensemble" className="bg-[hsl(220_30%_6%)]">Ensemble</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
            Description
          </span>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className={cn(
              "mt-1 block w-full resize-none rounded-md px-2 py-1.5",
              "bg-white/[0.02] text-foreground text-[13px] leading-snug",
              "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
            )}
          />
        </label>
        <label className="mt-3 block">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
            Identity DNA (woven into every prompt)
          </span>
          <textarea
            value={draft.identityDNA ?? ""}
            onChange={(e) => setDraft({ ...draft, identityDNA: e.target.value || undefined })}
            placeholder="e.g. early-30s, dark hair, wire-frame glasses, navy trench coat, melancholic posture"
            rows={2}
            className={cn(
              "mt-1 block w-full resize-none rounded-md px-2 py-1.5",
              "bg-white/[0.02] text-foreground text-[13px] leading-snug",
              "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
            )}
          />
        </label>
        <label className="mt-3 block">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
            Reference image URL (i2v anchor)
          </span>
          <input
            value={draft.referenceImageUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, referenceImageUrl: e.target.value || undefined })}
            placeholder="https://…"
            className={cn(
              "mt-1 block w-full h-8 rounded-md px-2",
              "bg-white/[0.02] text-foreground text-[12.5px]",
              "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none font-mono",
            )}
          />
        </label>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(character);
            }}
            className="px-3 h-8 rounded-full text-[12px] text-muted-foreground/70 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className={cn(
              "px-4 h-8 rounded-full text-[12px] font-mono uppercase tracking-[0.18em]",
              "bg-[hsl(var(--accent)/0.16)] text-accent ring-1 ring-inset ring-accent/40",
              "hover:bg-[hsl(var(--accent)/0.24)] transition-colors",
            )}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  const RoleIcon =
    character.role === "protagonist"
      ? Crown
      : character.role === "antagonist"
      ? Megaphone
      : character.role === "narrator"
      ? Mic2
      : character.role === "ensemble"
      ? UsersIcon
      : User;

  return (
    // role=button (not a real <button>) because the Remove control below is
    // itself a <button>, and a button cannot be nested inside a button —
    // React logs validateDOMNesting and browsers hoist the inner button,
    // making both clicks unreliable.
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        "group/char w-full text-left rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.012]",
        "p-3 flex items-center gap-3 transition-colors cursor-pointer",
        "hover:ring-accent/40 hover:bg-white/[0.04]",
        "focus:outline-none focus-visible:ring-accent/60",
      )}
    >
      <div className="shrink-0 h-10 w-10 rounded-full bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] flex items-center justify-center overflow-hidden">
        {character.referenceImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.referenceImageUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <UserCircle2 className="h-5 w-5 text-muted-foreground/65" strokeWidth={1.3} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4
            className="font-display italic text-[15px] text-foreground/95 truncate"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {character.name}
          </h4>
          <span
            className={cn(
              TYPE_META,
              "font-mono uppercase tracking-[0.18em] flex items-center gap-1 text-muted-foreground/65",
            )}
          >
            <RoleIcon className="h-3 w-3" strokeWidth={1.5} />
            <span>{character.role}</span>
          </span>
        </div>
        {character.identityDNA ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground/75 line-clamp-1">
            {character.identityDNA}
          </p>
        ) : (
          <p className={cn(TYPE_META, "mt-0.5 text-amber-300/55")}>
            ⚠ no identity DNA — generation may drift between shots
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          if (!(await confirmAsync({
            title: "Remove character?",
            description: "This deletes the character from the cast.",
            confirmLabel: "Remove",
            destructive: true,
          }))) return;
          remove();
        }}
        className="opacity-0 group-hover/char:opacity-100 transition-opacity text-muted-foreground/45 hover:text-rose-300"
        aria-label="Remove character"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
