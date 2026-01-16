async function loadUsers() {
  const container = document.querySelector("#users-container");
  if (!container) return;

  try {
    const response = await fetch("/admin/users");
    if (!response.ok) throw new Error("Failed to load users.");
    const data = await response.json();

    container.innerHTML = "";
    if (!data.users || data.users.length === 0) {
      const empty = document.createElement("div");
      empty.className = "users-empty";
      empty.textContent = "No users yet.";
      container.appendChild(empty);
      return;
    }

    for (const user of data.users) {
      const card = document.createElement("div");
      card.className = "user-card";
      
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
  } catch (err) {
    container.innerHTML = "";
    const error = document.createElement("div");
    error.className = "users-error";
    error.textContent = "Error loading users.";
    container.appendChild(error);
  }
}

loadUsers();
