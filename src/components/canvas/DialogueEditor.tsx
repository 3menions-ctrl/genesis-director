import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DialogueNodeData } from '@/lib/canvas/types';

export function DialogueEditor({
  data,
  onChange,
}: { data: DialogueNodeData; onChange: (d: Partial<DialogueNodeData>) => void }) {
  const [storyboardText, setStoryboardText] = useState(
    data.lines.map((l) => `${l.speaker}: ${l.text}`).join('\n')
  );

  const switchMode = (mode: 'storyboard' | 'conversation') => onChange({ mode });

  const commitStoryboard = (text: string) => {
    setStoryboardText(text);
    const lines = text
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const m = row.match(/^([^:]+):\s*(.+)$/);
        return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: 'Narrator', text: row };
      });
    onChange({ lines });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 w-fit">
        {(['storyboard', 'conversation'] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider ${data.mode === m ? 'bg-[#0A84FF] text-white' : 'text-white/60'}`}>
            {m}
          </button>
        ))}
      </div>

      {data.mode === 'storyboard' && (
        <Textarea value={storyboardText} onChange={(e) => commitStoryboard(e.target.value)} rows={10}
          placeholder={"Ava: We can't keep running.\nLeo: Then we make a stand."}
          className="font-mono text-sm" />
      )}

      {data.mode === 'conversation' && (
        <div className="space-y-2">
          {data.lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input value={l.speaker} onChange={(e) => {
                const next = [...data.lines]; next[i] = { ...l, speaker: e.target.value }; onChange({ lines: next });
              }} className="w-28" placeholder="Speaker" />
              <Textarea rows={2} value={l.text} onChange={(e) => {
                const next = [...data.lines]; next[i] = { ...l, text: e.target.value }; onChange({ lines: next });
              }} placeholder="Line…" />
              <Button size="icon" variant="ghost" onClick={() => {
                const next = data.lines.filter((_, j) => j !== i); onChange({ lines: next });
              }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary"
            onClick={() => onChange({ lines: [...data.lines, { speaker: 'Avatar', text: '' }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add line
          </Button>
        </div>
      )}
    </div>
  );
}