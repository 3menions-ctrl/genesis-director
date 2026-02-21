import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Building2, ArrowRight, Sparkles, Shield, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Credit pricing: 1 credit = $0.10
const PRICING_TIERS = [
  {
    id: 'mini',
    name: 'Mini',
    description: 'Quick start for new creators',
    price: 9,
    credits: 90,
    videosEstimate: '~9 clips',
    icon: <Star className="w-5 h-5" />,
    features: [
      'HD video export (1080p)',
      'AI-powered script generation',
      'Text-to-video creation',
      'Image-to-video animation',
      'Standard processing queue',
      'Email support',
    ],
    popular: false,
    accent: 'from-sky-400 to-cyan-400',
    borderAccent: 'hover:border-sky-500/30',
    iconBg: 'bg-sky-500/10 text-sky-400',
    btnClass: 'bg-white/[0.06] hover:bg-sky-500/20 text-white border border-white/[0.08] hover:border-sky-500/30',
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for trying out the platform',
    price: 37,
    credits: 370,
    videosEstimate: '~37 clips',
    icon: <Zap className="w-5 h-5" />,
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
    accent: 'from-violet-400 to-purple-500',
    borderAccent: 'hover:border-violet-500/30',
    iconBg: 'bg-violet-500/10 text-violet-400',
    btnClass: 'bg-white/[0.06] hover:bg-violet-500/20 text-white border border-white/[0.08] hover:border-violet-500/30',
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For serious creators and small teams',
    price: 100,
    credits: 1000,
    videosEstimate: '~100 clips',
    icon: <Crown className="w-5 h-5" />,
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
    accent: 'from-amber-300 via-yellow-200 to-amber-400',
    borderAccent: '',
    iconBg: 'bg-black text-white',
    btnClass: 'bg-black hover:bg-black/80 text-white shadow-xl shadow-black/20',
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'For studios and production teams',
    price: 250,
    credits: 2500,
    videosEstimate: '~250 clips',
    icon: <Building2 className="w-5 h-5" />,
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
    accent: 'from-orange-400 to-rose-500',
    borderAccent: 'hover:border-orange-500/30',
    iconBg: 'bg-orange-500/10 text-orange-400',
    btnClass: 'bg-white/[0.06] hover:bg-orange-500/20 text-white border border-white/[0.08] hover:border-orange-500/30',
  },
];

const TRUST_POINTS = [
  { icon: <Shield className="w-5 h-5" />, text: 'Secure payments via Stripe' },
  { icon: <Clock className="w-5 h-5" />, text: 'Credits never expire' },
  { icon: <Sparkles className="w-5 h-5" />, text: 'All sales final - no refunds' },
];

