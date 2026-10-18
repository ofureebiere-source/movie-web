/**
 * The site's own name.
 *
 * One place, because it appears in the wordmark, the footer, the brand intro,
 * the maintenance page and every locale's footer strings, and a name that has
 * to be changed in eight files is a name that ends up changed in seven.
 *
 * `SITE_NAME` is the full name and is what prose and `<title>`s use.
 * `WORDMARK_LEAD` / `WORDMARK_ACCENT` are the two halves the wordmark paints,
 * the second one in the accent colour. Keeping the split here rather than in
 * the component means the mark cannot drift from the name.
 *
 * Chosen to match the served page title ("Watch Movies Online") and to avoid
 * any trademarked streaming-service name — this is a standalone service, and
 * naming it after another company's product is both a legal risk and a lie
 * about who runs it.
 */
export const SITE_NAME = 'Watch Movies Online';

export const WORDMARK_LEAD = 'Watch Movies';
export const WORDMARK_ACCENT = 'Online';

/** Support address shown in the profile and the copyright disclaimer. */
export const SUPPORT_EMAIL = 'support@watchmoviesonline.app';
