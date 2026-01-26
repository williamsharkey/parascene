import { getBaseAppUrl } from "../api_routes/utils/url.js";

const html = String.raw;

const BRAND_NAME = "parascene";
const BRAND_COLOR = "#0f172a";
const ACCENT_COLOR = "#7c3aed";

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderImpersonationBar({ originalRecipient, reason } = {}) {
	if (!originalRecipient) return "";
	const safeName = escapeHtml(originalRecipient?.name || "Unknown");
	const safeEmail = escapeHtml(originalRecipient?.email || "unknown");
	const safeUserId = escapeHtml(
		Number.isFinite(Number(originalRecipient?.userId)) ? Number(originalRecipient.userId) : "unknown"
	);
	const safeReason = escapeHtml(reason || "Suppressed recipient");

	return html`
    <tr>
      <td style="background:#fff7ed; border-bottom:1px solid #ea580c; padding:12px 24px; text-align:left;">
        <div style="color:#9a3412; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">
          Delegated delivery
        </div>
        <div style="color:#7c2d12; font-size:13px; line-height:1.6;">
          <div><strong>Original recipient</strong>: ${safeName} (${safeEmail})</div>
          <div><strong>User ID</strong>: ${safeUserId}</div>
          <div><strong>Reason</strong>: ${safeReason}</div>
        </div>
      </td>
    </tr>
  `;
}

// Base email layout function
// ctaText: Text for the call-to-action button (e.g., "Visit Us", "View the creation")
// ctaUrl: Full URL for the CTA link (e.g., "https://parascene.crosshj.com" or "https://parascene.crosshj.com/creations/123")
//         Defaults to base URL (homepage) if not provided
function baseEmailLayout({ preheader, title, bodyHtml, ctaText, ctaUrl = getBaseAppUrl(), footerText, topNotice }) {
	const safePreheader = escapeHtml(preheader || "");
	const safeTitle = escapeHtml(title || "");
	const safeFooter = escapeHtml(footerText || `© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`);
	const ctaBlock = ctaText
		? html`
      <div style="margin:28px 0 12px; text-align:center;">
        <a href="${ctaUrl}"
           style="background:${ACCENT_COLOR}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:18px; font-weight:600; font-size:16px; letter-spacing:0.2px; display:inline-block; min-width:240px; text-align:center;">
          ${escapeHtml(ctaText)}
        </a>
      </div>
    `
		: "";

	const emailNotice =
		topNotice?.type === "impersonation" ?
			`<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
				${renderImpersonationBar(topNotice.data)}
			</table>`
			: "";

	return html`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0; padding:0; background:#f5f7fb;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${safePreheader}
    </div>
    ${emailNotice}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f7fb; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px; color:${BRAND_COLOR}; font-size:24px; line-height:1.3;">
                  ${safeTitle}
                </h1>
                <div style="color:#334155; font-size:15px; line-height:1.7;">
                  ${bodyHtml}
                </div>
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background:#f8fafc; color:#64748b; font-size:12px; line-height:1.6; text-align:center;">
                ${safeFooter}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export function renderHelloFromParascene({ recipientName = "there" } = {}) {
	const safeName = escapeHtml(recipientName);
	const subject = "Hello from parascene";
	const preheader = "A quick hello from the parascene team.";
	const bodyHtml = html`
    <p style="margin:0 0 12px;">Hi ${safeName},</p>
    <p style="margin:0 0 12px;">
      Thanks for being part of parascene. We’re building a place to turn prompts into
      scenes that feel cinematic and personal.
    </p>
    <p style="margin:0 0 12px;">
      If you want a quick walkthrough, start with a template or dive straight into creation.
      We’re always here if you need a hand.
    </p>
    <p style="margin:0;">Warmly,<br />The parascene team</p>
  `;
	const emailHtml = baseEmailLayout({
		preheader,
		title: subject,
		bodyHtml,
		ctaText: "Visit Us",
		ctaUrl: getBaseAppUrl(),
		footerText: "You’re receiving this email because you’re connected to parascene."
	});
	const text = [
		`Hi ${recipientName},`,
		"",
		"Thanks for being part of parascene. We’re building a place to turn prompts into scenes that feel cinematic and personal.",
		"",
		"If you want a quick walkthrough, start with a template or dive straight into creation.",
		"",
		"Warmly,",
		"The parascene team"
	].join("\n");

	return { subject, html: emailHtml, text };
}

function truncateMiddle(value, max = 240) {
	const s = String(value ?? "");
	if (s.length <= max) return s;
	const keepStart = Math.max(0, Math.floor(max * 0.7));
	const keepEnd = Math.max(0, max - keepStart - 1);
	return `${s.slice(0, keepStart)}…${s.slice(s.length - keepEnd)}`;
}

// Render comment received email template
// creationUrl: Full URL to the specific creation (e.g., "https://parascene.crosshj.com/creations/123")
//              Defaults to base URL (homepage) if not provided
export function renderCommentReceived({
	recipientName = "there",
	commenterName = "Someone",
	commentText = "",
	creationTitle = "",
	creationUrl = getBaseAppUrl(), // Full URL to creation, falls back to homepage if not provided
	impersonation = null
} = {}) {
	const safeRecipient = escapeHtml(recipientName);
	const safeCommenter = escapeHtml(commenterName);
	const safeTitle = escapeHtml(creationTitle || "your creation");
	const safeComment = escapeHtml(truncateMiddle(commentText, 600));

	const subject = `New comment on ${creationTitle ? creationTitle : "your creation"}`;
	const preheader = `${commenterName || "Someone"} left a comment on ${creationTitle ? creationTitle : "your creation"}.`;

	const bodyHtml = html`
    <p style="margin:0 0 12px;">Hi ${safeRecipient},</p>
    <p style="margin:0 0 12px;">
      <strong>${safeCommenter}</strong> commented on <strong>${safeTitle}</strong>.
    </p>
    <div style="margin:16px 0 0; padding:14px 16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
      <div style="color:#475569; font-size:13px; margin:0 0 6px;">Comment</div>
      <div style="white-space:pre-wrap; color:#0f172a; font-size:15px; line-height:1.6;">${safeComment}</div>
    </div>
  `;

	const emailHtml = baseEmailLayout({
		preheader,
		title: "You got a comment",
		bodyHtml,
		topNotice: impersonation ? { type: "impersonation", data: impersonation } : null,
		ctaText: "View the creation",
		ctaUrl: creationUrl,
		footerText: "You’re receiving this email because someone commented on your creation."
	});

	const impersonationText = impersonation?.originalRecipient
		? [
			"",
			"--- Delegated delivery ---",
			`Original recipient: ${impersonation.originalRecipient?.name || "Unknown"} (${impersonation.originalRecipient?.email || "unknown"})`,
			`User ID: ${Number.isFinite(Number(impersonation.originalRecipient?.userId))
				? Number(impersonation.originalRecipient.userId)
				: "unknown"
			}`,
			`Reason: ${impersonation.reason || "Suppressed recipient"}`,
			"---"
		].join("\n")
		: "";

	const textLines = [];

	if (impersonationText) {
		textLines.push(impersonationText, "");
	}

	textLines.push(
		`Hi ${recipientName},`,
		"",
		`${commenterName} commented on ${creationTitle || "your creation"}:`,
		"",
		truncateMiddle(commentText, 1200),
		"",
		`View the creation: ${creationUrl}`
	);

	const text = textLines.join("\n");

	return { subject, html: emailHtml, text };
}

export const templates = {
	helloFromParascene: renderHelloFromParascene,
	commentReceived: renderCommentReceived
};
