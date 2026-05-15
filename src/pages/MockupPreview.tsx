import mockup from "@/assets/director-studio-mockup.png";
export default function MockupPreview() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <img src={mockup} alt="Director Studio mockup" className="max-w-full h-auto rounded-lg shadow-2xl" />
    </div>
  );
}
