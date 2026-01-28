/**
 * Claude Server Generator Service
 *
 * Uses the Anthropic API to generate Parascene-compatible server code
 * based on user descriptions.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are an expert Node.js developer specializing in creating Parascene-compatible image generation servers.

Parascene is a platform for generative art. Users connect to "provider servers" that generate images on demand. Each provider server exposes an API that Parascene calls.

## Required API Structure

Your server must implement this API running on Vercel serverless functions:

### GET / (Capabilities Endpoint)
Returns server info and available generation methods.

Response format:
{
  "status": "operational",
  "name": "Server Name",
  "description": "What your server does",
  "icon": "https://your-server.vercel.app/branding/icon.png",
  "banner": "https://your-server.vercel.app/branding/banner.png",
  "methods": {
    "method_name": {
      "name": "Display Name",
      "description": "What this method generates",
      "credits": 0.25,
      "fields": {},
      "preview": "https://your-server.vercel.app/previews/example.png"
    }
  }
}

### POST / (Generation Endpoint)
Generates and returns an image.

Request body:
{
  "method": "method_name",
  "options": {}
}

Response: Return the image binary with these headers:
- Content-Type: image/png or image/gif
- X-Image-Width: Image width in pixels
- X-Image-Height: Image height in pixels
- X-Image-Seed: Random seed used (for reproducibility)
- X-Image-Color: Hex color representing the image (e.g., #ff5500)
- X-Image-Name: Suggested title for the image (optional)
- X-Image-Description: Suggested description (optional)

### Authentication
Both endpoints require Bearer token authentication:
Authorization: Bearer YOUR_API_KEY

Validate with:
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}

## Output Format

You MUST respond with valid JSON containing these fields:
{
  "name": "Server Name",
  "description": "Server description",
  "files": {
    "api/index.js": "// Main handler code...",
    "package.json": "{ ... }",
    "vercel.json": "{ ... }"
  },
  "config": {
    "methods": { ... }
  }
}

## Guidelines

1. Use sharp for image processing when needed
2. Generate unique images each time (use random seeds)
3. Keep code simple and focused
4. Use process.env.API_KEY for the auth token
5. Default image size is 1024x1024 unless user specifies otherwise
6. Always include proper error handling
7. Make sure the code actually generates the described images
8. IMPORTANT: Use CommonJS syntax (require/module.exports), NOT ES modules (import/export)

## Code Template

Use this exact structure for api/index.js:

\`\`\`javascript
const sharp = require('sharp');

module.exports = async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // Return capabilities
    return res.json({
      status: 'operational',
      name: 'Your Server Name',
      methods: { /* ... */ }
    });
  }

  if (req.method === 'POST') {
    // Generate and return image
    const { method, options } = req.body || {};
    // ... generate image with sharp ...
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Image-Width', '1024');
    res.setHeader('X-Image-Height', '1024');
    return res.send(imageBuffer);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
\`\`\`

DO NOT include any explanation outside of the JSON. Only output valid JSON.`;

const REFINE_SYSTEM_PROMPT = `You are an expert Node.js developer helping refine a Parascene-compatible image generation server.

The user will provide existing server code and a refinement request. Your job is to modify the code according to their request while maintaining compatibility with the Parascene API.

## Output Format

You MUST respond with valid JSON containing:
{
  "files": {
    "api/index.js": "// Updated handler code...",
    "package.json": "{ ... }",
    "vercel.json": "{ ... }"
  },
  "config": {
    "methods": { ... }
  },
  "changes": [
    "Description of change 1",
    "Description of change 2"
  ]
}

Only modify files that need changes. Keep the same API structure.
DO NOT include any explanation outside of the JSON. Only output valid JSON.`;

export class ClaudeServerGenerator {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not set - AI generation will not work');
    }
  }

  /**
   * Generate a new server based on user description
   * @param {string} description - What the user wants the server to do
   * @returns {Promise<{code: string, config: object, suggestedName: string, suggestedDescription: string, files: object}>}
   */
  async generateServer(description) {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const userMessage = `Create a Parascene image generation server that: ${description}

Requirements:
- Output should be 1024x1024 pixels by default
- Use sharp for image processing if needed
- Generate unique images each time
- Return appropriate headers for Parascene integration

Generate the complete server code as JSON.`;

    const response = await this._callClaude(SYSTEM_PROMPT, userMessage);
    return this._parseGenerationResponse(response);
  }

  /**
   * Refine existing server code based on user feedback
   * @param {string} existingCode - The current server code
   * @param {object} existingConfig - The current config
   * @param {string} refinementPrompt - What the user wants to change
   * @returns {Promise<{code: string, config: object, changes: string[], files: object}>}
   */
  async refineServer(existingCode, existingConfig, refinementPrompt) {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const userMessage = `Here is the current server code:

\`\`\`javascript
${existingCode}
\`\`\`

Current config:
\`\`\`json
${JSON.stringify(existingConfig, null, 2)}
\`\`\`

Please make the following changes: ${refinementPrompt}

Return the updated code as JSON.`;

    const response = await this._callClaude(REFINE_SYSTEM_PROMPT, userMessage);
    return this._parseRefinementResponse(response);
  }

  /**
   * Call the Claude API
   * @private
   */
  async _callClaude(systemPrompt, userMessage) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Parse the generation response
   * @private
   */
  _parseGenerationResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.files || typeof parsed.files !== 'object') {
        throw new Error('Response missing files object');
      }

      // Get the main handler code
      const mainCode = parsed.files['api/index.js'] || '';

      return {
        code: mainCode,
        config: parsed.config || { methods: {} },
        suggestedName: parsed.name || 'AI Generated Server',
        suggestedDescription: parsed.description || '',
        files: parsed.files
      };
    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }

  /**
   * Parse the refinement response
   * @private
   */
  _parseRefinementResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.files || typeof parsed.files !== 'object') {
        throw new Error('Response missing files object');
      }

      const mainCode = parsed.files['api/index.js'] || '';

      return {
        code: mainCode,
        config: parsed.config || { methods: {} },
        changes: parsed.changes || [],
        files: parsed.files
      };
    } catch (error) {
      throw new Error(`Failed to parse Claude refinement response: ${error.message}`);
    }
  }
}

// Export singleton instance
export const claudeGenerator = new ClaudeServerGenerator();
