function setupCreateHandler() {
  const createRoute = document.querySelector('app-route-create');
  if (!createRoute) return;

  createRoute.onCreate = async ({ button }) => {
    if (!button) return;
    button.disabled = true;

    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pendingItem = {
      id: pendingId,
      status: "creating",
      created_at: new Date().toISOString()
    };
    const pendingKey = "pendingCreations";
    const pendingList = JSON.parse(sessionStorage.getItem(pendingKey) || "[]");
    pendingList.unshift(pendingItem);
    sessionStorage.setItem(pendingKey, JSON.stringify(pendingList));

    document.dispatchEvent(new CustomEvent("creations-pending-updated"));
    const creationsRoute = document.querySelector("app-route-creations");
    if (creationsRoute && typeof creationsRoute.loadCreations === "function") {
      await creationsRoute.loadCreations();
    }

    // Navigate to Creations page immediately (optimistic UI)
    const header = document.querySelector('app-header');
    if (header && typeof header.handleRouteChange === 'function') {
      window.history.pushState({ route: 'creations' }, '', '/creations');
      header.handleRouteChange();
    } else {
      // Fallback: use hash-based routing
      window.location.hash = 'creations';
    }

    fetch("/api/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create image");
        }
        await response.json();
        return null;
      })
      .then(() => {
        const current = JSON.parse(sessionStorage.getItem(pendingKey) || "[]");
        const next = current.filter(item => item.id !== pendingId);
        sessionStorage.setItem(pendingKey, JSON.stringify(next));
        document.dispatchEvent(new CustomEvent("creations-pending-updated"));
      })
      .catch((error) => {
        const current = JSON.parse(sessionStorage.getItem(pendingKey) || "[]");
        const next = current.filter(item => item.id !== pendingId);
        sessionStorage.setItem(pendingKey, JSON.stringify(next));
        document.dispatchEvent(new CustomEvent("creations-pending-updated"));
        console.error("Error creating image:", error);
      })
      .finally(() => {
        button.disabled = false;
      });
  };
}

window.setupCreateHandler = setupCreateHandler;
