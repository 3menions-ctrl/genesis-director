import mockupV1 from "@/assets/director-studio-mockup.png";
import mockupV2 from "@/assets/director-studio-v2-cockpit.png";
export default function MockupPreview() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-8 gap-12">
      <div className="w-full max-w-[1600px]">
        <h2 className="text-white/70 font-mono text-xs tracking-widest mb-3">V2 — 3-ZONE COCKPIT</h2>
        <img src={mockupV2} alt="Director Studio v2 cockpit mockup" className="w-full h-auto rounded-lg shadow-2xl" />
      </div>
      <div className="w-full max-w-[1600px]">
        <h2 className="text-white/70 font-mono text-xs tracking-widest mb-3">V1 — INITIAL CONCEPT</h2>
        <img src={mockupV1} alt="Director Studio v1 mockup" className="w-full h-auto rounded-lg shadow-2xl" />
      </div>
    </div>
  );
}
