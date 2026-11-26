// The report app is served at https://calcioac.com/match-reports
// (calcioac.com forwards /match-reports/* to this Vercel project).
const BASE_PATH = '/match-reports'
const SITE = 'https://calcioac.com'

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  async redirects() {
    // Old cac-match.vercel.app links (no prefix) land on the new address.
    return [
      { source: '/', destination: `${SITE}${BASE_PATH}`, basePath: false, permanent: false },
      { source: '/match/:id', destination: `${SITE}${BASE_PATH}/match/:id`, basePath: false, permanent: false },
      { source: '/player/:path*', destination: `${SITE}${BASE_PATH}/player/:path*`, basePath: false, permanent: false },
    ]
  },
}

module.exports = nextConfig
