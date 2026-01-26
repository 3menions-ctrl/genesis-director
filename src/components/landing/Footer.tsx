import { Link } from 'react-router-dom';
import { Mail, MapPin } from 'lucide-react';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Help Center', href: '/help' },
    { label: 'Contact', href: '/contact' },
  ],
  Company: [
    { label: 'Press', href: '/press' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-[#030303]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
              <span className="text-base font-bold text-black">AS</span>
            </div>
            <span className="text-lg font-bold text-white">Apex Studio</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category} className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/30 uppercase tracking-wider">{category}:</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {links.map((link, idx) => (
                    <span key={link.label} className="flex items-center gap-3">
                      {link.href.startsWith('/') ? (
                        <Link
                          to={link.href}
                          className="text-sm text-white/50 hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-white/50 hover:text-white transition-colors"
                        >
                          {link.label}
                        </a>
                      )}
                      {idx < links.length - 1 && <span className="text-white/20">·</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
          <p>© {new Date().getFullYear()} Apex Studio. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="mailto:cole@apex-studio.com" className="hover:text-white/60 transition-colors flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              cole@apex-studio.com
            </a>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              San Francisco, CA
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
