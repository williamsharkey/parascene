// Returns the base URL (homepage) for the application
// Use this to construct full URLs by combining with paths (e.g., new URL("/creations/123", getBaseAppUrl()))
export function getBaseAppUrl() {
	return "https://parascene.crosshj.com";
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
