import { Link } from 'react-router-dom';
import { 
  Twitter, 
  Youtube, 
  Instagram, 
  Linkedin,
  Mail,
  MapPin
} from 'lucide-react';


const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Examples', href: '#examples' },
    { label: 'API', href: '/contact' },
    { label: 'Changelog', href: '#' },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'Tutorials', href: '#' },
    { label: 'Blog', href: '/blog' },
    { label: 'Community', href: '#' },
    { label: 'Templates', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '/contact' },
    { label: 'Partners', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/privacy' },
    { label: 'GDPR', href: '/privacy' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Youtube, href: '#', label: 'YouTube' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
];

export default function Footer() {
  return (
    <footer className="relative z-10">
      <div className="bg-black/90 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            {/* Brand Column */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">AS</span>
                </div>
                <span className="text-lg font-bold text-white">Apex Studio</span>
              </div>
              
              {/* Social Links */}
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      aria-label={social.label}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Link Columns - Horizontal on larger screens */}
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                <div key={category} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{category}:</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {links.slice(0, 3).map((link, idx) => (
                      <span key={link.label} className="flex items-center gap-3">
                        {link.href.startsWith('/') ? (
                          <Link
                            to={link.href}
                            className="text-sm text-white/60 hover:text-white transition-colors"
                          >
                            {link.label}
                          </Link>
                        ) : (
                          <a
                            href={link.href}
                            className="text-sm text-white/60 hover:text-white transition-colors"
                          >
                            {link.label}
                          </a>
                        )}
                        {idx < 2 && <span className="text-white/20">·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
            <p>© {new Date().getFullYear()} Apex Studio. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="mailto:hello@apexstudio.ai" className="hover:text-white/60 transition-colors flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                hello@apexstudio.ai
              </a>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                San Francisco, CA
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
