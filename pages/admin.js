const adminDataLoaded = {
  users: false,
  moderation: false,
  providers: false,
  policies: false
};

function renderEmpty(container, message) {
  const empty = document.createElement("div");
  empty.className = "admin-empty";
  empty.textContent = message;
  container.appendChild(empty);
}

function renderError(container, message) {
  const error = document.createElement("div");
  error.className = "admin-error";
  error.textContent = message;
  container.appendChild(error);
}

async function loadUsers() {
  const container = document.querySelector("#users-container");
  if (!container) return;
  if (adminDataLoaded.users) return;

  try {
    const response = await fetch("/admin/users", {
      credentials: 'include'
    });
    if (!response.ok) throw new Error("Failed to load users.");
    const data = await response.json();

    container.innerHTML = "";
    if (!data.users || data.users.length === 0) {
      renderEmpty(container, "No users yet.");
      return;
    }

    for (const user of data.users) {
      const card = document.createElement("div");
      card.className = "card user-card";

      const email = document.createElement("div");
      email.className = "user-email";
      email.textContent = user.email;

      const details = document.createElement("div");
      details.className = "user-details";

      const role = document.createElement("span");
      role.className = "user-role";
      role.textContent = user.role;

      const created = document.createElement("div");
      created.className = "user-created";
      created.textContent = user.created_at;

      details.appendChild(role);

      card.appendChild(email);
      card.appendChild(details);
      card.appendChild(created);

      container.appendChild(card);
    }
    adminDataLoaded.users = true;
  } catch (err) {
    container.innerHTML = "";
    renderError(container, "Error loading users.");
  }
}

async function loadModeration() {
  const container = document.querySelector("#moderation-container");
  if (!container) return;
  if (adminDataLoaded.moderation) return;

  try {
    const response = await fetch("/admin/moderation", {
      credentials: 'include'
    });
    if (!response.ok) throw new Error("Failed to load moderation queue.");
    const data = await response.json();

    container.innerHTML = "";
    if (!data.items || data.items.length === 0) {
      renderEmpty(container, "No moderation items.");
      return;
    }

    for (const item of data.items) {
      const card = document.createElement("div");
      card.className = "card admin-card";

      const title = document.createElement("div");
      title.className = "admin-title";
      title.textContent = `${item.content_type}: ${item.content_id}`;

      const meta = document.createElement("div");
      meta.className = "admin-meta";
      meta.textContent = `Status: ${item.status}`;

      const reason = document.createElement("div");
      reason.className = "admin-detail";
      reason.textContent = item.reason || "No reason provided.";

      const created = document.createElement("div");
      created.className = "admin-timestamp";
      created.textContent = item.created_at;

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(reason);
      card.appendChild(created);

      container.appendChild(card);
    }
    adminDataLoaded.moderation = true;
  } catch (err) {
    container.innerHTML = "";
    renderError(container, "Error loading moderation.");
  }
}

async function loadProviders() {
  const container = document.querySelector("#providers-container");
  if (!container) return;
  if (adminDataLoaded.providers) return;

  try {
    const response = await fetch("/admin/providers");
    if (!response.ok) throw new Error("Failed to load providers.");
    const data = await response.json();

    container.innerHTML = "";
    if (!data.providers || data.providers.length === 0) {
      renderEmpty(container, "No providers registered.");
      return;
    }

    for (const provider of data.providers) {
      const card = document.createElement("div");
      card.className = "card admin-card";

      const name = document.createElement("div");
      name.className = "admin-title";
      name.textContent = provider.name;

      const meta = document.createElement("div");
      meta.className = "admin-meta";
      meta.textContent = `${provider.status} • ${provider.region}`;

      const contact = document.createElement("div");
      contact.className = "admin-detail";
      contact.textContent = provider.contact_email;

      const created = document.createElement("div");
      created.className = "admin-timestamp";
      created.textContent = provider.created_at;

      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(contact);
      card.appendChild(created);

      container.appendChild(card);
    }
    adminDataLoaded.providers = true;
  } catch (err) {
    container.innerHTML = "";
    renderError(container, "Error loading providers.");
  }
}

async function loadPolicies() {
  const container = document.querySelector("#policies-container");
  if (!container) return;
  if (adminDataLoaded.policies) return;

  try {
    const response = await fetch("/admin/policies", {
      credentials: 'include'
    });
    if (!response.ok) throw new Error("Failed to load policies.");
    const data = await response.json();

    container.innerHTML = "";
    if (!data.policies || data.policies.length === 0) {
      renderEmpty(container, "No policies configured.");
      return;
    }

    for (const policy of data.policies) {
      const card = document.createElement("div");
      card.className = "card admin-card";

      const key = document.createElement("div");
      key.className = "admin-title";
      key.textContent = policy.key;

      const value = document.createElement("div");
      value.className = "admin-meta";
      value.textContent = policy.value;

      const description = document.createElement("div");
      description.className = "admin-detail";
      description.textContent = policy.description || "No description.";

      const updated = document.createElement("div");
      updated.className = "admin-timestamp";
      updated.textContent = policy.updated_at;

      card.appendChild(key);
      card.appendChild(value);
      card.appendChild(description);
      card.appendChild(updated);

      container.appendChild(card);
    }
    adminDataLoaded.policies = true;
  } catch (err) {
    container.innerHTML = "";
    renderError(container, "Error loading policies.");
  }
}

function handleAdminRouteChange(route) {
  const normalizedRoute = route === "providers"
    ? "provider-registry"
    : route === "policies"
      ? "policy-knobs"
      : route;

  switch (normalizedRoute) {
    case "moderation":
      loadModeration();
      break;
    case "provider-registry":
      loadProviders();
      break;
    case "policy-knobs":
      loadPolicies();
      break;
    case "users":
    default:
      loadUsers();
      break;
  }
}

const adminHeader = document.querySelector("app-header");
if (adminHeader) {
  adminHeader.addEventListener("route-change", (event) => {
    handleAdminRouteChange(event.detail?.route);
  });
}

const initialRoute =
  window.location.pathname === "/" || window.location.pathname === ""
    ? "users"
    : window.location.pathname.slice(1);
handleAdminRouteChange(initialRoute);