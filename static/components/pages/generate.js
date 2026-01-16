class AppRouteGenerate extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Generate</h3>
      <p>You will see controls here that allow you to generate new creations.</p>
    `;
  }
}

customElements.define("app-route-generate", AppRouteGenerate);
