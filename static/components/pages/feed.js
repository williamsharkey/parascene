class AppRouteFeed extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Feed</h3>
      <p>You will find a list of creations here based on factors like popularity, recent activity, your friends, and your interests.</p>
    `;
  }
}

customElements.define("app-route-feed", AppRouteFeed);
