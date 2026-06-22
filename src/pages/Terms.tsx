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
    id: "acceptance",
    title: "Acceptance & Eligibility",
    body: (
      <>
        <p>
          These Terms of Service ("Terms") form a binding agreement between you and{" "}
          <strong className="text-white">Small Bridges-studio LLC</strong>, a Missouri limited
          liability company ("Small Bridges," "we," "our," or "us"), and govern your access to and
          use of the Small Bridges website, applications, and AI cinematic video-creation services
          (collectively, the "Service"). By creating an account, purchasing credits, or otherwise
          using the Service, you accept these Terms and our{" "}
          <Link to="/privacy" className="text-white underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
        <p>
          You must be at least 18 years of age, or the age of majority in your jurisdiction if
          higher, to use the Service. By using the Service you represent and warrant that you meet
          this requirement, that you have the legal capacity to enter into these Terms, and that you
          are not barred from using the Service under any applicable law. If you accept these Terms
          on behalf of a company or other organization, you represent that you have authority to bind
          that entity, and "you" refers to that entity.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts & Security",
    body: (
      <>
        <p>
          To use most features you must register an account and provide accurate, current, and
          complete information. You are responsible for safeguarding your login credentials and for
          all activity that occurs under your account. You agree to notify us promptly at{" "}
          <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>{" "}
          of any unauthorized use or suspected security breach.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>Keep your contact and billing details up to date.</li>
          <li>Do not share, sell, or transfer your account or credits to others.</li>
          <li>You are responsible for any losses arising from unauthorized use of your account.</li>
          <li>We may suspend or restrict accounts to protect the Service, our users, or our rights.</li>
        </ul>
      </>
    ),
  },
  {
    id: "service",
    title: "Description of the Service",
    body: (
      <>
        <p>
          Small Bridges is a software-as-a-service platform that lets you generate short cinematic
          video clips, images, scripts, and related media using artificial-intelligence models. The
          Service composes your text prompts and any material you provide, sends them to
          third-party model hosts for generation, and returns the resulting outputs ("Outputs") to
          your account. Features, models, generation limits, and pricing may change, evolve, or be
          discontinued over time.
        </p>
        <p>
          The Service depends on third-party model providers and infrastructure. Availability,
          generation speed, and output characteristics may vary and are not guaranteed.
        </p>
      </>
    ),
  },
  {
    id: "billing",
    title: "Billing, Credits & Subscriptions",
    body: (
      <>
        <p>
          The Service uses a usage-based model. You may purchase{" "}
          <strong className="text-white">pay-as-you-go credits</strong> and/or enroll in an optional{" "}
          <strong className="text-white">monthly subscription plan</strong>. Generating media
          consumes credits at the rates shown in the app at the time of generation, which depend on
          the engine, resolution, and clip length you select.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>
            <strong className="text-white">Free first clip.</strong> Your first 5-second video on the
            Wan engine is free. This one-time promotion may be modified or withdrawn at any time and
            does not apply to other engines, lengths, or features.
          </li>
          <li>
            <strong className="text-white">Credits are non-refundable.</strong> Except where a refund
            is required by applicable law, all credit purchases are final, and credits have no cash
            value and cannot be exchanged or transferred. Credits are consumed when a generation is
            submitted, even if you are dissatisfied with an Output.
          </li>
          <li>
            <strong className="text-white">Subscriptions renew automatically.</strong> Subscription
            plans renew at the then-current price for successive billing periods until you cancel.
            You may cancel at any time from your account settings; cancellation stops future renewals
            and takes effect at the end of the current paid period. Unless required by law, fees
            already paid are not refunded.
          </li>
          <li>
            <strong className="text-white">Taxes & pricing changes.</strong> Prices are exclusive of
            applicable taxes, which you are responsible for. We may change prices, plan features, or
            credit costs prospectively with reasonable notice.
          </li>
          <li>
            <strong className="text-white">Payment processing.</strong> Payments are processed by our
            payment provider, Polar. We do not store full card details. You authorize us and Polar to
            charge your selected payment method for amounts you incur.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    body: (
      <>
        <p>You agree not to use the Service to create, upload, or distribute content that:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>Is illegal, or that promotes or facilitates illegal activity;</li>
          <li>
            Depicts a real, identifiable person without their consent, including non-consensual
            likenesses, deepfakes, or impersonation intended to deceive;
          </li>
          <li>
            Constitutes child sexual abuse material (CSAM) or sexualizes minors in any form — such
            content is strictly prohibited and may be reported to authorities;
          </li>
          <li>Infringes the intellectual-property, privacy, or publicity rights of any third party;</li>
          <li>Harasses, threatens, defames, or incites violence or hatred against any person or group;</li>
          <li>
            Is intimate or sexually explicit imagery of real individuals created or shared without
            consent;
          </li>
          <li>Contains malware, or is used to spam, phish, or defraud;</li>
          <li>
            Attempts to reverse-engineer, decompile, extract, or replicate the underlying models,
            weights, or prompts, or to circumvent usage limits, safety systems, or rate limits.
          </li>
        </ul>
        <p>
          You are responsible for your Outputs and their downstream use. We may remove content,
          throttle, suspend, or terminate accounts that we reasonably believe violate this section,
          and we may cooperate with law enforcement where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "user-content",
    title: "User Content & Ownership",
    body: (
      <>
        <p>
          As between you and Small Bridges, and subject to the terms of the third-party model and
          infrastructure providers that generate your media, you retain the rights you hold in the
          prompts, reference materials, and other inputs you provide ("Inputs") and in the Outputs
          you generate. You are solely responsible for your Inputs, including ensuring you have all
          rights necessary to any material you upload or reference.
        </p>
        <p>
          You grant Small Bridges a worldwide, non-exclusive, royalty-free license to host, store,
          reproduce, transmit, process, and display your Inputs and Outputs solely as needed to
          operate, secure, support, and improve the Service, to comply with law, and to enforce
          these Terms. We may generate anonymized, aggregated, or de-identified statistics about
          usage that do not identify you.
        </p>
        <p>
          Because generative models can produce similar results for different users, we cannot grant
          you exclusive rights in any Output, and ownership or protectability of AI-generated content
          may be limited under applicable law.
        </p>
      </>
    ),
  },
  {
    id: "ai-disclaimer",
    title: "AI-Generated Content Disclaimer",
    body: (
      <>
        <p>
          The Service uses artificial intelligence, which is probabilistic by nature. Outputs may be
          inaccurate, misleading, offensive, or contain visual artifacts, and may resemble content
          produced for other users or existing works. We make no guarantee that any Output is unique,
          original, non-infringing, accurate, or fit for any particular purpose.
        </p>
        <p>
          You are responsible for reviewing and verifying Outputs before relying on, publishing, or
          distributing them, including obtaining any clearances or disclosures required for
          AI-generated or synthetic media in your jurisdiction. Do not rely on Outputs as
          professional, legal, medical, or financial advice.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-Party Providers",
    body: (
      <>
        <p>
          Generation is performed by third-party model hosts, including Replicate, and payments are
          handled by Polar. Other providers support hosting, email, authentication, and storage. Your
          use of the Service therefore involves transmitting Inputs and Outputs to these providers,
          whose own terms and policies apply to their processing. We are not responsible for the acts
          or omissions of third-party providers, and their services may change or become unavailable.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual Property",
    body: (
      <>
        <p>
          The Service itself — including its software, interface, branding, trademarks, and
          underlying technology — is owned by Small Bridges-studio LLC or its licensors and is
          protected by intellectual-property laws. Except for the rights expressly granted to you in
          these Terms, we reserve all rights. You may not use our name, logo, or trademarks without
          our prior written permission.
        </p>
      </>
    ),
  },
  {
    id: "dmca",
    title: "DMCA & Copyright Complaints",
    body: (
      <>
        <p>
          We respect intellectual-property rights and respond to notices of alleged infringement that
          comply with the Digital Millennium Copyright Act, 17 U.S.C. § 512. If you believe content on
          the Service infringes a copyright you own or control, send a written notice to{" "}
          <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>{" "}
          that includes:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
          <li>Identification of the copyrighted work claimed to be infringed;</li>
          <li>Identification of the allegedly infringing material and where it is located;</li>
          <li>Your name, address, telephone number, and email;</li>
          <li>A statement of good-faith belief that the use is not authorized;</li>
          <li>
            A statement, under penalty of perjury, that the information is accurate and that you are
            authorized to act on the rights holder's behalf;
          </li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <p>
          We may remove infringing material and terminate repeat infringers. Submitting a knowingly
          false notice may expose you to liability under 17 U.S.C. § 512(f).
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "Disclaimer of Warranties",
    body: (
      <p>
        THE SERVICE AND ALL OUTPUTS ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF
        ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, THAT OUTPUTS WILL BE ACCURATE, UNIQUE,
        OR NON-INFRINGING, OR THAT DEFECTS WILL BE CORRECTED. SOME JURISDICTIONS DO NOT ALLOW CERTAIN
        DISCLAIMERS, SO PARTS OF THIS SECTION MAY NOT APPLY TO YOU.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    body: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SMALL BRIDGES-STUDIO LLC AND ITS OFFICERS,
          MEMBERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA,
          GOODWILL, OR BUSINESS, ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS, EVEN IF
          ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE
          GREATER OF (A) THE AMOUNTS YOU PAID US IN THE TWELVE (12) MONTHS IMMEDIATELY BEFORE THE
          EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). THESE LIMITS APPLY
          IN THE AGGREGATE AND ARE A FUNDAMENTAL BASIS OF OUR BARGAIN.
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    title: "Indemnification",
    body: (
      <p>
        You agree to indemnify, defend, and hold harmless Small Bridges-studio LLC and its officers,
        members, employees, and agents from and against any claims, damages, liabilities, losses, and
        expenses (including reasonable attorneys' fees) arising out of or related to: (a) your Inputs
        or Outputs; (b) your use of the Service; (c) your violation of these Terms or any law; or
        (d) your infringement or misappropriation of any third-party right.
      </p>
    ),
  },
  {
    id: "arbitration",
    title: "Binding Arbitration & Class-Action Waiver",
    body: (
      <>
        <p className="text-white/80">
          PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO
          SUE IN COURT AND TO HAVE A JURY TRIAL.
        </p>
        <p>
          You and Small Bridges agree that any dispute, claim, or controversy arising out of or
          relating to these Terms or the Service will be resolved exclusively by binding individual
          arbitration administered by the American Arbitration Association under its applicable rules,
          rather than in court, except that either party may bring an individual action in small-claims
          court or seek injunctive relief to protect intellectual-property rights. The arbitration
          will be seated in the State of Missouri, U.S., and these Terms and the arbitration are
          governed by the Federal Arbitration Act.
        </p>
        <p className="text-white/80">
          CLASS-ACTION WAIVER. YOU AND SMALL BRIDGES AGREE THAT EACH MAY BRING CLAIMS ONLY IN AN
          INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS, COLLECTIVE,
          CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE CLAIMS OR
          PRESIDE OVER ANY FORM OF CLASS PROCEEDING.
        </p>
        <p>
          <strong className="text-white">Opt-out.</strong> You may opt out of this arbitration
          agreement by emailing{" "}
          <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>{" "}
          within 30 days of first accepting these Terms, stating your name and a clear intent to opt
          out. Opting out does not affect any other part of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law",
    body: (
      <p>
        These Terms are governed by the laws of the State of Missouri, U.S., without regard to its
        conflict-of-laws rules. Subject to the arbitration section above, any dispute not subject to
        arbitration will be brought exclusively in the state or federal courts located in the State
        of Missouri, and you consent to their jurisdiction.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    body: (
      <p>
        You may stop using the Service and close your account at any time. We may suspend or terminate
        your access, with or without notice, if you violate these Terms, if required by law, or to
        protect the Service or its users. Upon termination, your right to use the Service ceases.
        Sections that by their nature should survive — including ownership, disclaimers, limitation of
        liability, indemnification, arbitration, and governing law — will survive.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    body: (
      <p>
        We may update these Terms from time to time. When we make material changes, we will update the
        "Last updated" date and, where appropriate, provide additional notice. Changes are effective
        when posted. Your continued use of the Service after changes take effect constitutes
        acceptance of the revised Terms.
      </p>
    ),
  },
  {
    id: "misc",
    title: "Miscellaneous",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
        <li>
          <strong className="text-white">Entire agreement.</strong> These Terms and the Privacy Policy
          are the entire agreement between you and us regarding the Service and supersede prior
          agreements.
        </li>
        <li>
          <strong className="text-white">Severability.</strong> If any provision is held
          unenforceable, it will be limited or removed to the minimum extent necessary, and the rest
          remains in effect.
        </li>
        <li>
          <strong className="text-white">No waiver.</strong> Our failure to enforce a provision is not
          a waiver of it.
        </li>
        <li>
          <strong className="text-white">Assignment.</strong> You may not assign these Terms without
          our consent; we may assign them in connection with a merger, acquisition, or sale of assets.
        </li>
        <li>
          <strong className="text-white">Force majeure.</strong> We are not liable for delays or
          failures caused by events beyond our reasonable control, including provider outages.
        </li>
        <li>
          <strong className="text-white">Electronic communications & export.</strong> You consent to
          receive notices electronically, and you agree to comply with applicable export-control and
          sanctions laws.
        </li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <div className="space-y-1">
        <p>Questions about these Terms? Reach us at:</p>
        <p className="text-white">Small Bridges-studio LLC</p>
        <p>State of Missouri, U.S.</p>
        <p>
          <a href={`mailto:${EMAIL}`} className="text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>
        </p>
      </div>
    ),
  },
];

const Terms = () => {
  usePageMeta({
    title: "Terms of Service — Small Bridges | AI Cinematic Video Creation",
    description:
      "The Terms of Service for Small Bridges, the AI cinematic video-creation platform: accounts, pay-as-you-go credits and subscriptions, acceptable use, content ownership, AI disclaimers, arbitration, and more.",
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
              accentKey="terms"
              eyebrow="Legal"
              title="Terms of Service"
              subtitle="The agreement that governs how you create, own, and share AI cinematic video with Small Bridges."
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

export default Terms;
