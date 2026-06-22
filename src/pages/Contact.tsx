import { ArrowLeft, Mail, Clock, MapPin, Send, Sparkles, LifeBuoy, Handshake, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero } from "@/components/page/PageHero";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

import { usePageMeta } from '@/hooks/usePageMeta';
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

const REACH_CARDS = [
  {
    icon: Mail,
    title: "General",
    body: "Questions about the product, your account, or anything else.",
    email: "cole@smallbridges.co",
  },
  {
    icon: LifeBuoy,
    title: "Support",
    body: "Trouble with a render, billing, or your credits? We'll dig in.",
    email: "cole@smallbridges.co",
  },
  {
    icon: Newspaper,
    title: "Press",
    body: "Interviews, story leads, and brand assets for media coverage.",
    email: "cole@smallbridges.co",
  },
];

const TOPICS = [
  {
    icon: Sparkles,
    title: "Sales & plans",
    body: "Compare plans, talk volume pricing, or scope a rollout for your team.",
  },
  {
    icon: LifeBuoy,
    title: "Product support",
    body: "Hit a snag mid-project? Share the details and we'll help you ship.",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    body: "Integrations, agencies, and co-marketing — let's build something together.",
  },
  {
    icon: Newspaper,
    title: "Press & media",
    body: "Reporting on AI video? Reach out for quotes, demos, and our press kit.",
  },
];

const Contact = () => {
  usePageMeta({
    title: "Contact Small Bridges — Get in Touch",
    description:
      "Contact the Small Bridges team for sales, support, partnerships, or press. Email cole@smallbridges.co or send us a message — we reply within one business day. Based in Missouri, U.S.",
    canonicalPath: "/contact",
  });

  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    name: profile?.display_name || "",
    email: user?.email || "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          source: 'contact',
          user_id: user?.id ?? null,
        });

      if (error) throw error;

      // Notify admin inbox (fire-and-forget — failure must not block the user).
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'admin_contact_message',
            recipientEmail: 'cole@smallbridges.co',
            templateData: {
              fromName: formData.name,
              fromEmail: formData.email,
              subject: formData.subject,
              message: formData.message,
              source: 'contact',
              userId: user?.id ?? null,
              submittedAt: new Date().toISOString(),
            },
          },
        });
      } catch (notifyErr) {
        console.warn('Admin notification failed (message still saved):', notifyErr);
      }

      toast.success("Message sent! We'll reply within one business day.", {
        description: user ? 'Track replies under Settings → Support.' : undefined,
        action: user
          ? { label: 'Open inbox', onClick: () => (window.location.href = '/settings/support') }
          : undefined,
      });
      setFormData({
        name: profile?.display_name || "",
        email: user?.email || "",
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error("Failed to send message. Please try again or email us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <MarketingHeader />
      {/* Abstract Background - same as landing */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-16">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/75 hover:text-white transition-colors mb-10 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
        >
          <PageHero
            accentKey="contact"
            eyebrow="Get in touch"
            title="Contact us"
            subtitle="Whether you're scoping a project, stuck on a render, or writing about AI filmmaking, a real person on the Small Bridges team will read your note and reply within one business day."
          />
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8 mt-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-3"
          >
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-3">
                <Send className="w-5 h-5 text-white/75" />
                Send us a message
              </h2>
              <p className="text-white/60 text-sm mb-6">
                Tell us what you're working on and we'll point you to the right answer.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-white/60 mb-2">
                      Name
                    </label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                      required
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/40 focus:border-white/20 focus:ring-white/10 rounded-xl"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      required
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/40 focus:border-white/20 focus:ring-white/10 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-white/60 mb-2">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="How can we help?"
                    required
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/40 focus:border-white/20 focus:ring-white/10 rounded-xl"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-white/60 mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us more about your inquiry..."
                    rows={5}
                    required
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/40 focus:border-white/20 focus:ring-white/10 rounded-xl resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending…" : "Send Message"}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white mb-5">Reach us directly</h2>

              <div className="space-y-5">
                {REACH_CARDS.map((card) => (
                  <div key={card.title} className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      <card.icon className="w-5 h-5 text-white/55" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white mb-0.5">{card.title}</h3>
                      <p className="text-white/55 text-sm mb-1.5">{card.body}</p>
                      <a
                        href={`mailto:${card.email}`}
                        className="text-white/80 hover:text-white transition-colors text-sm underline-offset-4 hover:underline"
                      >
                        {card.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm space-y-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <Clock className="w-5 h-5 text-white/55" />
                </div>
                <div>
                  <h3 className="font-medium text-white mb-0.5">Response time</h3>
                  <p className="text-white/55 text-sm">
                    We reply to every message within one business day, Monday through Friday.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <MapPin className="w-5 h-5 text-white/55" />
                </div>
                <div>
                  <h3 className="font-medium text-white mb-0.5">Where we are</h3>
                  <p className="text-white/55 text-sm">
                    Small Bridges is based in Missouri, U.S., and works with creators worldwide.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* What to contact us about */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-16"
        >
          <h2 className="text-2xl font-semibold text-white mb-2">What can we help with?</h2>
          <p className="text-white/55 text-sm mb-8 max-w-2xl">
            Not sure where your question fits? Here's how we sort the conversations that come our way — pick the one that's closest and we'll route it from there.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TOPICS.map((topic) => (
              <div
                key={topic.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:border-white/[0.12] transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                  <topic.icon className="w-5 h-5 text-white/70" />
                </div>
                <h3 className="font-medium text-white mb-1.5">{topic.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{topic.body}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
