import { useState } from "react";
import { DirectorIntake } from "@/components/director/DirectorIntake";
import { DirectorCockpit } from "@/components/director/DirectorCockpit";
import { DirectorShell } from "@/components/director/DirectorRail";
import type { IntakeData } from "@/components/director/types";

import { usePageMeta } from '@/hooks/usePageMeta';
export default function DirectorStudio() {
  usePageMeta({ title: "Director Studio — Small Bridges", description: "Direct multi-character, multi-scene cinematic productions inside Small Bridges." });

  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(true);

  return (
    <DirectorShell>
      {intake && !intakeOpen && (
        <DirectorCockpit intake={intake} onReopenIntake={() => setIntakeOpen(true)} />
      )}
      {intakeOpen && (
        <DirectorIntake
          open
          onComplete={(data) => { setIntake(data); setIntakeOpen(false); }}
          onCancel={intake ? () => setIntakeOpen(false) : undefined}
        />
      )}
    </DirectorShell>
  );
}
