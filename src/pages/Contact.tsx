import { ArrowLeft, Mail, Clock, Building, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import AbstractBackground from "@/components/landing/AbstractBackground";

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

  const glassCardStyle = {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 30, 0.9) 50%, rgba(20, 30, 50, 0.8) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.15)',
    boxShadow: '0 0 40px rgba(59, 130, 246, 0.1), 0 0 80px rgba(59, 130, 246, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
  };

  const inputStyle = {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backdropFilter: 'blur(12px)',
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium Abstract Background */}
      <AbstractBackground />
      
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-slate-400/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12 group"
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Get in Touch</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Contact Us
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Have questions? We're here to help. Reach out and we'll get back to you as soon as possible.
          </p>
        </motion.div>
        
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Contact Form - Takes more space */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div 
              className="rounded-2xl p-8"
              style={glassCardStyle}
            >
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <Send className="w-5 h-5 text-blue-400" />
                Send us a message
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                      Name
                    </label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                      required
                      className="bg-slate-900/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                      style={inputStyle}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      required
                      className="bg-slate-900/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                      style={inputStyle}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="How can we help?"
                    required
                    className="bg-slate-900/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us more about your inquiry..."
                    rows={5}
                    required
                    className="bg-slate-900/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20 resize-none"
                    style={inputStyle}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium relative overflow-hidden group"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.95) 100%)',
                    border: '1px solid rgba(147, 197, 253, 0.3)',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? "Sending..." : "Send Message"}
                    <Send className="w-4 h-4" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <div 
              className="rounded-2xl p-6"
              style={glassCardStyle}
            >
              <h2 className="text-lg font-semibold text-white mb-6">Other ways to reach us</h2>
              
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-xl"
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Email Support</h3>
                    <p className="text-slate-400 text-sm mb-2">
                      For general inquiries and support
                    </p>
                    <a 
                      href="mailto:cole@apex-studio.com" 
                      className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      cole@apex-studio.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-xl"
                    style={{
                      background: 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid rgba(148, 163, 184, 0.15)',
                    }}
                  >
                    <Building className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Business Inquiries</h3>
                    <p className="text-slate-400 text-sm mb-2">
                      For partnerships and enterprise
                    </p>
                    <a 
                      href="mailto:cole@apex-studio.com" 
                      className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      cole@apex-studio.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-xl"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.15)',
                    }}
                  >
                    <Clock className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">Response Time</h3>
                    <p className="text-slate-400 text-sm">
                      We typically respond within 24-48 hours during business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* FAQ Card */}
            <div 
              className="rounded-2xl p-6"
              style={{
                ...glassCardStyle,
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(20, 30, 50, 0.8) 100%)',
              }}
            >
              <h3 className="font-medium text-white mb-2">Frequently Asked Questions</h3>
              <p className="text-slate-400 text-sm mb-4">
                Before reaching out, you might find your answer in our FAQ section.
              </p>
              <Button 
                variant="outline" 
                asChild
                className="w-full border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 text-slate-300 hover:text-white"
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
