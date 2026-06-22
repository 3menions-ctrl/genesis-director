import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { lazy, Suspense, type ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { PageHero } from "@/components/page/PageHero";
import { usePageMeta } from "@/hooks/usePageMeta";

const AbstractBackground = lazy(() => import("@/components/landing/AbstractBackground"));

const EMAIL = "cole@smallbridges.co";

const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        <p>
          <strong className="text-white">Small Bridges-studio LLC</strong>, a Missouri limited
          liability company ("Small Bridges," "we," "our," or "us"), operates the Small Bridges AI
          cinematic video-creation platform (the "Service"). This Privacy Policy explains what
          personal information we collect, how and why we use it, who we share it with, and the
          choices and rights you have. It applies to the Service and to people who visit our site,
          create an account, or generate media with us.
        </p>
        <p>
          By using the Service you agree to this Policy. If you do not agree, please do not use the
          Service.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data We Collect",
    body: (
      <>
        <p>We collect the following categories of information:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>
            <strong className="text-white">Account information.</strong> Your name, email address, and
            authentication details when you register or sign in.
          </li>
          <li>
            <strong className="text-white">Prompts & generated content.</strong> The text prompts,
            reference images or files you provide ("Inputs") and the videos, images, scripts, and
            other media you generate ("Outputs"), together with related project metadata.
          </li>
          <li>
            <strong className="text-white">Usage & analytics data.</strong> How you interact with the
            Service — features used, generations requested, pages viewed — plus device, browser, IP
            address, approximate location, and log and diagnostic data.
          </li>
          <li>
            <strong className="text-white">Payment data.</strong> When you buy credits or subscribe,
            payment is processed by Polar. We receive limited transaction details (such as plan,
            amount, status, and the last digits of your card) but do not store your full card number.
          </li>
          <li>
            <strong className="text-white">Communications.</strong> Messages you send us for support,
            feedback, or other inquiries.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How We Use Your Data",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
        <li>Provide, operate, secure, and maintain the Service and generate your media;</li>
        <li>Process payments, manage credits and subscriptions, and prevent fraud and abuse;</li>
        <li>Provide customer support and respond to your requests;</li>
        <li>Understand usage and improve the Service's quality, reliability, and features;</li>
        <li>Send service and transactional messages, and — with your consent where required — updates and marketing;</li>
        <li>Enforce our Terms, comply with legal obligations, and protect our rights and users.</li>
      </ul>
    ),
  },
  {
    id: "legal-bases",
    title: "Legal Bases (GDPR)",
    body: (
      <>
        <p>
          If you are in the European Economic Area, the United Kingdom, or Switzerland, we process
          your personal data on these legal bases:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>
            <strong className="text-white">Performance of a contract</strong> — to provide the Service
            you request and manage your account and billing;
          </li>
          <li>
            <strong className="text-white">Legitimate interests</strong> — to secure, analyze, and
            improve the Service and prevent abuse, balanced against your rights;
          </li>
          <li>
            <strong className="text-white">Consent</strong> — for optional marketing and any
            non-essential cookies, which you may withdraw at any time;
          </li>
          <li>
            <strong className="text-white">Legal obligation</strong> — to comply with tax, accounting,
            and other laws.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "processors",
    title: "Service Providers & Sub-Processors",
    body: (
      <>
        <p>
          We share data with a small set of vetted providers who process it on our behalf, under
          contractual confidentiality and data-protection obligations, only to deliver the Service:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>
            <strong className="text-white">Supabase</strong> — database, storage, and authentication;
          </li>
          <li>
            <strong className="text-white">Replicate</strong> — third-party model hosting that
            generates your video and image Outputs from your Inputs;
          </li>
          <li>
            <strong className="text-white">Polar</strong> — payment processing for credits and
            subscriptions;
          </li>
          <li>
            <strong className="text-white">Resend</strong> — transactional and account email delivery;
          </li>
          <li>
            <strong className="text-white">Vercel</strong> — application hosting and content delivery.
          </li>
        </ul>
        <p>
          These providers act as our processors and have their own privacy and security practices. We
          do not sell your personal information. We may also disclose data when required by law, to
          enforce our Terms, to protect rights and safety, or in connection with a merger,
          acquisition, or sale of assets (with notice where required).
        </p>
      </>
    ),
  },
  {
    id: "ai-training",
    title: "AI Training",
    body: (
      <p className="text-white/80">
        We do <strong className="text-white">not</strong> use your prompts, Inputs, or generated
        Outputs to train, fine-tune, or develop foundation AI models, and we do not sell or share
        them for others to do so. Your content is processed only to deliver the Service to you. We
        may use aggregated, de-identified usage statistics that do not identify you or reveal your
        content to understand and improve how the Service performs.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    body: (
      <>
        <p>
          We use cookies and similar technologies that are strictly necessary to run the Service
          (such as keeping you signed in), and limited analytics to understand usage and improve
          performance. We do not use cookies to sell your data or for cross-context behavioral
          advertising.
        </p>
        <p>
          You can control non-essential cookies through your browser settings; disabling some cookies
          may affect functionality. We honor recognized Global Privacy Control (GPC) signals as a
          valid opt-out where such a right applies.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Data Retention",
    body: (
      <>
        <p>
          We keep personal data only as long as needed for the purposes described here:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>Account information — for the life of your account, until you ask us to delete it;</li>
          <li>Prompts and generated content — while your account is active; you can delete projects from the app;</li>
          <li>Payment and transaction records — as required by tax and accounting laws;</li>
          <li>Logs and analytics — for a limited period for security and diagnostics, then deleted or anonymized.</li>
        </ul>
        <p>When you delete your account, we delete or anonymize your personal data except where we must retain it by law.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use industry-standard technical and organizational measures to protect your data,
        including encryption in transit (TLS), encryption at rest, access controls, and least-privilege
        practices through our infrastructure providers. No method of transmission or storage is
        completely secure, so we cannot guarantee absolute security, but we work to protect your
        information and to respond promptly to any incident.
      </p>
    ),
  },
  {
    id: "gdpr-rights",
    title: "Your Rights (GDPR/UK)",
    body: (
      <>
        <p>
          If you are in the EEA, UK, or Switzerland, you have the right to:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li><strong className="text-white">Access</strong> the personal data we hold about you;</li>
          <li><strong className="text-white">Rectify</strong> inaccurate or incomplete data;</li>
          <li><strong className="text-white">Erase</strong> your data ("right to be forgotten");</li>
          <li><strong className="text-white">Port</strong> your data in a structured, machine-readable format;</li>
          <li><strong className="text-white">Object to or restrict</strong> certain processing, and withdraw consent;</li>
          <li><strong className="text-white">Complain</strong> to your local data-protection supervisory authority.</li>
        </ul>
        <p>
          We do not make decisions producing legal or similarly significant effects about you based
          solely on automated processing. To exercise any right, contact us using the details below.
        </p>
      </>
    ),
  },
  {
    id: "california-rights",
    title: "California Rights (CCPA/CPRA)",
    body: (
      <>
        <p>If you are a California resident, you have the right to:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li><strong className="text-white">Know</strong> what personal information we collect, use, and disclose;</li>
          <li><strong className="text-white">Delete</strong> personal information we have collected, subject to exceptions;</li>
          <li><strong className="text-white">Correct</strong> inaccurate personal information;</li>
          <li><strong className="text-white">Opt out</strong> of the "sale" or "sharing" of personal information; and</li>
          <li><strong className="text-white">Non-discrimination</strong> for exercising your rights.</li>
        </ul>
        <p className="text-white/80">
          Small Bridges does <strong className="text-white">not</strong> sell your personal
          information, and we do not "share" it for cross-context behavioral advertising as those
          terms are defined under the CCPA/CPRA. You may exercise your rights using the contact
          details below; we will not discriminate against you for doing so.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children's Privacy",
    body: (
      <p>
        The Service is not directed to children. We do not knowingly collect personal information
        from anyone under 13, and where a higher age applies (for example, under 16 in parts of the
        EEA/UK) we apply that standard. Account holders must meet the age requirements in our Terms.
        If you believe a child has provided us personal information, contact us and we will delete it
        promptly.
      </p>
    ),
  },
  {
    id: "international",
    title: "International Transfers",
    body: (
      <p>
        We are based in the United States, and our providers may process data in the U.S. and other
        countries. When we transfer personal data from the EEA, UK, or Switzerland, we rely on
        appropriate safeguards such as the European Commission's Standard Contractual Clauses and
        equivalent mechanisms, and we require our providers to maintain adequate protection. By using
        the Service, you understand your data may be processed in these countries.
      </p>
    ),
  },
  {
    id: "your-choices",
    title: "Exercising Your Rights & Contact",
    body: (
      <>
        <p>
          To exercise any privacy right, or with questions about this Policy, email us at{" "}
          <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>
          . We will verify your request and respond within the timeframe required by applicable law.
          You may also manage and delete much of your data directly from your account settings.
        </p>
        <div className="space-y-1">
          <p className="text-white">Small Bridges-studio LLC</p>
          <p>State of Missouri, U.S.</p>
          <p>
            <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
              {EMAIL}
            </a>
          </p>
        </div>
      </>
    ),
  },
  {
    id: "updates",
    title: "Updates to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we will
        update the "Last updated" date and, where appropriate, provide additional notice. Changes take
        effect when posted, and your continued use of the Service afterward constitutes acceptance of
        the updated Policy.
      </p>
    ),
  },
];

const Privacy = () => {
  usePageMeta({
    title: "Privacy Policy — Small Bridges | AI Cinematic Video Creation",
    description:
      "How Small Bridges collects, uses, and protects your data: account info, prompts and generated content, processors (Supabase, Polar, Replicate, Resend, Vercel), GDPR and CCPA rights, and our no-AI-training, no-sale commitments.",
  });

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" showText textClassName="text-base" />
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PageHero
              accentKey="privacy"
              eyebrow="Legal"
              title="Privacy Policy"
              subtitle="What we collect, why we collect it, and the control you keep over your data — including our promise never to train foundation models on your work."
              meta="Last updated June 22, 2026"
              className="mb-12"
            />
          </motion.div>

          {/* Table of contents */}
          <nav
            aria-label="Table of contents"
            className="mb-14 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/40 mb-4">
              On this page
            </div>
            <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="group flex gap-3 text-white/60 hover:text-white transition-colors"
                  >
                    <span className="tabular-nums text-white/30 group-hover:text-white/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Sections */}
          <div className="divide-y divide-white/[0.06]">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28 py-10 first:pt-0">
                <h2 className="flex items-baseline gap-3 text-xl sm:text-2xl font-semibold text-white mb-5 tracking-tight">
                  <span className="tabular-nums text-sm font-mono text-white/30 pt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </h2>
                <div className="space-y-4 text-[15px] leading-7 text-white/70 [&_strong]:font-semibold">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 text-xs text-white/35">
            © {new Date().getFullYear()} Small Bridges-studio LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
