import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

export const B2BFinalCTA = memo(function B2BFinalCTA({ onPrimary, onSecondary }: Props) {
  return (
    <section className="relative z-10 py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] mb-6">
          Bring your studio<br />in-house.
        </h2>
        <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto font-light leading-relaxed">
          Set up your workspace in under 2 minutes. Invite your team. Ship
          your first campaign today.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={onPrimary}
            size="lg"
            className="group h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90"
          >
            Start free workspace
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            onClick={onSecondary}
            variant="ghost"
            size="lg"
            className="h-14 px-8 text-base font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06]"
          >
            Book a demo
          </Button>
        </div>
      </div>
    </section>
  );
});

B2BFinalCTA.displayName = 'B2BFinalCTA';