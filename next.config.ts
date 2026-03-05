import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trust X-Forwarded-Host and X-Forwarded-Proto from Nginx Proxy Manager
  // Required so req.nextUrl.origin returns https://isolutions.salesi.net
  // instead of http://192.168.6.100:3001 when behind the reverse proxy
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
