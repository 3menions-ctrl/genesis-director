import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Logo } from "@/components/ui/Logo";

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Abstract Background */}
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
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-white/40 mb-12">Last updated: February 5, 2026</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-8 text-white/60"
          >
            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Apex Studio ("Service"), operated by Apex-studio LLC, a Missouri 
                limited liability company ("Company," "we," "our," or "us"), you accept and agree to be 
                bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must 
                not access or use the Service.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="mb-4">
                Apex Studio is a software-as-a-service (SaaS) platform that provides AI-powered video 
                generation tools allowing users to create, edit, and produce video content using artificial 
                intelligence technology. The Service includes script generation, scene creation, video 
                synthesis, and related features accessible via subscription or credit-based access.
              </p>
              <p className="mb-4">
                <strong className="text-white">Third-Party AI Services:</strong> Our Service utilizes 
                third-party artificial intelligence providers, including but not limited to Kling AI 
                (video generation), OpenAI, and other AI technology partners. These third-party services 
                operate under their own terms and policies. By using our Service, you acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>AI-generated content is created by third-party systems over which we have limited control</li>
                <li>AI outputs may contain inaccuracies, errors, artifacts, or unexpected results ("hallucinations")</li>
                <li>Generated content should be reviewed before use, especially for commercial or public distribution</li>
                <li>We do not guarantee the accuracy, completeness, or suitability of AI-generated outputs</li>
                <li>Third-party AI providers may modify, update, or discontinue their services without notice</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">3. Eligibility and Age Requirements</h2>
              <p className="mb-4">
                You must be at least 13 years of age to use this Service. If you are between 13 and 18 
                years of age, you may only use the Service with the consent and supervision of a parent 
                or legal guardian who agrees to be bound by these Terms. By using the Service, you 
                represent and warrant that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are at least 13 years of age</li>
                <li>If under 18, your parent or legal guardian has consented to your use of the Service</li>
                <li>You have the legal capacity to enter into a binding agreement</li>
                <li>Your use of the Service does not violate any applicable law or regulation</li>
              </ul>
              <p className="mt-4">
                Parents and guardians are responsible for monitoring their minor children's use of the 
                Service and are fully responsible for any activities conducted by minors under their care.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">4. User Accounts</h2>
              <p className="mb-4">
                To access certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security and confidentiality of your account credentials</li>
                <li>Immediately notify us of any unauthorized use of your account</li>
                <li>Accept full responsibility for all activities that occur under your account</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">5. Credits and Payments</h2>
              <p className="mb-4">
                The Service operates on a credit-based payment model. By purchasing credits, you expressly 
                acknowledge and agree to the following terms:
              </p>
              <p className="mb-4 p-4 bg-white/[0.03] rounded-xl border border-white/[0.1]">
                <strong className="text-white">IMPORTANT - NO REFUND POLICY:</strong> ALL CREDIT PURCHASES 
                ARE FINAL AND NON-REFUNDABLE. Credits cannot be refunded, transferred, or exchanged for cash 
                once purchased. This policy applies regardless of whether credits have been used or remain 
                unused in your account. By completing a purchase, you waive any right to a refund except 
                where prohibited by applicable law.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Non-Refundable:</strong> All credit purchases are final sales. No refunds will be issued for any reason, including but not limited to: unused credits, dissatisfaction with AI-generated results, account termination, or service changes</li>
                <li><strong className="text-white">No Expiration:</strong> Purchased credits do not expire and remain in your account indefinitely while your account is active</li>
                <li><strong className="text-white">Credit Pricing:</strong> Each credit is valued at $0.10 USD. Video generation costs 10-15 credits per clip depending on duration (≤6 seconds: 10 credits; &gt;6 seconds: 15 credits)</li>
                <li><strong className="text-white">Account Responsibility:</strong> You are solely responsible for all charges incurred under your account</li>
                <li><strong className="text-white">Payment Processing:</strong> All payments are processed securely by Stripe. We do not store your payment card details</li>
                <li><strong className="text-white">Price Changes:</strong> Pricing and credit packages are subject to change with reasonable notice. Changes will not affect previously purchased credits</li>
              </ul>
              <p className="mt-4 text-white/80">
                BY PURCHASING CREDITS, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO THIS 
                NO-REFUND POLICY. IF YOU DO NOT AGREE, DO NOT PURCHASE CREDITS.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">6. User Content</h2>
              <p className="mb-4">
                You retain ownership of original content you create using our Service, subject to any 
                underlying third-party rights. By using the Service, you grant us a non-exclusive, 
                worldwide, royalty-free license to use, store, reproduce, and process your content 
                as necessary to provide and improve the Service. You are solely responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The legality of all content you create or upload</li>
                <li>Ensuring you have all necessary rights to any input materials</li>
                <li>Compliance with all applicable laws and regulations</li>
                <li>Obtaining proper clearances for any recognizable persons, trademarks, or copyrighted material</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">7. Prohibited Uses</h2>
              <p className="mb-4">You agree not to use the Service to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Create content that is illegal, harmful, threatening, abusive, or violates third-party rights</li>
                <li>Generate deepfakes or manipulated media intended to deceive without clear disclosure</li>
                <li>Create non-consensual intimate imagery of real individuals</li>
                <li>Harass, stalk, defame, or harm any person</li>
                <li>Impersonate any person or entity without authorization</li>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Attempt to reverse engineer, decompile, or exploit the Service</li>
                <li>Create content depicting minors in sexual, violent, or otherwise inappropriate contexts</li>
                <li>Distribute malware or engage in any activity that could harm the Service or its users</li>
                <li>Use the Service for any commercial purpose that violates these Terms</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">8. Intellectual Property</h2>
              <p>
                The Service, including its original content, features, functionality, AI models, algorithms, 
                software, and technology, is owned by Apex-studio LLC and is protected by United States and 
                international copyright, trademark, patent, trade secret, and other intellectual property laws. 
                Our trademarks and trade dress may not be used without our prior written permission.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">9. GDPR and International Users</h2>
              <p className="mb-4">
                If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, 
                you have certain rights under the General Data Protection Regulation (GDPR) and applicable 
                data protection laws. Please refer to our{' '}
                <Link to="/privacy" className="text-white hover:underline">Privacy Policy</Link>
                {' '}for detailed information about:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The legal bases for processing your personal data</li>
                <li>Your rights to access, rectify, erase, and port your data</li>
                <li>Your right to object to or restrict processing</li>
                <li>How to lodge a complaint with a supervisory authority</li>
                <li>International data transfers and safeguards</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">10. Third-Party AI Technology Disclaimer</h2>
              <p className="mb-4">
                <strong className="text-white">IMPORTANT NOTICE REGARDING AI-GENERATED CONTENT:</strong>
              </p>
              <p className="mb-4">
                Our Service relies on third-party artificial intelligence technologies, including Kling AI 
                and other AI providers, to generate video content. You expressly acknowledge and agree that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>AI systems may produce inaccurate, misleading, or nonsensical outputs ("hallucinations")</li>
                <li>Generated content may not accurately represent real people, places, events, or facts</li>
                <li>Visual artifacts, inconsistencies, or errors may appear in generated videos</li>
                <li>AI-generated content should not be relied upon for factual accuracy without independent verification</li>
                <li>We have no control over the internal workings of third-party AI systems</li>
                <li>Third-party AI services may be subject to their own content policies and restrictions</li>
                <li>Service availability depends on third-party providers and may be interrupted without notice</li>
              </ul>
              <p className="text-white/80">
                YOU ARE SOLELY RESPONSIBLE FOR REVIEWING, VERIFYING, AND APPROVING ALL AI-GENERATED 
                CONTENT BEFORE USE. WE DISCLAIM ALL LIABILITY FOR ANY DAMAGES ARISING FROM RELIANCE 
                ON AI-GENERATED CONTENT WITHOUT PROPER VERIFICATION.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">11. Disclaimer of Warranties</h2>
              <p className="mb-4 text-white/80">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF 
                ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES 
                OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. 
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT 
                DEFECTS WILL BE CORRECTED.
              </p>
              <p className="mb-4">
                WITHOUT LIMITING THE FOREGOING, WE MAKE NO WARRANTIES OR REPRESENTATIONS REGARDING:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>The accuracy, reliability, or quality of AI-generated content</li>
                <li>The availability or performance of third-party AI services</li>
                <li>The suitability of generated content for any particular purpose</li>
                <li>The non-infringement of third-party rights by AI-generated content</li>
                <li>The consistency or predictability of AI outputs</li>
              </ul>
              <p className="text-white/80">
                AI-GENERATED CONTENT MAY CONTAIN ERRORS, INACCURACIES, HALLUCINATIONS, OR INCONSISTENCIES, 
                AND YOU USE SUCH CONTENT ENTIRELY AT YOUR OWN RISK.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">12. Limitation of Liability</h2>
              <p className="mb-4 text-white/80">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL APEX-STUDIO LLC, 
                ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, OR THIRD-PARTY AI TECHNOLOGY 
                PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, 
                OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Loss of profits, revenue, goodwill, or data</li>
                <li>Business interruption or loss of business opportunity</li>
                <li>Inaccurate, misleading, or defective AI-generated content</li>
                <li>Reliance on AI outputs without independent verification</li>
                <li>Third-party claims arising from your use of generated content</li>
                <li>Reputational harm from published AI-generated content</li>
                <li>Interruption or unavailability of third-party AI services</li>
                <li>Any other intangible losses</li>
              </ul>
              <p className="mb-4 text-white/80">
                OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THESE TERMS 
                OR THE SERVICE SHALL NOT EXCEED THE GREATER OF ONE HUNDRED DOLLARS ($100) OR THE 
                AMOUNTS ACTUALLY PAID BY YOU TO US IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING 
                THE CLAIM.
              </p>
              <p>
                SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO 
                SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU. IN SUCH CASES, OUR LIABILITY 
                SHALL BE LIMITED TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">13. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless Apex-studio LLC and its officers, 
                directors, employees, agents, and affiliates from and against any and all claims, 
                damages, losses, costs, and expenses (including reasonable attorneys' fees) arising 
                from or related to: (a) your use of the Service; (b) your violation of these Terms; 
                (c) your violation of any rights of any third party; or (d) any content you create, 
                upload, or distribute through the Service.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">14. Dispute Resolution and Arbitration</h2>
              <p className="mb-4">
                <strong className="text-white">PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, 
                INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.</strong>
              </p>
              <p className="mb-4">
                You and Apex-studio LLC agree that any dispute, claim, or controversy arising out of or 
                relating to these Terms or the Service shall be resolved through binding individual 
                arbitration, rather than in court, except that either party may seek equitable relief 
                in court for infringement or misuse of intellectual property rights.
              </p>
              <p className="mb-4">
                <strong className="text-white">Class Action Waiver:</strong> YOU AND APEX-STUDIO LLC AGREE THAT 
                EACH PARTY MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY 
                AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, 
                OR REPRESENTATIVE ACTION. YOU EXPRESSLY WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION 
                LAWSUIT OR CLASS-WIDE ARBITRATION.
              </p>
              <p className="mb-4">
                Arbitration shall be administered by the American Arbitration Association (AAA) under 
                its Consumer Arbitration Rules. The arbitration will be conducted in the State of Missouri, 
                unless you and we agree otherwise. Each party will be responsible for its own arbitration 
                fees, unless the arbitrator determines that you are entitled to have us pay your fees.
              </p>
              <p>
                <strong className="text-white">Opt-Out Right:</strong> You may opt out of this arbitration 
                provision by sending written notice to admincole@apex-studio.ai within 30 days of first 
                accepting these Terms. Your notice must include your name, address, email, and a clear 
                statement that you wish to opt out of arbitration.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">15. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account and access to the Service at 
                any time, with or without cause or notice, including for violations of these Terms. 
                Upon termination: (a) your right to use the Service will immediately cease; (b) you 
                must cease all use of the Service; and (c) any provisions of these Terms that by their 
                nature should survive termination will survive.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">16. Changes to Terms</h2>
              <p>
                We may update these Terms at any time. We will notify you of material changes by 
                posting the new Terms on the Service and updating the "Last updated" date. Your 
                continued use of the Service after any changes indicates your acceptance of the 
                new Terms.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">17. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the 
                State of Missouri, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">18. Contact Information</h2>
              <p className="mb-4">
                For any questions about these Terms, please contact us:
              </p>
              <div className="space-y-2">
                <p><strong className="text-white">Apex-studio LLC</strong></p>
                <p>Email:{' '}
                  <a href="mailto:admincole@apex-studio.ai" className="text-white hover:underline">
                    admincole@apex-studio.ai
                  </a>
                </p>
              </div>
            </section>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
