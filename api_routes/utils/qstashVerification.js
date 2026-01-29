import { Receiver } from "@upstash/qstash";

let receiverInstance = null;

function shouldLogCreation() {
	return process.env.ENABLE_CREATION_LOGS === "true";
}

function logCreation(...args) {
	if (shouldLogCreation()) {
		console.log("[Creation]", ...args);
	}
}

function logCreationError(...args) {
	if (shouldLogCreation()) {
		console.error("[Creation]", ...args);
	}
}

function getReceiver() {
	if (!receiverInstance) {
		const currentSigningKey = process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY;
		const nextSigningKey = process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY;

		if (!currentSigningKey && !nextSigningKey) {
			logCreationError("QStash receiver: No signing keys configured");
			return null;
		}

		logCreation("Initializing QStash receiver", {
			has_current_key: !!currentSigningKey,
			has_next_key: !!nextSigningKey
		});

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
		logCreationError("QStash verification failed: No receiver instance");
		return false;
	}

	const signature = req.get("Upstash-Signature") || req.get("upstash-signature");
	if (!signature) {
		logCreationError("QStash verification failed: No signature header");
		return false;
	}

	const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
	const protocol = req.protocol || "https";
	const host = req.get("host");
	const originalUrl = req.originalUrl || req.url;
	const url = `${protocol}://${host}${originalUrl}`;

	logCreation("Verifying QStash signature", {
		url,
		has_body: !!body,
		body_length: body?.length || 0,
		signature_length: signature?.length || 0
	});

	try {
		await receiver.verify({
			body,
			signature,
			url,
		});
		logCreation("QStash signature verified successfully");
		return true;
	} catch (err) {
		logCreationError("QStash signature verification failed", {
			error: err.message,
			error_type: err.constructor.name
		});
		return false;
	}
}
