import { MessageSquare, ArrowRight, Headphones, Mail, HelpCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function ContactSection() {
  const navigate = useNavigate();

  return (
    <section id="contact" className="relative z-10 py-20 sm:py-32 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Main transparent container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Gradient background with tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.12] via-primary/[0.06] to-accent/[0.08] backdrop-blur-xl" />
          
          {/* Border glow */}
          <div className="absolute inset-0 rounded-3xl border border-primary/20" />
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          {/* Floating sparkles */}
          <div className="absolute top-12 left-12 text-primary/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute bottom-16 right-16 text-primary/20">
            <Sparkles className="w-8 h-8 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          <div className="absolute top-1/2 right-24 text-accent/20">
            <Sparkles className="w-5 h-5 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>

          {/* Content */}
          <div className="relative px-8 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            {/* Header */}
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-8"
              >
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Get in Touch</span>
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold hero-text mb-6"
              >
                We're here to help
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-lg sm:text-xl hero-text-secondary max-w-2xl mx-auto"
              >
                Have questions about Apex Studio? Our team is ready to assist you with anything you need.
              </motion.p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
              {/* Contact Form Card */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform duration-300">
                      <Mail className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold hero-text mb-2">Contact Form</h3>
                      <p className="hero-text-secondary text-sm mb-5 leading-relaxed">
                        Fill out our form for detailed inquiries or partnership requests.
                      </p>
                      <Button
                        onClick={() => navigate('/contact')}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
                      >
                        Contact Us
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Help Center Card */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 hover:border-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg shadow-accent/25 group-hover:scale-110 transition-transform duration-300">
                      <HelpCircle className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold hero-text mb-2">Help Center</h3>
                      <p className="hero-text-secondary text-sm mb-5 leading-relaxed">
                        Browse our comprehensive guides and FAQs for quick answers.
                      </p>
                      <Button
                        onClick={() => navigate('/help')}
                        variant="outline"
                        className="border-accent/30 hover:bg-accent/10 hover:border-accent/50 transition-all"
                      >
                        Visit Help Center
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom support text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="text-center mt-12 pt-8 border-t border-primary/10"
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-muted/50 backdrop-blur-sm">
                <Headphones className="w-5 h-5 text-primary" />
                <span className="hero-text-secondary text-sm">
                  Average response time: <span className="font-medium text-primary">under 24 hours</span>
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
