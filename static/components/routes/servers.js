import { formatRelativeTime } from '../../shared/datetime.js';
import { fetchJsonWithStatusDeduped } from '../../shared/api.js';
import { getAvatarColor } from '../../shared/avatar.js';

const html = String.raw;

class AppRouteServers extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
      <div class="servers-route">
        <div class="route-header">
          <h3>Servers</h3>
          <p>Browse and manage image generation servers.</p>
        </div>
        <div class="route-cards admin-cards" data-servers-container>
          <div class="route-empty route-loading">
            <div class="route-loading-spinner" aria-label="Loading" role="status"></div>
          </div>
        </div>
      </div>
    `;

		this.loadServers();
		this.setupEventListeners();
	}

	disconnectedCallback() {
		if (this._serverUpdatedHandler) {
			document.removeEventListener('server-updated', this._serverUpdatedHandler);
		}
	}

	// Listen for server updates from modal
	setupEventListeners() {
		this._serverUpdatedHandler = () => {
			this.loadServers({ force: true });
		};
		document.addEventListener('server-updated', this._serverUpdatedHandler);
	}

	async loadServers({ force = false } = {}) {
		const container = this.querySelector('[data-servers-container]');
		if (!container) return;

		try {
			const result = await fetchJsonWithStatusDeduped('/api/servers', { credentials: 'include' }, { windowMs: 2000 });
			if (!result.ok) {
				throw new Error('Failed to load servers');
			}

			const servers = Array.isArray(result.data?.servers) ? result.data.servers : [];
			this.renderServers(servers, container);
		} catch (error) {
			console.error('Error loading servers:', error);
			container.innerHTML = '<div class="route-empty">Error loading servers.</div>';
		}
	}

	renderServers(servers, container) {
		container.innerHTML = '';

		// Rely on server-side (ID ascending) ordering so client matches API.
		const sortedServers = [...servers];

		sortedServers.forEach(server => {
			const card = document.createElement('div');
			card.className = 'card admin-card server-card';
			card.dataset.serverId = server.id;
			card.style.cursor = 'pointer';

			const badges = [];
			// Special "home" server (id = 1) has a dedicated Home tag.
			if (server.id === 1) {
				badges.push('<span class="server-badge server-badge-member">Home</span>');
			} else {
				if (server.is_owner) {
					badges.push('<span class="server-badge server-badge-owner">Owned</span>');
				}
				if (server.is_member && !server.is_owner) {
					badges.push('<span class="server-badge server-badge-member">Joined</span>');
				}
			}

			const name = document.createElement('div');
			name.className = 'admin-title';
			name.innerHTML = `${server.name || 'Unnamed Server'} ${badges.join('')}`;

			const hasDescription = typeof server.description === 'string' && server.description.trim().length > 0;
			const descriptionText = hasDescription ? server.description.trim() : '';

			card.appendChild(name);

			if (hasDescription) {
				const desc = document.createElement('div');
				desc.className = 'admin-detail';
				desc.textContent = descriptionText;
				card.appendChild(desc);
			}

			// Add owner information if available.
			// Intentionally non-clickable so it doesn't interfere with card click to open the modal.
			if (server.owner && server.id !== 1) {
				const owner = server.owner;
				const ownerDisplayName = owner.display_name || `User ${owner.id}`;
				const ownerUserName = owner.user_name || owner.email_prefix || null;
				const ownerAvatarUrl = owner.avatar_url || null;
				const ownerInitial = ownerDisplayName.trim().charAt(0).toUpperCase() || '?';
				const ownerColor = getAvatarColor(owner.user_name || owner.email_prefix || String(owner.id || ''));

				const ownerInfo = document.createElement('div');
				ownerInfo.className = 'server-owner';

				const ownerRow = document.createElement('div');
				ownerRow.className = 'server-owner-link';

				const avatar = document.createElement('div');
				avatar.className = 'server-owner-avatar';
				avatar.style.background = ownerColor;
				if (ownerAvatarUrl) {
					const img = document.createElement('img');
					img.src = ownerAvatarUrl;
					img.className = 'server-owner-avatar-img';
					img.alt = '';
					avatar.appendChild(img);
				} else {
					avatar.textContent = ownerInitial;
				}

				const ownerText = document.createElement('span');
				ownerText.className = 'server-owner-text';
				ownerText.innerHTML = html`
					<span class="server-owner-name">${ownerDisplayName}</span>
					${ownerUserName ? html`<span class="server-owner-handle">@${ownerUserName}</span>` : ''}
				`;

				ownerRow.appendChild(avatar);
				ownerRow.appendChild(ownerText);
				ownerInfo.appendChild(ownerRow);
				card.appendChild(ownerInfo);
			}

			// Status and timestamp on one line
			const meta = document.createElement('div');
			meta.className = 'admin-meta';
			const statusText = server.status || 'unknown';
			const memberText = (typeof server.members_count === 'number' && server.id !== 1)
				? ` • ${server.members_count} member${server.members_count !== 1 ? 's' : ''}`
				: '';
			const timeText = server.created_at ? formatRelativeTime(server.created_at, { style: 'long' }) : '—';
			meta.textContent = `${statusText}${memberText} • ${timeText}`;

			card.appendChild(meta);

			// Click card to view details
			card.addEventListener('click', () => {
				const modal = document.querySelector('app-modal-server');
				if (modal) {
					modal.open({
						mode: server.can_manage ? 'edit' : 'view',
						serverId: server.id
					});
				}
			});

			container.appendChild(card);
		});

		// Ghost card for adding a custom server (always last).
		const ghostCard = document.createElement('button');
		ghostCard.type = 'button';
		ghostCard.className = 'card server-card server-card-ghost';
		ghostCard.setAttribute('aria-label', 'Add custom server');

		const ghostTitle = document.createElement('div');
		ghostTitle.className = 'server-card-ghost-title';
		ghostTitle.textContent = 'Add custom server';

		const ghostSubtitle = document.createElement('div');
		ghostSubtitle.className = 'server-card-ghost-subtitle';
		ghostSubtitle.textContent = 'Register your own image generation server.';

		ghostCard.appendChild(ghostTitle);
		ghostCard.appendChild(ghostSubtitle);

		ghostCard.addEventListener('click', () => {
			const modal = document.querySelector('app-modal-server');
			if (modal) {
				modal.open({ mode: 'add' });
			}
		});

		container.appendChild(ghostCard);

		// AI Server Generator card (opens modal)
		const aiCard = document.createElement('button');
		aiCard.type = 'button';
		aiCard.className = 'card server-card server-card-ghost';
		aiCard.setAttribute('aria-label', 'Create server with AI');

		const aiTitle = document.createElement('div');
		aiTitle.className = 'server-card-ghost-title';
		aiTitle.textContent = 'Create with AI';

		const aiSubtitle = document.createElement('div');
		aiSubtitle.className = 'server-card-ghost-subtitle';
		aiSubtitle.textContent = 'Generate instructions for AI to build and deploy a server.';

		aiCard.appendChild(aiTitle);
		aiCard.appendChild(aiSubtitle);
		aiCard.addEventListener('click', () => this.openAIGeneratorModal());

		container.appendChild(aiCard);
	}

	openAIGeneratorModal() {
		// Remove existing modal if any
		const existing = document.querySelector('.ai-generator-overlay');
		if (existing) existing.remove();

		const overlay = document.createElement('div');
		overlay.className = 'ai-generator-overlay';

		overlay.innerHTML = html`
			<div class="ai-generator-modal">
				<div class="ai-generator-modal-header">
					<h3>Create Server with AI</h3>
					<button type="button" class="ai-generator-modal-close" data-close>&times;</button>
				</div>

				<div class="ai-generator-modal-body">
					<p class="ai-generator-intro">
						Describe what you want and get complete instructions that an AI assistant (like Claude) can use to create, deploy, and register a custom image generation server for you.
					</p>

					<label class="ai-generator-label">
						<span>I want to create a Parascene server that...</span>
						<textarea
							class="ai-generator-textarea"
							data-ai-prompt
							placeholder="generates voxel hats, rotating 360 degrees as an animated GIF loop"
							rows="3"
						></textarea>
					</label>

					<label class="ai-generator-checkbox-label">
						<input type="checkbox" data-include-token />
						<span>Include credentials for auto-registration</span>
					</label>

					<div class="ai-generator-security-note" data-security-note style="display: none;">
						<strong>Security:</strong> Your session cookie will be included, allowing the AI to register the server under your account automatically. Only use in private, trusted AI conversations. Token expires with your session.
					</div>

					<details class="ai-generator-details">
						<summary>What does the AI need to complete this?</summary>
						<div class="ai-generator-requirements">
							<p>The AI assistant needs access to:</p>
							<ul>
								<li><strong>Terminal/Bash</strong> - to run commands and create files</li>
								<li><strong>Vercel CLI</strong> - installed and logged in (<code>npm i -g vercel && vercel login</code>)</li>
								<li><strong>Git</strong> - to create and push to a repository</li>
								<li><strong>Node.js & npm</strong> - to install dependencies</li>
								<li><strong>Network access</strong> - to deploy and register the server</li>
							</ul>
							<p><strong>What is Vercel?</strong> A free cloud platform for hosting serverless APIs. The AI will create a project, deploy it to Vercel, and give you a public URL.</p>
							<p><strong>What happens?</strong> The AI creates the code, deploys it, and (if credentials included) registers it here so you just refresh and it appears.</p>
						</div>
					</details>
				</div>

				<div class="ai-generator-modal-actions">
					<div class="ai-generator-copied" data-copied-msg style="display: none;">
						Copied to clipboard!
					</div>
					<button type="button" class="ai-generator-btn ai-generator-btn-secondary" data-view-prompt>
						View Instructions
					</button>
					<button type="button" class="ai-generator-btn ai-generator-btn-primary" data-copy-prompt>
						Copy to Clipboard
					</button>
				</div>
			</div>
		`;

		// Setup event listeners
		const closeModal = () => overlay.remove();

		overlay.querySelector('[data-close]').addEventListener('click', closeModal);
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) closeModal();
		});

		const tokenCheckbox = overlay.querySelector('[data-include-token]');
		const securityNote = overlay.querySelector('[data-security-note]');
		const viewBtn = overlay.querySelector('[data-view-prompt]');
		const copyBtn = overlay.querySelector('[data-copy-prompt]');
		const promptTextarea = overlay.querySelector('[data-ai-prompt]');
		const copiedMsg = overlay.querySelector('[data-copied-msg]');

		tokenCheckbox.addEventListener('change', () => {
			securityNote.style.display = tokenCheckbox.checked ? 'block' : 'none';
		});

		viewBtn.addEventListener('click', async () => {
			const token = tokenCheckbox.checked ? await this.fetchRegistrationToken() : null;
			if (tokenCheckbox.checked && !token) return; // Failed to get token
			const markdown = this.generateAIPrompt(promptTextarea.value, token);
			this.showMarkdownModal(markdown);
		});

		copyBtn.addEventListener('click', async () => {
			const token = tokenCheckbox.checked ? await this.fetchRegistrationToken() : null;
			if (tokenCheckbox.checked && !token) return; // Failed to get token
			const markdown = this.generateAIPrompt(promptTextarea.value, token);
			try {
				await navigator.clipboard.writeText(markdown);
				copiedMsg.style.display = 'flex';
				setTimeout(() => {
					copiedMsg.style.display = 'none';
				}, 2000);
			} catch (err) {
				console.error('Failed to copy:', err);
				this.showMarkdownModal(markdown);
			}
		});

		document.body.appendChild(overlay);
		promptTextarea.focus();
	}

	async fetchRegistrationToken() {
		try {
			const response = await fetch('/api/servers/registration-token', {
				method: 'GET',
				credentials: 'include'
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				alert(data.error || 'Failed to generate registration token. Please try again.');
				return null;
			}
			const data = await response.json();
			return data.token;
		} catch (error) {
			console.error('Error fetching registration token:', error);
			alert('Failed to generate registration token. Please check your connection.');
			return null;
		}
	}

	generateAIPrompt(userDescription, registrationToken) {
		const parasceneUrl = window.location.origin;
		const description = userDescription.trim() || 'custom image generator';

		let authSection = '';
		if (registrationToken) {
			authSection = `
