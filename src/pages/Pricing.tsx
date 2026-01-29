import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Building2, ArrowRight, Sparkles, Shield, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Credit pricing: 1 credit = $0.10
const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for trying out the platform',
    price: 37,
    credits: 370,
    videosEstimate: '~37 clips',
    icon: <Zap className="w-6 h-6" />,
    features: [
      'HD video export (1080p)',
      'AI-powered script generation',
      'Text-to-video creation',
      'Image-to-video animation',
      'Basic character consistency',
      'Standard processing queue',
      'Email support',
    ],
    popular: false,
    gradient: 'from-slate-500 to-slate-600',
    glowColor: 'rgba(100, 116, 139, 0.3)',
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For serious creators and small teams',
    price: 100,
    credits: 1000,
    videosEstimate: '~100 clips',
    icon: <Crown className="w-6 h-6" />,
    features: [
      '4K video export (2160p)',
      'Priority processing queue',
      'Advanced character lock',
      'AI voiceover generation',
      'AI music composition',
      'Style transfer (20+ presets)',
      'Priority support',
    ],
    popular: true,
    gradient: 'from-white to-slate-100',
    glowColor: 'rgba(255, 255, 255, 0.4)',
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'For studios and production teams',
    price: 250,
    credits: 2500,
    videosEstimate: '~250 clips',
    icon: <Building2 className="w-6 h-6" />,
    features: [
      '4K HDR export',
      'API access for automation',
      'White-label exports',
      'Team collaboration tools',
      'Custom style presets',
      'Bulk processing',
      'Dedicated account manager',
    ],
    popular: false,
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.3)',
  },
];

const TRUST_POINTS = [
  { icon: <Shield className="w-5 h-5" />, text: 'Secure payments via Stripe' },
  { icon: <Clock className="w-5 h-5" />, text: 'Credits never expire' },
  { icon: <Users className="w-5 h-5" />, text: '10,000+ creators' },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] bg-violet-500/[0.08] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/3 w-[600px] h-[600px] bg-fuchsia-500/[0.06] rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/[0.07] rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            APEX-STUDIO
          </Link>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10"
          >
            Sign Up Free
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/60">Simple, transparent pricing</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6">
              <span className="block">Pay once.</span>
              <span className="block bg-gradient-to-r from-white via-white/80 to-white/60 bg-clip-text text-transparent">
                Create forever.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/40 max-w-xl mx-auto mb-4">
              No subscriptions. No hidden fees. Just credits that fuel your creativity.
            </p>

            <p className="text-sm text-white/30">
              1 credit = $0.10 • ~10 credits per clip
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {PRICING_TIERS.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.15 }}
                className={cn(
                  "relative group rounded-3xl",
                  tier.popular ? "lg:-mt-4 lg:mb-4" : ""
                )}
              >
                {/* Glow effect - static for popular, subtle on hover for others */}
                {tier.popular && (
                  <div
                    className="absolute -inset-[1px] rounded-3xl blur-xl opacity-50"
                    style={{ background: tier.glowColor }}
                  />
                )}

                {/* Card */}
                <div
                  className={cn(
                    "relative h-full rounded-3xl p-8 transition-all duration-500 overflow-hidden",
                    tier.popular
                      ? "bg-white text-black"
                      : "bg-transparent border border-white/[0.08] hover:border-white/[0.15]"
                  )}
                >
                  {/* Popular badge */}
                  {tier.popular && (
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-black text-white text-xs font-medium rounded-bl-2xl rounded-tr-3xl">
                      Most Popular
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                      tier.popular
                        ? "bg-black text-white"
                        : "bg-white/[0.05] text-white"
                    )}
                  >
                    {tier.icon}
                  </div>

                  {/* Tier info */}
                  <div className="mb-6">
                    <h3 className={cn("text-2xl font-bold mb-1", tier.popular ? "text-black" : "text-white")}>
                      {tier.name}
                    </h3>
                    <p className={cn("text-sm", tier.popular ? "text-black/60" : "text-white/40")}>
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-5xl font-bold tracking-tight", tier.popular ? "text-black" : "text-white")}>
                        ${tier.price}
                      </span>
                      <span className={cn("text-sm", tier.popular ? "text-black/40" : "text-white/30")}>
                        one-time
                      </span>
                    </div>
                    <div className={cn("mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm", tier.popular ? "bg-black/5 text-black/70" : "bg-white/[0.05] text-white/60")}>
                      <span className="font-medium">{tier.credits.toLocaleString()} credits</span>
                      <span className="opacity-50">•</span>
                      <span>{tier.videosEstimate}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className={cn("w-5 h-5 mt-0.5 shrink-0", tier.popular ? "text-black" : "text-white/50")} />
                        <span className={cn("text-sm", tier.popular ? "text-black/70" : "text-white/60")}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={() => navigate('/auth?mode=signup')}
                    className={cn(
                      "w-full h-12 rounded-full font-medium text-base transition-all duration-300",
                      tier.popular
                        ? "bg-black hover:bg-black/90 text-white shadow-lg"
                        : "bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.1]"
                    )}
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Points */}
      <section className="relative z-10 py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {TRUST_POINTS.map((point, i) => (
              <div key={i} className="flex items-center gap-2 text-white/40">
                {point.icon}
                <span className="text-sm">{point.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ Teaser */}
      <section className="relative z-10 py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
            Questions?
          </h2>
          <p className="text-white/40 mb-8">
            Check our FAQ or reach out to our team.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/#faq')}
              className="rounded-full border-white/10 text-white hover:bg-white/5"
            >
              View FAQ
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/contact')}
              className="rounded-full border-white/10 text-white hover:bg-white/5"
            >
              Contact Sales
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Start creating today
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-md mx-auto">
            Get 50 free credits when you sign up. No credit card required.
          </p>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            size="lg"
            className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Get Started Free
          </Button>
        </motion.div>
      </section>

      {/* Footer link */}
      <div className="relative z-10 pb-12 text-center">
        <Link to="/" className="text-sm text-white/30 hover:text-white/50 transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
