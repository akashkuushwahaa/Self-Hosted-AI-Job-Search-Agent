// The public URL of this install, for auth callbacks and link previews. BETTER_AUTH_URL when set
// (self-hosting); otherwise, on Vercel, the production domain Vercel injects at build and run time,
// so the demo deploy needs no URL variable. Undefined locally without either: Better Auth then reads
// the origin from each request, and Next falls back for preview images.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const siteUrl: string | undefined = process.env.BETTER_AUTH_URL || (vercel ? `https://${vercel}` : undefined);
