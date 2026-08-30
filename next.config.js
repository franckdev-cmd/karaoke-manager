const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }
    ]
  }
}

module.exports = nextConfig
