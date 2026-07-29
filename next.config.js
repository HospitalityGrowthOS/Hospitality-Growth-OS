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
  // The *.vercel.app subdomain stays live even with a custom domain attached,
  // which splits users across two origins — and cookies are per-origin, so a
  // session on one does not exist on the other. Send everyone to the real
  // domain permanently.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: '(?<host>.*\\.vercel\\.app)' }],
        destination: 'https://www.hospitalitygrowthos.com/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
