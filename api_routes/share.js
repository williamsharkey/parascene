import express from "express";
import { verifyShareToken } from "./utils/shareLink.js";

export default function createShareRoutes({ queries, storage }) {
	const router = express.Router();

	router.get("/api/share/:version/:token/image", async (req, res) => {
		const version = String(req.params.version || "");
		const token = String(req.params.token || "");
		const verified = verifyShareToken({ version, token });
		if (!verified.ok) {
			return res.status(404).json({ error: "Not found" });
		}

		try {
			const image = await queries.selectCreatedImageByIdAnyUser?.get(verified.imageId);
			if (!image) {
				return res.status(404).json({ error: "Not found" });
			}
			const status = image.status || "completed";
			if (status !== "completed") {
				return res.status(404).json({ error: "Not found" });
			}
			if (!image.filename) {
				return res.status(404).json({ error: "Not found" });
			}

			const buf = await storage.getImageBuffer(image.filename);
			res.setHeader("Content-Type", "image/png");
			res.setHeader("Cache-Control", "no-store");
			return res.send(buf);
		} catch {
			return res.status(500).json({ error: "Failed to serve image" });
		}
	});

	return router;
}

