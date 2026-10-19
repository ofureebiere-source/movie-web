import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import InstallBanner from './InstallBanner';

/**
 * The app shell.
 *
 * Ported 1:1 from frameXTV.xyz's layout: a full-height column, the sticky
 * header, a `flex-1` main that clears the fixed mobile nav with bottom padding,
 * the footer, then the install banner as an overlay. Every route change scrolls
 * back to the top. Visitors land straight on the home page — there is no
 * first-visit modal.
 */
export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black w-full overflow-x-clip">
      <Header />
      <main className="flex-1 w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        <Outlet />
      </main>
      <Footer />
      <InstallBanner />
    </div>
  );
}
