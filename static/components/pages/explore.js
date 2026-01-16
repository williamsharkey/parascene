class AppRouteExplore extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Explore</h3>
      <p>You will find a list of creations here based on factors that are outside you current configuration.</p>
    `;
  }
}

customElements.define("app-route-explore", AppRouteExplore);
