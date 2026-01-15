import { Mail, MessageSquare, ArrowRight, Clock, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function ContactSection() {
  const navigate = useNavigate();

  return (
    <section id="contact" className="relative z-10 py-16 sm:py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <MessageSquare className="w-4 h-4 hero-text" />
            <span className="text-sm font-medium hero-text">Get in Touch</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold hero-text mb-4">
            We're here to help
          </h2>
          <p className="text-base sm:text-lg hero-text-secondary max-w-2xl mx-auto px-4">
            Have questions about Apex Studio? Our team is ready to assist you with anything you need.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Email Support Card */}
          <div className="group relative p-8 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
            <div className="relative">
              <div className="w-12 h-12 mb-6 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold hero-text mb-2">Email Support</h3>
              <p className="hero-text-secondary text-sm mb-4">
                Send us a message and we'll respond within 24 hours.
              </p>
              <a 
                href="mailto:cole@apex-studio.com" 
                className="text-sm font-medium hero-text hover:underline inline-flex items-center gap-1"
              >
                cole@apex-studio.com
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Contact Form Card */}
          <div className="group relative p-8 rounded-2xl bg-glossy-black text-white shadow-obsidian hover:shadow-obsidian-lg transition-all hover:-translate-y-1">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-12 h-12 mb-6 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Headphones className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Contact Form</h3>
              <p className="text-white/70 text-sm mb-4">
                Fill out our form for detailed inquiries or partnership requests.
              </p>
              <Button
                onClick={() => navigate('/contact')}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                Contact Us
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Response Time Card */}
          <div className="group relative p-8 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
            <div className="relative">
              <div className="w-12 h-12 mb-6 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold hero-text mb-2">Fast Response</h3>
              <p className="hero-text-secondary text-sm mb-4">
                We prioritize quick responses and aim to resolve issues promptly.
              </p>
              <span className="text-sm font-medium hero-text inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Average response: 4 hours
              </span>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="text-center mt-12">
          <p className="hero-text-secondary text-sm mb-3">
            Looking for quick answers?
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/help')}
            className="rounded-xl"
          >
            Visit our Help Center
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
