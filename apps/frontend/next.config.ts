import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The leak this closes is real and lives here, not on the API: a browser
  // sitting on /cli/connect?code=… sends that code in a Referer to every
  // third-party origin the page touches, and GET /api/cli-login/:code hands the
  // raw CLI token to whoever presents it. Site-wide rather than on that one
  // route — no page here has any reason to name where its visitor came from.
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ]);
  },
};

export default nextConfig;
