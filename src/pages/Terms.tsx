import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
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
        
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 5, 2026</p>
        
        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Saga Studio ("Service"), you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by these terms, please do not 
              use this Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p>
              Saga Studio provides an AI-powered video generation platform that allows users to create, 
              edit, and produce video content using artificial intelligence technology. The Service includes 
              script generation, scene creation, video synthesis, and related features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Accounts</h2>
            <p className="mb-4">
              To access certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly notify us of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Credits and Payments</h2>
            <p className="mb-4">
              The Service operates on a credit-based system. Credits are required to generate content and 
              are non-refundable except as required by law. Pricing and credit packages are subject to 
              change with reasonable notice to users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. User Content</h2>
            <p className="mb-4">
              You retain ownership of content you create using our Service. However, you grant us a 
              non-exclusive license to use, store, and process your content as necessary to provide 
              the Service. You are solely responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>The legality of content you create</li>
              <li>Ensuring you have rights to any input materials</li>
              <li>Compliance with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Prohibited Uses</h2>
            <p className="mb-4">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Create content that is illegal, harmful, or violates third-party rights</li>
              <li>Generate deepfakes or misleading content without proper disclosure</li>
              <li>Harass, abuse, or harm others</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Attempt to reverse engineer or exploit the Service</li>
              <li>Create content depicting minors in inappropriate contexts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, and functionality, is owned by 
              Saga Studio and is protected by international copyright, trademark, and other intellectual 
              property laws. Our AI models and technology remain our exclusive property.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" without warranties of any kind, either express or implied. 
              We do not guarantee that the Service will be uninterrupted, secure, or error-free. AI-generated 
              content may contain errors or inconsistencies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Saga Studio shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your account at any time for violations of 
              these Terms. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material 
              changes via email or through the Service. Continued use after changes constitutes acceptance 
              of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws, 
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Contact</h2>
            <p>
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@sagastudio.ai" className="text-foreground hover:underline">
                legal@sagastudio.ai
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
