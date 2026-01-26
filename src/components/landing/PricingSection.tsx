import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 37,
    period: 'one-time',
    credits: '370 credits',
    videos: '~7 videos',
    features: ['HD export', 'AI scripts', 'Standard support'],
    popular: false,
  },
  {
    name: 'Growth',
    price: 99,
    period: 'one-time',
    credits: '1,000 credits',
    videos: '~17 videos',
    features: ['4K export', 'Priority processing', 'Priority support'],
    popular: true,
  },
  {
    name: 'Agency',
    price: 249,
    period: 'one-time',
    credits: '2,500 credits',
    videos: '~42 videos',
    features: ['4K HDR', 'API access', 'Dedicated support'],
    popular: false,
  },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative z-10 py-32 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Simple pricing
          </h2>
          <p className="text-lg text-white/40">
            Start free. Pay as you grow.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {PRICING_TIERS.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className={cn(
                "relative rounded-3xl p-8 transition-all duration-300",
                tier.popular
                  ? "bg-white"
                  : "bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1]"
              )}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-medium">
                    Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  tier.popular ? "text-black" : "text-white"
                )}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-4xl font-semibold tracking-tight",
                    tier.popular ? "text-black" : "text-white"
                  )}>
                    ${tier.price}
                  </span>
                </div>
                <p className={cn(
                  "text-sm mt-1",
                  tier.popular ? "text-black/50" : "text-white/40"
                )}>
                  {tier.credits} • {tier.videos}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <Check className={cn(
                      "w-4 h-4",
                      tier.popular ? "text-black" : "text-white/50"
                    )} />
                    <span className={tier.popular ? "text-black/70" : "text-white/50"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => navigate('/auth')}
                className={cn(
                  "w-full h-11 rounded-full font-medium transition-all",
                  tier.popular
                    ? "bg-black hover:bg-black/90 text-white"
                    : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                )}
              >
                Get Started
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Enterprise note */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-sm text-white/30">
            Need custom volume? <button onClick={() => navigate('/contact')} className="text-white/50 hover:text-white underline underline-offset-4">Contact sales</button>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
