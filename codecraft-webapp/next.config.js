const withNextIntl = require('next-intl/plugin')('./next-intl.config.ts');

// Next.js config for Vercel
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      // Game News Icons
      {
        protocol: 'https',
        hostname: 'cdn.communitydragon.org',
      },
      {
        protocol: 'https',
        hostname: 'titles.trackercdn.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.unrealengine.com',
      },
      {
        protocol: 'https',
        hostname: 'www.minecraft.net',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cloudflare.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
      },
    ],
    // Fallback for legacy domains config
    domains: [
      'cdn.discordapp.com',
      'via.placeholder.com',
      'i.ibb.co',
      'imgur.com',
      'i.imgur.com'
    ]
  }
};

module.exports = withNextIntl(nextConfig);


