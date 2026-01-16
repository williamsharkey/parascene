class AppRouteServers extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Servers</h3>
      <p>You will find a list of servers here that you can join as well as those you have already joined.</p>
    `;
  }
}

customElements.define("app-route-servers", AppRouteServers);
