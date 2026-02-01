export function getBaseAppUrl() {
	if (process.env.VERCEL_ENV === "production") {
		return "https://parascene.crosshj.com";
	}

	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}

	const port = Number(process.env.PORT) || 2367;
	return `http://localhost:${port}`;
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
