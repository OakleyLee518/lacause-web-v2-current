/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    trailingSlash: true, // optional but recommended for S3
    images: {
      unoptimized: true // if you use <Image /> and plan to statically export
    }
  }
  
  module.exports = nextConfig
  