class AppRouteTemplates extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Templates</h3>
      <p>Templates content goes here...</p>
    `;
  }
}

customElements.define("app-route-templates", AppRouteTemplates);
