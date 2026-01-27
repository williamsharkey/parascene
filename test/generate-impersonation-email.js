import { renderCommentReceived } from "../email/templates.js";
import { writeFileSync } from "fs";

const result = renderCommentReceived({
	recipientName: "new",
	commenterName: "consumer",
	commentText: "Vicar-vicar. Snicker!",
	creationTitle: "Find the Vicar",
	creationUrl: "https://parascene.crosshj.com/creation/123",
	impersonation: {
		originalRecipient: {
			name: "new",
			email: "new@example.com",
			userId: 18
		},
		reason: "Suppressed domain match (example.com)"
	}
});

const outputPath = "./.output/test-impersonation-email.html";
writeFileSync(outputPath, result.html, "utf8");

console.log(`✅ Email HTML written to: ${outputPath}`);
console.log(`📧 Subject: ${result.subject}`);
console.log(`\nOpen ${outputPath} in your browser to view the email.`);
