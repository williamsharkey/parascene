import express from "express";

export default function createFollowsRoutes({ queries }) {
	const router = express.Router();

	function parseUserId(param) {
		const id = Number.parseInt(String(param || ""), 10);
		if (!Number.isFinite(id) || id <= 0) return null;
		return id;
	}

	function requireAuth(req, res) {
		if (!req.auth?.userId) {
			res.status(401).json({ error: "Unauthorized" });
			return null;
		}
		return Number(req.auth.userId);
	}

	// Follow a user (idempotent)
	router.post("/api/users/:id/follow", async (req, res) => {
		try {
			const viewerId = requireAuth(req, res);
			if (!viewerId) return;

			const targetUserId = parseUserId(req.params.id);
			if (!targetUserId) {
				return res.status(400).json({ error: "Invalid user id" });
			}
			if (targetUserId === viewerId) {
				return res.status(400).json({ error: "Cannot follow yourself" });
			}

			const target = await queries.selectUserById.get(targetUserId);
			if (!target) {
				return res.status(404).json({ error: "User not found" });
			}

			if (!queries.insertUserFollow?.run) {
				return res.status(500).json({ error: "Follow storage not available" });
			}

			const result = await queries.insertUserFollow.run(viewerId, targetUserId);
			return res.json({ ok: true, changed: Number(result?.changes ?? 0) > 0 });
		} catch (error) {
			console.error("Error following user:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	});

	// Unfollow a user (idempotent)
	router.delete("/api/users/:id/follow", async (req, res) => {
		try {
			const viewerId = requireAuth(req, res);
			if (!viewerId) return;

			const targetUserId = parseUserId(req.params.id);
			if (!targetUserId) {
				return res.status(400).json({ error: "Invalid user id" });
			}
			if (targetUserId === viewerId) {
				return res.status(400).json({ error: "Cannot unfollow yourself" });
			}

			const target = await queries.selectUserById.get(targetUserId);
			if (!target) {
				return res.status(404).json({ error: "User not found" });
			}

			if (!queries.deleteUserFollow?.run) {
				return res.status(500).json({ error: "Follow storage not available" });
			}

			const result = await queries.deleteUserFollow.run(viewerId, targetUserId);
			return res.json({ ok: true, changed: Number(result?.changes ?? 0) > 0 });
		} catch (error) {
			console.error("Error unfollowing user:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	});

	// List followers for a user
	router.get("/api/users/:id/followers", async (req, res) => {
		try {
			const viewerId = requireAuth(req, res);
			if (!viewerId) return;

			const targetUserId = parseUserId(req.params.id);
			if (!targetUserId) {
				return res.status(400).json({ error: "Invalid user id" });
			}

			const target = await queries.selectUserById.get(targetUserId);
			if (!target) {
				return res.status(404).json({ error: "User not found" });
			}

			if (!queries.selectUserFollowers?.all) {
				return res.status(500).json({ error: "Follow storage not available" });
			}

			const followers = await queries.selectUserFollowers.all(targetUserId);
			return res.json({ followers: Array.isArray(followers) ? followers : [] });
		} catch (error) {
			console.error("Error loading followers:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	});

	// List who a user is following
	router.get("/api/users/:id/following", async (req, res) => {
		try {
			const viewerId = requireAuth(req, res);
			if (!viewerId) return;

			const targetUserId = parseUserId(req.params.id);
			if (!targetUserId) {
				return res.status(400).json({ error: "Invalid user id" });
			}

			const target = await queries.selectUserById.get(targetUserId);
			if (!target) {
				return res.status(404).json({ error: "User not found" });
			}

			if (!queries.selectUserFollowing?.all) {
				return res.status(500).json({ error: "Follow storage not available" });
			}

			const following = await queries.selectUserFollowing.all(targetUserId);
			return res.json({ following: Array.isArray(following) ? following : [] });
		} catch (error) {
			console.error("Error loading following:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	});

	return router;
}

