import type { NextConfig } from "next";

type RemotePattern = Exclude<
  NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number],
  URL
>;

/** Allow Next.js to resize images from the public Supabase bucket only. */
function supabaseImageSource(): { pattern: RemotePattern | null; isLocal: boolean } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { pattern: null, isLocal: false };
  try {
    const url = new URL(raw);
    return {
      pattern: {
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/published-designs/**",
      },
      // Only true when running Supabase on your own computer.
      isLocal: ["localhost", "127.0.0.1"].includes(url.hostname),
    };
  } catch {
    return { pattern: null, isLocal: false };
  }
}

const supabaseImages = supabaseImageSource();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseImages.pattern ? [supabaseImages.pattern] : [],
    dangerouslyAllowLocalIP: supabaseImages.isLocal,
    qualities: [85],
    // Matches Supabase's default cache time, so unpublished images stop being served within about an hour.
    minimumCacheTTL: 3600,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
