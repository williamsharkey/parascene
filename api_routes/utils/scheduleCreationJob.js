import { getBaseAppUrl } from "./url.js";

function hasNonEmpty(value) {
	return typeof value === "string" && value.trim().length > 0;
}

export async function scheduleCreationJob({ payload, runCreationJob, log = console }) {
	const qstashToken = process.env.UPSTASH_QSTASH_TOKEN;
	const isVercel = !!process.env.VERCEL;

	// cloud: enqueue via QStash
	if (isVercel && !hasNonEmpty(qstashToken)) {
		throw new Error("QStash token is required on Vercel. Set UPSTASH_QSTASH_TOKEN environment variable.");
	}
	if (isVercel && hasNonEmpty(qstashToken)) {
		const callbackUrl = new URL("/api/create/worker", getBaseAppUrl()).toString();
		const qstashBaseUrl = process.env.UPSTASH_QSTASH_URL;
		const publishUrl = `${qstashBaseUrl}/v2/publish/${callbackUrl}`;

		const res = await fetch(publishUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${qstashToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`Failed to publish QStash job: ${res.status} ${res.statusText} ${text}`.trim());
		}

		return { enqueued: true };
	}

	// Local: fire-and-forget in-process.
	queueMicrotask(() => {
		Promise.resolve(runCreationJob({ payload })).catch((err) => {
			log.error("runCreationJob failed:", err);
		});
	});

	return { enqueued: false };
}

