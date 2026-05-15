import { useState } from "react";
import { DirectorIntake } from "@/components/director/DirectorIntake";
import { DirectorCockpit } from "@/components/director/DirectorCockpit";
import { DEFAULT_INTAKE, type IntakeData } from "@/components/director/types";

export default function DirectorStudio() {
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(true);

  return (
    <>
      {intake && (
        <DirectorCockpit
          intake={intake}
          onReopenIntake={() => setIntakeOpen(true)}
        />
      )}
      <DirectorIntake
        open={intakeOpen}
        onComplete={(data) => {
          setIntake(data);
          setIntakeOpen(false);
        }}
        onCancel={intake ? () => setIntakeOpen(false) : undefined}
      />
      {!intake && !intakeOpen && (
        <div className="min-h-screen bg-[hsl(220,14%,2%)]" />
      )}
    </>
  );
}