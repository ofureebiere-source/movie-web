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
 * `WORDMARK_LEAD` / `WORDMARK_ACCENT` split it for the wordmark, which paints
 * the second half in the accent colour.
 */
export const SITE_NAME = 'Netflix-pro';

export const WORDMARK_LEAD = 'Netflix';
export const WORDMARK_ACCENT = '-pro';

/** Support address shown in the profile and the copyright disclaimer. */
export const SUPPORT_EMAIL = 'support@netflix-pro.com';
