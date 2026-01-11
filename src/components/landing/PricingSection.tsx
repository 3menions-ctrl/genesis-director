import { Check, Sparkles, Zap, Crown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// Pricing tiers based on credit packages
const PRICING_TIERS = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    credits: 50,
    icon: Zap,
    description: 'Perfect for trying out Apex Studio',
    features: [
      '50 free credits to start',
      '~2 video clips included',
      'All AI features unlocked',
      'HD video export',
      'Community support',
    ],
    cta: 'Get Started Free',
    popular: false,
    gradient: 'from-muted/50 to-muted/30',
  },
  {
    name: 'Starter',
    price: 29,
    period: '/month',
    credits: 250,
    icon: Sparkles,
    description: 'For creators getting started',
    features: [
      '250 credits per month',
      '~10 video clips per month',
      'Priority video processing',
      '4K video export',
      'Email support',
    ],
    cta: 'Start Creating',
    popular: false,
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  {
    name: 'Growth',
    price: 99,
    period: '/month',
    credits: 1000,
    icon: Crown,
    description: 'Most popular for serious creators',
    features: [
      '1,000 credits per month',
      '~40 video clips per month',
      'Fastest processing speed',
      '4K + HDR export',
      'Priority email support',
      'Custom voice cloning',
    ],
    cta: 'Go Growth',
    popular: true,
    gradient: 'from-amber-500/30 to-orange-500/20',
  },
  {
    name: 'Agency',
    price: 249,
    period: '/month',
    credits: 3000,
    icon: Building2,
    description: 'For teams and agencies',
    features: [
      '3,000 credits per month',
      '~120 video clips per month',
      'Dedicated processing queue',
      'All export formats',
      'Dedicated support manager',
      'API access',
      'White-label options',
    ],
    cta: 'Contact Sales',
    popular: false,
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
];

// Credit cost breakdown
const CREDIT_COSTS = [
  { action: 'Generate 4s video clip', credits: 25, breakdown: '5 pre-prod + 20 production' },
  { action: 'AI script generation', credits: 2, breakdown: 'Per scene' },
  { action: 'Voice synthesis', credits: 3, breakdown: 'Per minute' },
  { action: 'Music generation', credits: 5, breakdown: 'Per track' },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-foreground">Simple Pricing</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Create more, spend less
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free with 50 credits. Upgrade anytime for more creative power.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {PRICING_TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className={cn(
                  "relative rounded-3xl p-6 lg:p-8 transition-all duration-300",
                  "border border-white/[0.08] bg-gradient-to-b",
                  tier.gradient,
                  tier.popular && "ring-2 ring-amber-500/50 scale-[1.02]",
                  "hover:border-white/20 hover:shadow-2xl hover:shadow-black/20"
                )}
              >
                {/* Popular badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-amber-500 text-black text-xs font-bold uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                  tier.popular ? "bg-amber-500/20" : "bg-white/10"
                )}>
                  <Icon className={cn(
                    "w-6 h-6",
                    tier.popular ? "text-amber-400" : "text-foreground/70"
                  )} />
                </div>

                {/* Name & Price */}
                <h3 className="text-xl font-bold text-foreground mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-foreground">
                    ${tier.price}
                  </span>
                  <span className="text-muted-foreground">{tier.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

                {/* Credits badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 mb-6">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-medium text-foreground">
                    {tier.credits.toLocaleString()} credits
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => navigate(tier.name === 'Agency' ? '/contact' : '/auth')}
                  className={cn(
                    "w-full h-12 rounded-xl font-semibold transition-all",
                    tier.popular
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-white/10 hover:bg-white/20 text-foreground border border-white/10"
                  )}
                >
                  {tier.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Credit Cost Breakdown */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 lg:p-8">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              How Credits Work
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {CREDIT_COSTS.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.breakdown}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">{item.credits}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Credits never expire. Buy more anytime or subscribe for monthly refills.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
