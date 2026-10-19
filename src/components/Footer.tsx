import { Link } from 'react-router-dom';
import { Github, MessageCircle } from 'lucide-react';
import { SITE_NAME, TAGLINE, WORDMARK_ACCENT, WORDMARK_LEAD } from '@/lib/brand';

/**
 * The site footer.
 *
 * Ported 1:1 from frameXTV.xyz's footer: badge + wordmark + tagline on the
 * left, the link row in the middle, the copyright on the right. The reference's
 * X / Discord / "Support" crypto links are replaced by the GitHub link that
 * hosts the Netflix-pro app, because that is this product's distribution
 * channel.
 */

const LINKS: { label: string; to: string }[] = [
  { label: 'Home', to: '/' },
  { label: 'Movies', to: '/movies' },
  { label: 'TV', to: '/tv' },
  { label: 'Anime', to: '/anime' },
  { label: 'API & Embeds', to: '/api' },
  { label: 'History', to: '/history' },
  { label: 'My List', to: '/my-list' },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-900 page-bg mt-auto py-6 px-4 sm:px-6 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-400">
        <div className="flex items-center space-x-2.5 shrink-0">
          <span className="font-bold text-white tracking-wide">
            {WORDMARK_LEAD}
            <span className="text-brand-red">{WORDMARK_ACCENT}</span>
          </span>
          <span className="text-zinc-800 hidden sm:inline">|</span>
          <span className="text-zinc-500 text-[11px] hidden sm:inline">{TAGLINE}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-2.5 text-[11px]">
          {LINKS.map((link, index) => (
            <span key={link.to} className="flex items-center gap-x-3 sm:gap-x-4">
              {index > 0 && <span className="text-zinc-800">•</span>}
              <Link to={link.to} className="text-zinc-400 hover:text-white transition-colors py-1">
                {link.label}
              </Link>
            </span>
          ))}
          <span className="text-zinc-800">•</span>
          <a
            href="https://github.com/King-Fisher000/netflix-pro/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 text-zinc-300 hover:text-white transition-colors font-medium shrink-0 py-1"
            title={`Download the ${SITE_NAME} app`}
          >
            <Github className="w-3 h-3" />
            <span>{SITE_NAME} App</span>
          </a>
        </div>

        <div className="text-zinc-600 text-[11px] shrink-0">
          © {new Date().getFullYear()} {SITE_NAME}
        </div>
      </div>
    </footer>
  );
}
