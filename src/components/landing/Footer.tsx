import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.05] py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
              <span className="text-xs font-bold text-black">A-S</span>
            </div>
            <span className="text-sm font-medium text-white">Apex-Studio</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-12 text-sm">
            <div className="space-y-3">
              <div className="text-white/30 text-xs uppercase tracking-wider">Product</div>
              <a href="#pricing" className="block text-white/50 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="block text-white/50 hover:text-white transition-colors">FAQ</a>
            </div>
            <div className="space-y-3">
              <div className="text-white/30 text-xs uppercase tracking-wider">Company</div>
              <Link to="/contact" className="block text-white/50 hover:text-white transition-colors">Contact</Link>
              <Link to="/blog" className="block text-white/50 hover:text-white transition-colors">Blog</Link>
            </div>
            <div className="space-y-3">
              <div className="text-white/30 text-xs uppercase tracking-wider">Legal</div>
              <Link to="/privacy" className="block text-white/50 hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="block text-white/50 hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.05] text-center">
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} Apex-Studio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
