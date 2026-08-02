/**
 * Shared Open Graph / Twitter Card metadata for link previews (X, Discord, Telegram).
 * Set NEXT_PUBLIC_SITE_URL in production.
 */

export const DEFAULT_SITE_URL = 'http://localhost:3000';

export const SITE_NAME = 'AptCasino';

export const DEFAULT_TITLE = 'AptCasino';

export const DEFAULT_DESCRIPTION =
  'Four confidential casino games powered by Inco Lightning, with Megapot ticket rewards, on Base Sepolia.';

export function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const raw = (fromEnv || DEFAULT_SITE_URL).trim().replace(/\/$/, '');
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Canonical origin for social share links (never localhost when env is set). */
export function getPublicShareOrigin() {
  return getSiteUrl();
}

export function buildReferralShortLink(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return '';
  return `${getPublicShareOrigin()}/r/${c}`;
}

/** Default preview image shown on every page when sharing on Discord, Telegram, X, etc. */
export const DEFAULT_OG_IMAGE_PATH = '/og.png';

/**
 * @param {{ title?: string; description?: string; path?: string; ogImagePath?: string }} opts
 * Pass an explicit `null` `ogImagePath` to suppress the image on a specific page.
 */
export function buildPageMetadata(opts = {}) {
  const siteUrl = getSiteUrl();
  const title = opts.title ?? DEFAULT_TITLE;
  const description = opts.description ?? DEFAULT_DESCRIPTION;
  const path = opts.path ?? '/';
  const canonical = new URL(path.startsWith('/') ? path : `/${path}`, siteUrl).toString();
  const imagePath = opts.ogImagePath !== undefined ? opts.ogImagePath : DEFAULT_OG_IMAGE_PATH;

  const openGraph = {
    type: 'website',
    locale: 'en_US',
    url: canonical,
    siteName: SITE_NAME,
    title,
    description,
  };

  const twitter = {
    card: 'summary_large_image',
    title,
    description,
  };

  if (imagePath) {
    const ogImage = new URL(
      imagePath.startsWith('/') ? imagePath : `/${imagePath}`,
      siteUrl,
    ).toString();
    const mimeType = imagePath.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' : 'image/png';
    openGraph.images = [
      {
        url: ogImage,
        secureUrl: ogImage,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
        type: mimeType,
      },
    ];
    twitter.images = [{ url: ogImage, alt: SITE_NAME }];
  }

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
    openGraph,
    twitter,
  };
}
