import { ArrowLeft, Mail, Clock, Building, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
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
          source: 'contact'
        });
      
      if (error) throw error;
      
      toast.success("Message sent! We'll get back to you within 24-48 hours.");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error("Failed to send message. Please try again or email us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Abstract Background - same as landing */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
        </motion.div>
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Contact Us
          </h1>
          <p className="text-lg text-white/40 max-w-md mx-auto">
            Have questions? We're here to help. Reach out and we'll get back to you as soon as possible.
          </p>
        </motion.div>
        
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <Send className="w-5 h-5 text-white/40" />
                Send us a message
              </h2>
              
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
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/10 rounded-xl"
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
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/10 rounded-xl"
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
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/10 rounded-xl"
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
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/10 rounded-xl resize-none"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </div>
          </motion.div>
          
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
              <h2 className="text-lg font-semibold text-white mb-6">Other ways to reach us</h2>
              
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <Mail className="w-5 h-5 text-white/50" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Email Support</h3>
                    <p className="text-white/40 text-sm mb-2">
                      For general inquiries and support
                    </p>
                    <a 
                      href="mailto:cole@apex-studio.com" 
                      className="text-white/70 hover:text-white transition-colors text-sm"
                    >
                      cole@apex-studio.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <Building className="w-5 h-5 text-white/50" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Business Inquiries</h3>
                    <p className="text-white/40 text-sm mb-2">
                      For partnerships and enterprise
                    </p>
                    <a 
                      href="mailto:cole@apex-studio.com" 
                      className="text-white/70 hover:text-white transition-colors text-sm"
                    >
                      cole@apex-studio.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <Clock className="w-5 h-5 text-white/50" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Response Time</h3>
                    <p className="text-white/40 text-sm">
                      We typically respond within 24-48 hours during business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* FAQ Card */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
              <h3 className="font-medium text-white mb-2">Frequently Asked Questions</h3>
              <p className="text-white/40 text-sm mb-4">
                Before reaching out, you might find your answer in our FAQ section.
              </p>
              <Button 
                variant="ghost" 
                asChild
                className="w-full h-10 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.05]"
              >
                <Link to="/#faq">View FAQ</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
