import { Link } from 'react-router-dom';
import { DiscordIcon, PumpIcon, XIcon } from '@/components/BrandIcons';
import {
  BADGE,
  DISCORD_URL,
  SITE_LEAD,
  SITE_MIDDLE,
  SITE_TAIL,
  TAGLINE,
  X_HANDLE,
  X_URL,
} from '@/lib/brand';

/**
 * The site footer.
 *
 * Ported 1:1 from frameXTV.xyz: badge + wordmark + tagline on the left, the
 * link row in the middle, the copyright on the right. The link row ends with
 * the X / Discord / Support trio, where Support opens the donation modal
 * through `framextv:open_donation_modal` and turns green on hover.
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

const BRAND = `${SITE_LEAD}${SITE_MIDDLE}${SITE_TAIL}`;

export default function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-black page-bg mt-auto py-6 px-4 sm:px-6 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-400">
        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="w-5 h-5 rounded bg-white text-black font-bold font-mono text-[10px] flex items-center justify-center border border-zinc-300 shrink-0">
            {BADGE}
          </div>
          <span className="font-bold text-white tracking-wide">
            {SITE_LEAD}
            <span className="text-zinc-400">{SITE_MIDDLE}</span>
            {SITE_TAIL}
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
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 text-zinc-300 hover:text-white transition-colors font-medium shrink-0 py-1"
            title={`Follow ${BRAND} on X (${X_HANDLE})`}
          >
            <XIcon className="w-3 h-3" />
            <span>X (Twitter)</span>
          </a>

          <span className="text-zinc-800">•</span>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-zinc-300 hover:text-white transition-colors font-medium shrink-0 py-1"
          >
            <DiscordIcon className="w-3 h-3" />
            <span>Discord</span>
          </a>

          <span className="text-zinc-800">•</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('framextv:open_donation_modal'))}
            className="flex items-center space-x-1.5 text-zinc-300 hover:text-[#14F195] transition-colors font-medium shrink-0 py-1 cursor-pointer"
            title={`Support ${BRAND} with Crypto`}
          >
            <PumpIcon className="w-3 h-3 text-[#14F195]" />
            <span>Support</span>
          </button>
        </div>

        <div className="text-zinc-600 text-[11px] shrink-0">
          © {new Date().getFullYear()} {BRAND}
        </div>
      </div>
    </footer>
  );
}
