// Page-specific behavior for creator.html
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.setupCreateHandler === "function") {
      window.setupCreateHandler();
    }
  });
} else if (typeof window.setupCreateHandler === "function") {
  window.setupCreateHandler();
}
