import { useState } from "react";
import { DirectorIntake } from "@/components/director/DirectorIntake";
import { DirectorCockpit } from "@/components/director/DirectorCockpit";
import { DirectorShell } from "@/components/director/DirectorRail";
import type { IntakeData } from "@/components/director/types";

export default function DirectorStudio() {
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
