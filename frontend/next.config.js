/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const cspDirectives = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' accounts.google.com https://onesignal.com https://cdn.onesignal.com https://*.onesignal.com"
    : "script-src 'self' 'unsafe-inline' accounts.google.com https://onesignal.com https://cdn.onesignal.com https://*.onesignal.com",
  "style-src 'self' 'unsafe-inline' https://onesignal.com https://cdn.onesignal.com https://*.onesignal.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.githubusercontent.com",
  "font-src 'self' data:",
  isDev
    ? "connect-src 'self' http://localhost:4000 ws://localhost:4000 ws://localhost:3000 wss: https://onesignal.com https://*.onesignal.com"
    : `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || ''} wss: https://accounts.google.com https://onesignal.com https://*.onesignal.com`,
  "frame-src 'self' accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
