import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 13, 2026</p>
        
        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p>
              Apex-studio LLC ("Company," "we," "our," or "us"), a Missouri limited liability company, 
              is committed to protecting your privacy. This Privacy Policy explains how we collect, use, 
              disclose, and safeguard your information when you use our AI-powered video generation 
              software-as-a-service platform, Apex Studio (the "Service").
            </p>
            <p className="mt-4">
              By accessing or using the Service, you agree to this Privacy Policy. If you do not agree 
              with our policies and practices, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Personal Information</h3>
            <p className="mb-2">We collect information that identifies you directly, including:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Name and email address</li>
              <li>Account credentials (username, password hash)</li>
              <li>Payment and billing information (processed securely via third-party payment processors)</li>
              <li>Profile information you choose to provide</li>
              <li>Communications with us (support requests, feedback)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Content and Usage Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Scripts, prompts, and text content you create</li>
              <li>Generated videos, images, and audio files</li>
              <li>Reference materials and images you upload</li>
              <li>Usage patterns, preferences, and feature interactions</li>
              <li>Project metadata and settings</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Technical Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>IP address and approximate geolocation</li>
              <li>Device identifiers and characteristics</li>
              <li>Browser type, version, and settings</li>
              <li>Operating system information</li>
              <li>Access times, pages viewed, and referring URLs</li>
              <li>Error logs and performance data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Legal Bases for Processing (GDPR)</h2>
            <p className="mb-4">
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, 
              we process your personal data based on the following legal grounds:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Contract Performance:</strong> Processing necessary to provide you the Service and fulfill our contractual obligations</li>
              <li><strong>Legitimate Interests:</strong> Processing for our legitimate business interests, such as improving the Service, fraud prevention, and security</li>
              <li><strong>Consent:</strong> Where you have given explicit consent for specific processing activities, such as marketing communications</li>
              <li><strong>Legal Obligation:</strong> Processing necessary to comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. How We Use Your Information</h2>
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Third-Party AI Services and Data Sharing</h2>
            <p className="mb-4">
              Our Service utilizes third-party artificial intelligence providers to generate video content. 
              When you use our Service, your prompts, scripts, and reference materials may be processed 
              by these third-party AI systems:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Google Veo:</strong> Video generation AI service operated by Google LLC, subject to Google's Privacy Policy and Terms of Service</li>
              <li><strong>OpenAI:</strong> Script and text generation services, subject to OpenAI's usage policies</li>
              <li><strong>Other AI Providers:</strong> We may utilize additional AI services as our technology evolves</li>
            </ul>
            <p className="mb-4">
              <strong className="text-foreground">Important Disclosures:</strong>
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. AI Model Training</h2>
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third parties that help us operate the Service, including cloud hosting, payment processing, analytics, and customer support providers</li>
              <li><strong>AI Technology Partners:</strong> Providers of video generation and AI capabilities, subject to appropriate data protection agreements</li>
              <li><strong>Legal Requirements:</strong> When required by law, legal process, or government request, or to protect our rights, property, or safety</li>
              <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, reorganizations, or asset sales, with appropriate notice</li>
              <li><strong>With Your Consent:</strong> In any other circumstances where you have provided explicit consent</li>
            </ul>
            <p className="mt-4 font-medium text-foreground">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. International Data Transfers</h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your own, 
              including the United States where Apex-studio LLC is based. When we transfer data 
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Data Security</h2>
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Data Retention</h2>
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

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Your Rights Under GDPR and Other Laws</h2>
            <p className="mb-4">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Right to Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal information ("right to be forgotten")</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of how we use your data</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests or for direct marketing</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              <li><strong>Right to Lodge a Complaint:</strong> File a complaint with a supervisory authority in your jurisdiction</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                admincole@apex-studio.ai
              </a>. We will respond to your request within 30 days (or as required by applicable law).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. California Privacy Rights (CCPA)</h2>
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
              <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                admincole@apex-studio.ai
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Children's Privacy</h2>
            <p>
              Our Service is available to users 13 years of age and older. Users between 13 and 18 
              must have parental or guardian consent to use the Service. We do not knowingly collect 
              personal information from children under 13. If we become aware that we have collected 
              data from a child under 13, we will take steps to delete such information promptly.
            </p>
            <p className="mt-4">
              If you are a parent or guardian and believe your child under 13 has provided us with 
              personal information, please contact us at{' '}
              <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                admincole@apex-studio.ai
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Cookies and Tracking Technologies</h2>
            <p className="mb-4">
              We use cookies and similar technologies to enhance your experience, analyze usage, and 
              personalize content. Types of cookies we use include:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Service</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertising (with consent where required)</li>
            </ul>
            <p className="mt-4">
              You can manage cookie preferences through your browser settings. Note that disabling 
              certain cookies may affect Service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services that are not owned or 
              controlled by us. We are not responsible for the privacy practices of these third parties. 
              We encourage you to review the privacy policies of any third-party sites you visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">15. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes 
              by posting the new policy on this page, updating the "Last updated" date, and where 
              required by law, providing additional notice (such as email notification). Your continued 
              use of the Service after any changes constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">16. Data Protection Officer</h2>
            <p>
              For GDPR-related inquiries or to contact our data protection representative, please 
              email us at{' '}
              <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                admincole@apex-studio.ai
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">17. Contact Us</h2>
            <p>
              For questions, concerns, or requests regarding this Privacy Policy or our data practices, 
              please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-2">
              <p><strong className="text-foreground">Apex-studio LLC</strong></p>
              <p><strong className="text-foreground">Privacy Inquiries:</strong>{' '}
                <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                  admincole@apex-studio.ai
                </a>
              </p>
              <p><strong className="text-foreground">Legal Inquiries:</strong>{' '}
                <a href="mailto:admincole@apex-studio.ai" className="text-foreground hover:underline">
                  admincole@apex-studio.ai
                </a>
              </p>
              <p><strong className="text-foreground">State of Incorporation:</strong> Missouri, United States</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
