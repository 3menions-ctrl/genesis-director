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
        <p className="text-muted-foreground mb-8">Last updated: January 5, 2026</p>
        
        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p>
              Apex Studio ("we," "our," or "us") is committed to protecting your privacy. This Privacy 
              Policy explains how we collect, use, disclose, and safeguard your information when you 
              use our AI-powered video generation service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Personal Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Name and email address</li>
              <li>Account credentials</li>
              <li>Payment information (processed securely via third-party providers)</li>
              <li>Profile information you provide</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Usage Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Scripts and content you create</li>
              <li>Generated videos and images</li>
              <li>Reference materials you upload</li>
              <li>Usage patterns and preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Technical Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>IP address and device identifiers</li>
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Access times and referring URLs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use collected information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and maintain our Service</li>
              <li>Process your transactions and manage your account</li>
              <li>Generate and store your video content</li>
              <li>Improve our AI models and Service quality</li>
              <li>Send service-related communications</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. AI Model Training</h2>
            <p>
              We may use anonymized and aggregated data to improve our AI models. Your personal content 
              is not used for training purposes without your explicit consent. You can opt out of 
              contributing to model improvements in your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third parties that help us operate our Service (hosting, payment processing, analytics)</li>
              <li><strong>AI Partners:</strong> Technology providers for video generation capabilities</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including encryption 
              in transit and at rest, secure authentication, and regular security audits. However, no 
              method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to 
              provide you services. Generated content is stored according to your account plan. You may 
              request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Your Rights</h2>
            <p className="mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent where applicable</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:privacy@apexstudio.ai" className="text-foreground hover:underline">
                privacy@apexstudio.ai
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your data in accordance with 
              this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Children's Privacy</h2>
            <p>
              Our Service is not directed to individuals under 18 years of age. We do not knowingly 
              collect personal information from children. If we become aware that we have collected 
              data from a child, we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage, and 
              personalize content. You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes 
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <p><strong className="text-foreground">Email:</strong> privacy@apexstudio.ai</p>
              <p><strong className="text-foreground">Address:</strong> Apex Studio, Privacy Team, San Francisco, CA</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
