/**
 * BusinessComingSoon — shared placeholder for /business sections not yet
 * built to full depth. Renders inside the same BusinessShell + cover hero so
 * navigation never 404s and the module feels whole while we iterate.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Hammer } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage } from "@/components/business/BusinessPage";

export default function BusinessComingSoon({ title, description }: { title: string; description: string }) {
  usePageMeta({ title: `${title} — Business`, description });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Business</span><span className="text-white/20">·</span><span>In build</span></>}
      title={title}
      subtitle={description}
    >
      <div className="relative overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center text-center px-6 py-20 bg-gradient-to-br from-[hsl(215_40%_10%)]/40 to-[#0a0a0f]">
          <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
            <Hammer className="w-6 h-6 text-[hsl(215,100%,72%)]" strokeWidth={1.4} />
          </span>
          <h3 className="mt-5 font-display italic font-light text-[22px] text-white tracking-[-0.01em]">This surface is being built for business.</h3>
          <p className="mt-2 max-w-md text-[13px] text-white/55">
            {title} is part of the new business module. It'll land here, optimized for teams — no consumer clutter.
          </p>
          <Link to="/business" className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-full ring-1 ring-white/10 hover:ring-white/20 bg-white/[0.02] text-[13px] text-white/80 hover:text-white transition-colors">
            Back to Overview <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </BusinessPage>
  );
}
