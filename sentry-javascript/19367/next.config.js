const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is the default in Next.js 16, no extra config needed
};

module.exports = withSentryConfig(nextConfig, {
  org: "your-org",
  project: "your-project",
  // Suppress build output noise for the repro
  silent: true,
  // Disable source map upload since we have no real DSN
  sourcemaps: {
    disable: true,
  },
});
