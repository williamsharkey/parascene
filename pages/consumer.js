// Page-specific behavior for consumer.html
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.setupCreateHandler === "function") {
      window.setupCreateHandler();
    }
  });
} else if (typeof window.setupCreateHandler === "function") {
  window.setupCreateHandler();
}
