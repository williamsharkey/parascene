import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateRandomColorImage } from "./utils/imageGenerator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function createCreateRoutes({ queries }) {
  const router = express.Router();

  // Ensure images directory exists
  const imagesDir = path.join(__dirname, "..", "db", "data", "images", "created");
  
  // Serve created images statically
  router.use("/images/created", express.static(imagesDir));

  async function requireUser(req, res) {
    if (!req.auth?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }

    const user = await queries.selectUserById.get(req.auth.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return null;
    }

    return user;
  }

  // POST /api/create - Create a new image
  router.post("/api/create", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      // Create unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const filename = `${user.id}_${timestamp}_${random}.png`;
      const filePath = path.join(imagesDir, filename);

      // Create placeholder entry in database with "creating" status
      const result = await queries.insertCreatedImage.run(
        user.id,
        filename,
        filePath,
        1024, // width
        1024, // height
        null, // color - will be set after creation
        'creating' // status
      );

      // Return immediately with creating status
      res.json({
        id: result.insertId,
        filename,
        url: `/images/created/${filename}`,
        color: null,
        width: 1024,
        height: 1024,
        status: 'creating',
        created_at: new Date().toISOString()
      });

      // Create the image asynchronously with delay
      (async () => {
        try {
          // Add delay (3-5 seconds)
          const delay = 3000 + Math.random() * 2000; // 3-5 seconds
          // const delay = 100000;
          await new Promise(resolve => setTimeout(resolve, delay));

          // Create the image
          const { color, width, height } = await generateRandomColorImage(filePath);

          // Update database with completed status and color
          await queries.updateCreatedImageStatus.run(result.insertId, user.id, 'completed', color);
          
          // Note: We could also update the color in the database, but for now status is enough
          // The color will be fetched when the image is loaded
        } catch (error) {
          console.error("Error creating image in background:", error);
          // Update status to failed
          await queries.updateCreatedImageStatus.run(result.insertId, user.id, 'failed');
        }
      })();
    } catch (error) {
      console.error("Error initiating image creation:", error);
      return res.status(500).json({ error: "Failed to initiate image creation" });
    }
  });

  // GET /api/create/images - List all images for user
  router.get("/api/create/images", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      const images = await queries.selectCreatedImagesForUser.all(user.id);
      
      // Transform to include URLs
      const imagesWithUrls = images.map((img) => ({
        id: img.id,
        filename: img.filename,
        url: `/images/created/${img.filename}`,
        width: img.width,
        height: img.height,
        color: img.color,
        status: img.status || 'completed', // Default to completed for backward compatibility
        created_at: img.created_at,
        published: img.published === 1 || img.published === true,
        published_at: img.published_at || null,
        title: img.title || null,
        description: img.description || null
      }));

      return res.json({ images: imagesWithUrls });
    } catch (error) {
      console.error("Error fetching images:", error);
      return res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  // GET /api/create/images/:id - Get specific image metadata
  router.get("/api/create/images/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      // First try to get as owner
      let image = await queries.selectCreatedImageById.get(
        req.params.id,
        user.id
      );

      // If not found as owner, check if it exists and is published
      if (!image) {
        const anyImage = await queries.selectCreatedImageByIdAnyUser.get(req.params.id);
        if (anyImage && (anyImage.published === 1 || anyImage.published === true)) {
          image = anyImage;
        } else {
          return res.status(404).json({ error: "Image not found" });
        }
      }

      // Get user information for the creator
      let creator = null;
      if (image.user_id) {
        creator = await queries.selectUserById.get(image.user_id);
      }

      return res.json({
        id: image.id,
        filename: image.filename,
        url: `/images/created/${image.filename}`,
        width: image.width,
        height: image.height,
        color: image.color,
        status: image.status || 'completed',
        created_at: image.created_at,
        published: image.published === 1 || image.published === true,
        published_at: image.published_at || null,
        title: image.title || null,
        description: image.description || null,
        user_id: image.user_id,
        creator: creator ? {
          id: creator.id,
          email: creator.email,
          role: creator.role
        } : null
      });
    } catch (error) {
      console.error("Error fetching image:", error);
      return res.status(500).json({ error: "Failed to fetch image" });
    }
  });

  // POST /api/create/images/:id/publish - Publish a creation
  router.post("/api/create/images/:id/publish", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      const { title, description } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ error: "Title is required" });
      }

      // Get the image to verify ownership and status
      const image = await queries.selectCreatedImageById.get(
        req.params.id,
        user.id
      );

      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      if (image.status !== 'completed') {
        return res.status(400).json({ error: "Image must be completed before publishing" });
      }

      if (image.published === 1 || image.published === true) {
        return res.status(400).json({ error: "Image is already published" });
      }

      // Publish the image
      const publishResult = await queries.publishCreatedImage.run(
        req.params.id,
        user.id,
        title.trim(),
        description ? description.trim() : null
      );

      if (publishResult.changes === 0) {
        return res.status(500).json({ error: "Failed to publish image" });
      }

      // Create feed item
      await queries.insertFeedItem.run(
        title.trim(),
        description ? description.trim() : '',
        user.email || 'User',
        null, // tags
        parseInt(req.params.id)
      );

      // Get updated image
      const updatedImage = await queries.selectCreatedImageById.get(
        req.params.id,
        user.id
      );

      return res.json({
        id: updatedImage.id,
        filename: updatedImage.filename,
        url: `/images/created/${updatedImage.filename}`,
        width: updatedImage.width,
        height: updatedImage.height,
        color: updatedImage.color,
        status: updatedImage.status || 'completed',
        created_at: updatedImage.created_at,
        published: true,
        published_at: updatedImage.published_at,
        title: updatedImage.title,
        description: updatedImage.description
      });
    } catch (error) {
      console.error("Error publishing image:", error);
      return res.status(500).json({ error: "Failed to publish image" });
    }
  });

  return router;
}
