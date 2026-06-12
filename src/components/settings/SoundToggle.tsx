/**
 * Sound toggle for Settings — flips the in-app sonic layer on/off.
 * Mounts inside the Settings preferences section.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sound";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(sfx.isEnabled());

  useEffect(() => {
    setEnabled(sfx.isEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    sfx.setEnabled(next);
    setEnabled(next);
    if (next) sfx.play("success");
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-foreground">Sound design</div>
        <div className="text-xs text-foreground/55 mt-0.5 max-w-md">
          Tasteful, optional sonic feedback for clicks, opens, renders and tips.
          Off by default; respects reduced-motion preference.
        </div>
      </div>
      <Button
        type="button"
        variant={enabled ? "default" : "outline"}
        size="sm"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Disable sound" : "Enable sound"}
      >
        {enabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
        {enabled ? "On" : "Off"}
      </Button>
    </div>
  );
}
