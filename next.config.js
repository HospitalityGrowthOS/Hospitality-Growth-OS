/** @type {import('next').NextConfig} */
const nextConfig = {
  // Types are generated from the live Supabase schema (npm run gen:types),
  // so a type error here means the code and the database disagree. Let it fail
  // the build rather than reach production.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

module.exports = nextConfig
