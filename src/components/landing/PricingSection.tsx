import { Check, Sparkles, Zap, Crown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 37,
    credits: 370,
    icon: Zap,
    description: 'Get started creating',
    features: [
      '370 credits',
      '~7 one-minute videos',
      'HD quality export',
      'AI script generation',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Growth',
    price: 99,
    credits: 1000,
    icon: Sparkles,
    description: 'Best value for creators',
    features: [
      '1,000 credits',
      '~17 one-minute videos',
      '4K quality export',
      'Priority processing',
    ],
    cta: 'Best Value',
    popular: true,
  },
  {
    name: 'Agency',
    price: 249,
    credits: 2500,
    icon: Crown,
    description: 'For teams and pros',
    features: [
      '2,500 credits',
      '~42 one-minute videos',
      '4K HDR export',
      'Dedicated support',
    ],
    cta: 'Go Agency',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: null,
    credits: null,
    icon: Building2,
    description: 'Custom solutions',
    features: [
      'Custom credit volume',
      'Dedicated support',
      'API access',
      'Custom branding',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Simple pricing
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Start free with 60 credits. Upgrade when you need more.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  "relative rounded-2xl p-6 transition-all duration-300",
                  tier.popular
                    ? "bg-white text-black"
                    : "bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04]"
                )}
              >
                {/* Popular badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                  tier.popular ? "bg-black/10" : "bg-white/[0.05]"
                )}>
                  <Icon className={cn(
                    "w-5 h-5",
                    tier.popular ? "text-black" : "text-white/70"
                  )} />
                </div>

                {/* Name & Price */}
                <h3 className={cn(
                  "text-lg font-bold mb-1",
                  tier.popular ? "text-black" : "text-white"
                )}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-1">
                  {tier.credits !== null ? (
                    <>
                      <span className={cn(
                        "text-3xl font-bold",
                        tier.popular ? "text-black" : "text-white"
                      )}>
                        ${tier.price}
                      </span>
                    </>
                  ) : (
                    <span className={cn(
                      "text-2xl font-bold",
                      tier.popular ? "text-black" : "text-white"
                    )}>
                      Custom
                    </span>
                  )}
                </div>
                <p className={cn(
                  "text-sm mb-4",
                  tier.popular ? "text-black/60" : "text-white/50"
                )}>
                  {tier.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        tier.popular ? "text-black" : "text-white/70"
                      )} />
                      <span className={tier.popular ? "text-black/70" : "text-white/60"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => navigate(tier.name === 'Enterprise' ? '/contact' : '/auth')}
                  className={cn(
                    "w-full h-11 rounded-xl font-semibold transition-all",
                    tier.popular
                      ? "bg-black hover:bg-black/90 text-white"
                      : "bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.1]"
                  )}
                >
                  {tier.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
