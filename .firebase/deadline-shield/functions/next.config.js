"use strict";

// apps/web/next.config.js
var nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] }
  }
};
module.exports = nextConfig;
