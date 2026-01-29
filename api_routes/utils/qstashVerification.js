import { Receiver } from "@upstash/qstash";

let receiverInstance = null;

function getReceiver() {
	if (!receiverInstance) {
		const currentSigningKey = process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY;
		const nextSigningKey = process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY;

		if (!currentSigningKey && !nextSigningKey) {
			return null;
		}

		receiverInstance = new Receiver({
			currentSigningKey: currentSigningKey || undefined,
			nextSigningKey: nextSigningKey || undefined,
		});
	}

	return receiverInstance;
}

export async function verifyQStashRequest(req) {
	const receiver = getReceiver();
	if (!receiver) {
		return false;
	}

	const signature = req.get("Upstash-Signature") || req.get("upstash-signature");
	if (!signature) {
		return false;
	}

	const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
	const protocol = req.protocol || "https";
	const host = req.get("host");
	const originalUrl = req.originalUrl || req.url;
	const url = `${protocol}://${host}${originalUrl}`;

	try {
		await receiver.verify({
			body,
			signature,
			url,
		});
		return true;
	} catch (err) {
		return false;
	}
}