## Auto-Registration Credentials

The user has authorized automatic server registration. Use these credentials to register the server after deployment:

- **Parascene URL:** ${parasceneUrl}
- **Registration Token:** \`${registrationToken}\`

To register the server, make a POST request:
\`\`\`bash
curl -X POST "${parasceneUrl}/api/servers" \\
  -H "Content-Type: application/json" \\
  -H "Cookie: ps_session=${registrationToken}" \\
  -d '{
    "name": "YOUR_SERVER_NAME",
    "server_url": "YOUR_DEPLOYED_URL",
    "auth_token": "YOUR_API_KEY",
    "description": "YOUR_DESCRIPTION"
  }'
\`\`\`

**Note:** This token expires in 1 hour. Complete the registration before it expires.
`;
		}

		return `# Parascene Server Creation Request

I want to create a Parascene-compatible image generation server that: **${description}**

## Prerequisites for AI Agent

To complete this task, you need access to:

1. **Terminal/Bash** - To run commands, create files, and execute scripts
2. **Vercel CLI** - Must be installed (\`npm i -g vercel\`) and logged in (\`vercel login\`)
3. **Git** - To create repos and push code
4. **GitHub CLI (gh)** - Optional but helpful for creating repos (\`gh repo create\`)
5. **Node.js & npm** - To install dependencies and test locally
6. **File system access** - To create project files and directories
7. **Network access** - To deploy to Vercel and${registrationToken ? ' register with Parascene' : ' test the deployment'}

**Verify Vercel is ready:**
\`\`\`bash
vercel --version  # Should show version
vercel whoami     # Should show logged-in user
\`\`\`

If Vercel CLI is not logged in, the user must run \`vercel login\` first.

## What is Parascene?

Parascene is a platform for generative art. Users can connect to "provider servers" that generate images on demand. Each provider server exposes an API that Parascene calls to generate images.

## What is Vercel?

Vercel is a cloud platform for deploying serverless functions and static sites. It's free for hobby projects and perfect for hosting image generation APIs. You deploy by pushing to GitHub and Vercel automatically builds and hosts your code.

## Reference Repositories

Study these repositories to understand the patterns:

1. **Parascene Platform:** https://github.com/crosshj/parascene
   - The main platform that calls provider servers
   - See \`api_routes/create.js\` for how it calls providers

2. **Example Provider:** https://github.com/crosshj/parascene-provider
   - Simple reference implementation
   - Shows the required API structure

## Required API Structure

Your server must implement this exact API:

### GET / (Capabilities Endpoint)
Returns server info and available generation methods.

\`\`\`javascript
// Response format:
{
  "status": "operational",
  "name": "Your Server Name",
  "description": "What your server does",
  "icon": "https://your-server.vercel.app/branding/icon.png",      // Optional
  "banner": "https://your-server.vercel.app/branding/banner.png",  // Optional
  "methods": {
    "method_name": {
      "name": "Display Name",
      "description": "What this method generates",
      "credits": 0.25,
      "fields": {},  // Empty for no options, or define input fields
      "preview": "https://your-server.vercel.app/previews/example.png"  // Optional
    }
  }
}
\`\`\`

### POST / (Generation Endpoint)
Generates and returns an image.

**Request body:**
\`\`\`json
{
  "method": "method_name",
  "options": {}
}
\`\`\`

**Response:** Return the image binary with these headers:
- \`Content-Type\`: \`image/png\` or \`image/gif\`
- \`X-Image-Width\`: Image width in pixels
- \`X-Image-Height\`: Image height in pixels
- \`X-Image-Seed\`: Random seed used (for reproducibility)
- \`X-Image-Color\`: Hex color representing the image (e.g., \`#ff5500\`)
- \`X-Image-Name\`: Suggested title for the image (optional)
- \`X-Image-Description\`: Suggested description (optional)

### Authentication

Both endpoints require Bearer token authentication:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Validate with:
\`\`\`javascript
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.YOUR_API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
\`\`\`

## Implementation Steps

1. **Create a new GitHub repository** for your server

2. **Create the project structure:**
   \`\`\`
   your-server/
   ├── api/
   │   └── index.js          # Main API handler
   ├── public/
   │   ├── branding/
   │   │   ├── icon.png      # 128x128 server icon
   │   │   └── banner.png    # 768x256 banner
   │   └── previews/
   │       └── example.png   # Preview for each method
   ├── vercel.json           # Vercel configuration
   └── package.json
   \`\`\`

3. **Create vercel.json:**
   \`\`\`json
   {
     "version": 2,
     "builds": [
       { "src": "api/index.js", "use": "@vercel/node" },
       { "src": "public/**", "use": "@vercel/static" }
     ],
     "routes": [
       { "src": "/api", "dest": "/api/index.js" },
       { "src": "/branding/(.*)", "dest": "/public/branding/$1" },
       { "src": "/previews/(.*)", "dest": "/public/previews/$1" },
       { "src": "/(.*\\\\.png)", "dest": "/public/$1" },
       { "src": "/(.*\\\\.gif)", "dest": "/public/$1" }
     ]
   }
   \`\`\`

4. **Create package.json:**
   \`\`\`json
   {
     "name": "your-server-name",
     "version": "1.0.0",
     "dependencies": {
       "sharp": "^0.33.0"
     }
   }
   \`\`\`

5. **Implement api/index.js** with the image generation logic

6. **Deploy to Vercel:**
   - Connect your GitHub repo to Vercel
   - Add environment variable for your API key
   - Deploy

7. **Register with Parascene** (see below)

## User's Request

Create a server that generates: **${description}**

Requirements:
- Output should be 1024x1024 pixels
- Use \`sharp\` for image processing if needed
- Generate unique images each time (use random seeds)
- Return appropriate headers for Parascene integration
- Include preview images showing example output
- Include icon and banner for branding
${authSection}
## After Deployment

${registrationToken ? `Use the auto-registration credentials above to register the server automatically.` : `The user will manually register the server at ${parasceneUrl}/servers using:
- The deployed Vercel URL
- The API key set in Vercel environment variables`}

## Important Notes

- Keep the code simple and focused on the generation task
- Don't over-engineer - start with basic functionality
- Test locally with \`vercel dev\` before deploying
- Make sure all static assets (icons, previews) are generated and committed
`;
	}

	showMarkdownModal(markdown) {
		// Create a simple modal to display the markdown
		const overlay = document.createElement('div');
		overlay.className = 'ai-markdown-overlay';
		overlay.innerHTML = html`
			<div class="ai-markdown-modal">
				<div class="ai-markdown-header">
					<h3>AI Server Creation Instructions</h3>
					<button type="button" class="ai-markdown-close">&times;</button>
				</div>
				<div class="ai-markdown-content">
					<pre class="ai-markdown-pre"></pre>
				</div>
				<div class="ai-markdown-actions">
					<button type="button" class="ai-generator-btn ai-generator-btn-primary" data-modal-copy>
						Copy to Clipboard
					</button>
				</div>
			</div>
		`;

		// Set text content safely (not innerHTML to avoid XSS)
		overlay.querySelector('.ai-markdown-pre').textContent = markdown;

		const closeModal = () => overlay.remove();

		overlay.querySelector('.ai-markdown-close').addEventListener('click', closeModal);
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) closeModal();
		});

		overlay.querySelector('[data-modal-copy]').addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(markdown);
				const btn = overlay.querySelector('[data-modal-copy]');
				btn.textContent = 'Copied!';
				setTimeout(() => {
					btn.textContent = 'Copy to Clipboard';
				}, 2000);
			} catch (err) {
				alert('Failed to copy');
			}
		});

		document.body.appendChild(overlay);
	}

	async handleJoin(serverId) {
		try {
			const response = await fetch(`/api/servers/${serverId}/join`, {
				method: 'POST',
				credentials: 'include'
			});

			const data = await response.json();
			if (!response.ok) {
				alert(data.error || 'Failed to join server');
				return;
			}

			// Reload servers
			await this.loadServers({ force: true });
		} catch (error) {
			console.error('Error joining server:', error);
			alert('Failed to join server');
		}
	}

	async handleLeave(serverId) {
		if (!confirm('Are you sure you want to leave this server?')) {
			return;
		}

		try {
			const response = await fetch(`/api/servers/${serverId}/leave`, {
				method: 'POST',
				credentials: 'include'
			});

			const data = await response.json();
			if (!response.ok) {
				alert(data.error || 'Failed to leave server');
				return;
			}

			// Reload servers
			await this.loadServers({ force: true });
		} catch (error) {
			console.error('Error leaving server:', error);
			alert('Failed to leave server');
		}
	}
}

customElements.define('app-route-servers', AppRouteServers);
