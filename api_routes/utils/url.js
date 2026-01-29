// Returns the base URL (homepage) for the application
// Use this to construct full URLs by combining with paths (e.g., new URL("/creations/123", getBaseAppUrl()))
export function getBaseAppUrl() {
	// Production: use custom domain (VERCEL_URL always returns *.vercel.app, not custom domains)
	if (process.env.VERCEL_ENV === "production") {
		return "https://parascene.crosshj.com";
	}

	// Preview deployments: use Vercel's automatic deployment URL
	// VERCEL_URL is like "my-app-abc123.vercel.app" (no scheme)
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}

	// Local development
	return "http://localhost:3000";
}

export function getThumbnailUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, "http://localhost");
    parsed.searchParams.set("variant", "thumbnail");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}variant=thumbnail`;
  }
}
