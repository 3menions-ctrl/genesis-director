import { Check, Sparkles, Zap, Crown, Building2, Shield, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PromotionalBanner } from '@/components/studio/PromotionalBanner';

// Pricing tiers - credits-based system
const PRICING_TIERS = [
  {
    name: 'Free Trial',
    price: 0,
    period: 'to start',
    credits: 60,
    icon: Zap,
    description: 'Try the platform',
    features: [
      '60 credits to start',
      '1 video clip included',
      'Automatic retry system',
      '4K export available',
    ],
    cta: 'Try Free',
    popular: false,
    gradient: 'from-muted/50 to-muted/30',
  },
  {
    name: 'Creator',
    price: 59,
    period: '/month',
    credits: 600,
    icon: Sparkles,
    description: 'For regular content creation',
    features: [
      '600 credits per month',
      'Approximately 10 clips',
      'Automatic retry system',
      '4K export',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  {
    name: 'Pro',
    price: 149,
    period: '/month',
    credits: 1800,
    icon: Crown,
    description: 'For frequent creators',
    features: [
      '1,800 credits per month',
      'Approximately 30 clips',
      'Priority processing',
      'All export formats',
      'Priority support',
      'Voice cloning feature',
    ],
    cta: 'Go Pro',
    popular: true,
    gradient: 'from-amber-500/30 to-orange-500/20',
  },
  {
    name: 'Studio',
    price: 399,
    period: '/month',
    credits: 6000,
    icon: Building2,
    description: 'For teams and agencies',
    features: [
      '6,000 credits per month',
      'Approximately 100 clips',
      'Dedicated processing',
      'All export formats',
      'Dedicated support',
      'API access',
      'Custom branding options',
    ],
    cta: 'Contact Sales',
    popular: false,
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
];

// Credit cost breakdown
const CREDIT_COSTS = [
  { action: 'Single video clip', credits: 60, breakdown: '60 credits per clip' },
  { action: 'Voice narration', credits: 10, breakdown: 'Per minute of audio' },
  { action: 'Music generation', credits: 15, breakdown: 'Per track' },
  { action: 'Automatic retries', credits: 'Included', breakdown: 'Up to 4 retries per clip' },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Promotional Banner */}
        <div className="max-w-3xl mx-auto mb-12">
          <PromotionalBanner />
        </div>

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-foreground">Simple Pricing</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Credits-based pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pay for what you use. Each clip costs 60 credits.
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
                  onClick={() => navigate(tier.name === 'Studio' ? '/contact' : '/auth')}
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

        {/* Quality System Info */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 lg:p-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Automatic Retry System
              </h3>
            </div>
            
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Auto Retries</p>
                <p className="text-xs text-muted-foreground">System regenerates clips automatically</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Quality Analysis</p>
                <p className="text-xs text-muted-foreground">AI checks generated clips</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <Crown className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Scene Review</p>
                <p className="text-xs text-muted-foreground">Automated scene analysis</p>
              </div>
            </div>
            
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
            
            <p className="text-sm text-center mt-6 text-emerald-400 font-medium">
              Automatic retries included at no extra cost.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
