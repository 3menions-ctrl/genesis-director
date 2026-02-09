import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Logo } from "@/components/ui/Logo";

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

const Privacy = () => {
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
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-white/40 mb-12">Last updated: February 5, 2026</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-8 text-white/60"
          >
            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
              <p>
                Apex-Studio LLC ("Company," "we," "our," or "us"), a Missouri limited liability company, 
                is committed to protecting your privacy. This Privacy Policy explains how we collect, use, 
                disclose, and safeguard your information when you use our AI-powered video generation 
                software-as-a-service platform, Apex-Studio (the "Service").
              </p>
              <p className="mt-4">
                By accessing or using the Service, you agree to this Privacy Policy. If you do not agree 
                with our policies and practices, please do not use the Service.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-white mt-4 mb-2">Personal Information</h3>
              <p className="mb-2">We collect information that identifies you directly, including:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Name and email address</li>
                <li>Account credentials (username, password hash)</li>
                <li>Payment and billing information (processed securely via third-party payment processors)</li>
                <li>Profile information you choose to provide</li>
                <li>Communications with us (support requests, feedback)</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">Content and Usage Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Scripts, prompts, and text content you create</li>
                <li>Generated videos, images, and audio files</li>
                <li>Reference materials and images you upload</li>
                <li>Usage patterns, preferences, and feature interactions</li>
                <li>Project metadata and settings</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">Technical Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>IP address and approximate geolocation</li>
                <li>Device identifiers and characteristics</li>
                <li>Browser type, version, and settings</li>
                <li>Operating system information</li>
                <li>Access times, pages viewed, and referring URLs</li>
                <li>Error logs and performance data</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">3. Legal Bases for Processing (GDPR)</h2>
              <p className="mb-4">
                If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, 
                we process your personal data based on the following legal grounds:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Contract Performance:</strong> Processing necessary to provide you the Service and fulfill our contractual obligations</li>
                <li><strong className="text-white">Legitimate Interests:</strong> Processing for our legitimate business interests, such as improving the Service, fraud prevention, and security</li>
                <li><strong className="text-white">Consent:</strong> Where you have given explicit consent for specific processing activities, such as marketing communications</li>
                <li><strong className="text-white">Legal Obligation:</strong> Processing necessary to comply with applicable laws and regulations</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">4. How We Use Your Information</h2>
              <p className="mb-4">We use collected information to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process your transactions and manage your account</li>
                <li>Generate, store, and deliver your video content</li>
                <li>Communicate with you about the Service, updates, and support</li>
                <li>Send marketing communications (with your consent where required)</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect, prevent, and address fraud, abuse, and security issues</li>
                <li>Comply with legal obligations and enforce our Terms of Service</li>
                <li>Respond to legal requests and prevent harm</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">5. Third-Party AI Services and Data Sharing</h2>
              <p className="mb-4">
                Our Service utilizes third-party artificial intelligence providers to generate video content. 
                When you use our Service, your prompts, scripts, and reference materials may be processed 
                by these third-party AI systems:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li><strong className="text-white">Kling AI:</strong> Video generation AI service for creating cinematic video content</li>
                <li><strong className="text-white">OpenAI:</strong> Script and text generation services, subject to OpenAI's usage policies</li>
                <li><strong className="text-white">Other AI Providers:</strong> We may utilize additional AI services as our technology evolves</li>
              </ul>
              <p className="mb-4">
                <strong className="text-white">Important Disclosures:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Third-party AI providers may process your input data on their servers</li>
                <li>We cannot control how third-party providers handle data once transmitted</li>
                <li>Third-party providers have their own data retention and usage policies</li>
                <li>Some providers may use anonymized data for model improvement unless opted out</li>
                <li>AI systems may produce outputs that differ from your inputs or expectations</li>
              </ul>
              <p>
                By using our Service, you consent to the transmission of your content to these third-party 
                AI providers as necessary to deliver our video generation services.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">6. AI Model Training</h2>
              <p className="mb-4">
                We may use anonymized and aggregated data to improve our AI models and Service quality. 
                Regarding your personal content:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your personal content is not used for training our AI models without your explicit consent</li>
                <li>You may opt out of contributing to model improvements in your account settings</li>
                <li>Third-party AI providers we use have their own data handling policies, which we review for compliance</li>
                <li>We implement appropriate safeguards to protect your data during any AI processing</li>
              </ul>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">7. Data Sharing and Disclosure</h2>
              <p className="mb-4">We may share your information with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Service Providers:</strong> Third parties that help us operate the Service, including cloud hosting, payment processing, analytics, and customer support providers</li>
                <li><strong className="text-white">AI Technology Partners:</strong> Providers of video generation and AI capabilities, subject to appropriate data protection agreements</li>
                <li><strong className="text-white">Legal Requirements:</strong> When required by law, legal process, or government request, or to protect our rights, property, or safety</li>
                <li><strong className="text-white">Business Transfers:</strong> In connection with mergers, acquisitions, reorganizations, or asset sales, with appropriate notice</li>
                <li><strong className="text-white">With Your Consent:</strong> In any other circumstances where you have provided explicit consent</li>
              </ul>
              <p className="mt-4 font-medium text-white">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">8. International Data Transfers</h2>
              <p className="mb-4">
                Your information may be transferred to and processed in countries other than your own, 
                including the United States where Apex-Studio LLC is based. When we transfer data 
                internationally, we implement appropriate safeguards, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Standard Contractual Clauses approved by the European Commission</li>
                <li>Data Processing Agreements with our service providers</li>
                <li>Verification that recipients maintain adequate data protection standards</li>
              </ul>
              <p className="mt-4">
                By using the Service, you acknowledge and consent to the transfer of your information 
                to the United States and other countries as described in this policy.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">9. Data Security</h2>
              <p>
                We implement industry-standard technical and organizational security measures to protect 
                your data, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and audits</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
              <p className="mt-4">
                While we strive to protect your personal information, no method of transmission over 
                the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">10. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed 
                to provide you services. Specifically:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Account information is retained until you request deletion</li>
                <li>Generated content is stored according to your account plan and may be deleted after a period of inactivity</li>
                <li>Transaction records are retained as required by applicable tax and financial laws</li>
                <li>Usage logs are typically retained for 12-24 months for analytics and security purposes</li>
              </ul>
              <p className="mt-4">
                You may request deletion of your data at any time by contacting us or using account settings.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">11. Your Rights Under GDPR and Other Laws</h2>
              <p className="mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Right to Access:</strong> Request a copy of the personal information we hold about you</li>
                <li><strong className="text-white">Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong className="text-white">Right to Erasure:</strong> Request deletion of your personal information ("right to be forgotten")</li>
                <li><strong className="text-white">Right to Restrict Processing:</strong> Request limitation of how we use your data</li>
                <li><strong className="text-white">Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong className="text-white">Right to Object:</strong> Object to processing based on legitimate interests or for direct marketing</li>
                <li><strong className="text-white">Right to Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                <li><strong className="text-white">Right to Lodge a Complaint:</strong> File a complaint with a supervisory authority in your jurisdiction</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:admincole@apex-studio.ai" className="text-white hover:underline">
                  admincole@apex-studio.ai
                </a>. We will respond to your request within 30 days (or as required by applicable law).
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">12. California Privacy Rights (CCPA)</h2>
              <p className="mb-4">
                If you are a California resident, you have additional rights under the California Consumer 
                Privacy Act (CCPA):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Right to know what personal information we collect, use, and disclose</li>
                <li>Right to delete personal information we have collected</li>
                <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>Right to non-discrimination for exercising your privacy rights</li>
              </ul>
              <p className="mt-4">
                To exercise your California privacy rights, contact us at{' '}
                <a href="mailto:admincole@apex-studio.ai" className="text-white hover:underline">
                  admincole@apex-studio.ai
                </a>.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">13. Children's Privacy</h2>
              <p>
                Our Service is available to users 13 years of age and older. Users between 13 and 18 
                must have parental or guardian consent to use the Service. We do not knowingly collect 
                personal information from children under 13. If we become aware that we have collected 
                data from a child under 13, we will take steps to delete such information promptly.
              </p>
              <p className="mt-4">
                If you are a parent or guardian and believe your child under 13 has provided us with 
                personal information, please contact us at{' '}
                <a href="mailto:admincole@apex-studio.ai" className="text-white hover:underline">
                  admincole@apex-studio.ai
                </a>.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">14. Cookies and Tracking Technologies</h2>
              <p className="mb-4">
                We use cookies and similar technologies to enhance your experience, analyze usage, and 
                personalize content. Types of cookies we use include:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Essential Cookies:</strong> Required for the Service to function properly</li>
                <li><strong className="text-white">Analytics Cookies:</strong> Help us understand how users interact with the Service</li>
                <li><strong className="text-white">Preference Cookies:</strong> Remember your settings and preferences</li>
                <li><strong className="text-white">Marketing Cookies:</strong> Used to deliver relevant advertising (with consent where required)</li>
              </ul>
              <p className="mt-4">
                You can manage cookie preferences through your browser settings. Note that disabling 
                certain cookies may affect Service functionality.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">15. Third-Party Links</h2>
              <p>
                The Service may contain links to third-party websites or services that are not owned or 
                controlled by us. We are not responsible for the privacy practices of these third parties. 
                We encourage you to review the privacy policies of any third-party sites you visit.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">16. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of material changes 
                by posting the new policy on this page, updating the "Last updated" date, and where 
                required by law, providing additional notice (such as email notification). Your continued 
                use of the Service after any changes constitutes your acceptance of the updated policy.
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-4">17. Contact Information</h2>
              <p className="mb-4">
                For questions, concerns, or requests regarding this Privacy Policy or our data practices, 
                please contact us:
              </p>
              <div className="space-y-2">
                <p><strong className="text-white">Apex-Studio LLC</strong></p>
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

export default Privacy;
