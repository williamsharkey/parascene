// Global components that all pages will use
import './components/header.js';
import './components/profile.js';
import './components/notifications.js';
import './components/nav-bar.js';

// Wait for DOM and custom elements to be ready before showing content
async function initPage() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // Wait for all custom elements to be defined
  const customElementTags = ['app-header', 'app-profile', 'app-notifications'];
  await Promise.all(
    customElementTags.map(tag => customElements.whenDefined(tag))
  );

  // Small delay to ensure components are fully initialized and rendered
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

  // Show the page
  document.body.classList.add('loaded');
}

initPage();