export default function Pricing() {
  const { navigate } = useSafeNavigation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="min-h-screen bg-[#030308] overflow-hidden relative">
      {/* Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#030308]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-violet-600/[0.07] rounded-full blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[400px] bg-fuchsia-600/[0.05] rounded-full blur-[140px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white tracking-tight font-['Sora']">
            APEX-STUDIO
          </Link>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10"
          >
            Sign Up
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/60">Simple, transparent pricing</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6 font-['Sora']">
              <span className="block">Pay once.</span>
              <span className="block bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
                Create forever.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/40 max-w-xl mx-auto mb-4">
              No subscriptions. No hidden fees. Just credits that fuel your creativity.
            </p>

            <p className="text-sm text-white/25 tracking-wide">
              1 credit = $0.10 · 10–15 credits per clip
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING_TIERS.map((tier, index) => {
              const isPopular = tier.popular;

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={cn(
                    "relative group",
                    isPopular ? "lg:-mt-6 lg:mb-6" : ""
                  )}
                >
                  {/* Popular outer glow ring */}
                  {isPopular && (
                    <div className="absolute -inset-px rounded-[28px] bg-gradient-to-b from-amber-400/60 via-yellow-300/30 to-amber-500/10 blur-sm" />
                  )}

                  {/* Card container */}
                  <div
                    className={cn(
                      "relative h-full rounded-[26px] overflow-hidden transition-all duration-500",
                      isPopular
                        ? "bg-gradient-to-b from-[#fffef5] to-white text-black shadow-2xl shadow-amber-500/10"
                        : cn(
                            "bg-white/[0.02] backdrop-blur-sm border border-white/[0.07]",
                            tier.borderAccent,
                            "hover:bg-white/[0.04] hover:shadow-lg hover:shadow-white/[0.02]"
                          )
                    )}
                  >
                    {/* Top accent line */}
                    <div className={cn(
                      "h-[2px] w-full bg-gradient-to-r opacity-60",
                      tier.accent,
                      isPopular && "opacity-100"
                    )} />

                    <div className="p-7 flex flex-col h-full">
                      {/* Popular badge */}
                      {isPopular && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black text-white text-[11px] font-semibold uppercase tracking-wider">
                            <Crown className="w-3 h-3" />
                            Best Value
                          </span>
                        </div>
                      )}

                      {/* Icon */}
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center mb-5",
                        tier.iconBg
                      )}>
                        {tier.icon}
                      </div>

                      {/* Tier info */}
                      <h3 className={cn(
                        "text-xl font-bold mb-1 font-['Sora']",
                        isPopular ? "text-black" : "text-white"
                      )}>
                        {tier.name}
                      </h3>
                      <p className={cn(
                        "text-[13px] leading-relaxed mb-5",
                        isPopular ? "text-black/50" : "text-white/35"
                      )}>
                        {tier.description}
                      </p>

                      {/* Price block */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn(
                            "text-[52px] font-extrabold tracking-tighter leading-none font-['Sora']",
                            isPopular ? "text-black" : "text-white"
                          )}>
                            ${tier.price}
                          </span>
                          <span className={cn(
                            "text-xs font-medium uppercase tracking-wider",
                            isPopular ? "text-black/30" : "text-white/20"
                          )}>
                            once
                          </span>
                        </div>
                        <div className={cn(
                          "mt-3 inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px]",
                          isPopular
                            ? "bg-black/[0.04] text-black/60"
                            : "bg-white/[0.04] text-white/50"
                        )}>
                          <span className="font-semibold">{tier.credits.toLocaleString()} credits</span>
                          <span className={cn(
                            "w-px h-3",
                            isPopular ? "bg-black/10" : "bg-white/10"
                          )} />
                          <span className="opacity-70">{tier.videosEstimate}</span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className={cn(
                        "w-full h-px mb-6",
                        isPopular ? "bg-black/[0.06]" : "bg-white/[0.06]"
                      )} />

                      {/* Features */}
                      <ul className="space-y-2.5 mb-8 flex-1">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <div className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0",
                              isPopular
                                ? "bg-black/[0.06]"
                                : "bg-white/[0.06]"
                            )}>
                              <Check className={cn(
                                "w-2.5 h-2.5",
                                isPopular ? "text-black/70" : "text-white/50"
                              )} />
                            </div>
                            <span className={cn(
                              "text-[13px] leading-relaxed",
                              isPopular ? "text-black/65" : "text-white/50"
                            )}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <Button
                        onClick={() => navigate('/auth?mode=signup')}
                        className={cn(
                          "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300 group/btn",
                          tier.btnClass
                        )}
                      >
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-0.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
              <div key={i} className="flex items-center gap-2.5 text-white/35">
                <span className="text-white/20">{point.icon}</span>
                <span className="text-sm tracking-wide">{point.text}</span>
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
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4 font-['Sora']">
            Questions?
          </h2>
          <p className="text-white/40 mb-8">
            Check our FAQ or reach out to our team.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              asChild
              className="rounded-full border-white/10 text-white hover:bg-white/5"
            >
              <Link to="/#faq">View FAQ</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="rounded-full border-white/10 text-white hover:bg-white/5"
            >
              <Link to="/contact">Contact Sales</Link>
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
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-['Sora']">
            Start creating today
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-md mx-auto">
            Purchase credits and start creating cinematic AI videos today.
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
