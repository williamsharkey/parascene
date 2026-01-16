import bcrypt from "bcryptjs";

const now = new Date().toISOString();

const users = [
  {
    id: 1,
    email: "consumer@example.com",
    password_hash: bcrypt.hashSync("p123@#", 12),
    role: "consumer",
    created_at: now
  },
  {
    id: 2,
    email: "creator@example.com",
    password_hash: bcrypt.hashSync("p123@#", 12),
    role: "creator",
    created_at: now
  },
  {
    id: 3,
    email: "provider@example.com",
    password_hash: bcrypt.hashSync("p123@#", 12),
    role: "provider",
    created_at: now
  },
  {
    id: 4,
    email: "admin@example.com",
    password_hash: bcrypt.hashSync("p123@#", 12),
    role: "admin",
    created_at: now
  }
];

const moderation_queue = [
  {
    id: 1,
    content_type: "post",
    content_id: "post_1042",
    status: "pending",
    reason: "Possible spam links",
    created_at: now
  },
  {
    id: 2,
    content_type: "comment",
    content_id: "comment_221",
    status: "review",
    reason: "Reported for harassment",
    created_at: now
  }
];

const provider_registry = [
  {
    id: 1,
    name: "Aurora Streaming",
    status: "active",
    region: "NA",
    contact_email: "ops@aurorastreaming.example.com",
    created_at: now
  },
  {
    id: 2,
    name: "Nimbus Render",
    status: "pending",
    region: "EU",
    contact_email: "support@nimbusrender.example.com",
    created_at: now
  }
];

const provider_statuses = [
  {
    id: 1,
    provider_name: "Aurora Streaming",
    status: "operational",
    region: "NA",
    uptime_pct: 99.98,
    capacity_pct: 72,
    last_check_at: now
  },
  {
    id: 2,
    provider_name: "Nimbus Render",
    status: "degraded",
    region: "EU",
    uptime_pct: 98.62,
    capacity_pct: 91,
    last_check_at: now
  }
];

const provider_metrics = [
  {
    id: 1,
    name: "Jobs processed",
    value: "12,480",
    unit: "jobs",
    change: "+4.2%",
    period: "Last 7 days",
    description: "Completed renders across all regions.",
    updated_at: now
  },
  {
    id: 2,
    name: "Average queue time",
    value: "3.6",
    unit: "min",
    change: "-12%",
    period: "Last 24 hours",
    description: "Median time from submission to start.",
    updated_at: now
  }
];

const provider_grants = [
  {
    id: 1,
    name: "Render Efficiency Initiative",
    sponsor: "Aurora Labs",
    amount: "$120k",
    status: "active",
    next_report: "2026-03-15",
    awarded_at: now
  }
];

const provider_templates = [
  {
    id: 1,
    name: "Moodboard Starter",
    category: "Pre-production",
    version: "1.2",
    deployments: 38,
    updated_at: now
  }
];

const policy_knobs = [
  {
    id: 1,
    key: "auto_moderation",
    value: "enabled",
    description: "Toggle auto-queueing for flagged content.",
    updated_at: now
  },
  {
    id: 2,
    key: "provider_review_window_days",
    value: "14",
    description: "Days between provider reviews.",
    updated_at: now
  }
];

const notifications = [
  {
    id: 1,
    user_id: 1,
    role: null,
    title: "Welcome to Parascene",
    message: "Your account is ready. Explore the latest feed items.",
    link: "/feed",
    created_at: now,
    acknowledged_at: null
  },
  {
    id: 2,
    user_id: null,
    role: "provider",
    title: "Provider status update",
    message: "New uptime checks are available.",
    link: "/provider/status",
    created_at: now,
    acknowledged_at: null
  }
];

const feed_items = [
  {
    id: 1,
    title: "Render Week Highlights",
    summary: "Top community renders and pipeline insights.",
    author: "Parascene Team",
    tags: "community,render",
    created_at: now
  },
  {
    id: 2,
    title: "Creator Spotlight: Nimbus",
    summary: "A deep dive into last month’s leading creator workflows.",
    author: "Parascene Team",
    tags: "creator,workflow",
    created_at: now
  }
];

const explore_items = [
  {
    id: 1,
    title: "Starter Kit",
    summary: "Jump-start your next scene with curated templates.",
    category: "Templates",
    created_at: now
  }
];

const posts = [
  {
    id: 1,
    user_id: 1,
    title: "First draft",
    body: "Draft notes for the next scene.",
    status: "draft",
    created_at: now
  }
];

const servers = [
  {
    id: 1,
    name: "Aurora Prime",
    region: "NA",
    status: "online",
    members_count: 128,
    description: "Primary NA rendering cluster.",
    created_at: now
  }
];

const templates = [
  {
    id: 1,
    name: "Shot Breakdown",
    category: "Production",
    description: "Track shots, frame ranges, and dependencies.",
    created_at: now
  }
];

function makeStatement({ get, all, run }) {
  return {
    get: get || (() => undefined),
    all: all || (() => []),
    run: run || (() => ({ changes: 0 }))
  };
}

function openMockDb() {
  let nextUserId = users.length + 1;
  let nextNotificationId = notifications.length + 1;

  const queries = {
    selectUserByEmail: makeStatement({
      get: (email) => users.find((user) => user.email === email)
    }),
    selectUserById: makeStatement({
      get: (id) => {
        const user = users.find((entry) => entry.id === Number(id));
        if (!user) return undefined;
        const { password_hash, ...safeUser } = user;
        return safeUser;
      }
    }),
    insertUser: makeStatement({
      run: (email, password_hash, role) => {
        const user = {
          id: nextUserId++,
          email,
          password_hash,
          role,
          created_at: new Date().toISOString()
        };
        users.push(user);
        return { lastInsertRowid: user.id, changes: 1 };
      }
    }),
    selectUsers: makeStatement({
      all: () =>
        users.map(({ password_hash, ...safeUser }) => ({ ...safeUser }))
    }),
    selectModerationQueue: makeStatement({
      all: () => [...moderation_queue]
    }),
    selectProviders: makeStatement({
      all: () => [...provider_registry]
    }),
    selectProviderStatuses: makeStatement({
      all: () => [...provider_statuses]
    }),
    selectProviderMetrics: makeStatement({
      all: () => [...provider_metrics]
    }),
    selectProviderGrants: makeStatement({
      all: () => [...provider_grants]
    }),
    selectProviderTemplates: makeStatement({
      all: () => [...provider_templates]
    }),
    selectPolicies: makeStatement({
      all: () => [...policy_knobs]
    }),
    selectNotificationsForUser: makeStatement({
      all: (userId, role) =>
        notifications.filter(
          (note) => note.user_id === userId || note.role === role
        )
    }),
    selectUnreadNotificationCount: makeStatement({
      get: (userId, role) => ({
        count: notifications.filter(
          (note) =>
            !note.acknowledged_at &&
            (note.user_id === userId || note.role === role)
        ).length
      })
    }),
    acknowledgeNotificationById: makeStatement({
      run: (id, userId, role) => {
        const notification = notifications.find(
          (note) =>
            note.id === Number(id) &&
            !note.acknowledged_at &&
            (note.user_id === userId || note.role === role)
        );
        if (!notification) {
          return { changes: 0 };
        }
        notification.acknowledged_at = new Date().toISOString();
        return { changes: 1 };
      }
    }),
    selectFeedItems: makeStatement({
      all: () => [...feed_items]
    }),
    selectExploreItems: makeStatement({
      all: () => [...explore_items]
    }),
    selectPostsForUser: makeStatement({
      all: (userId) => posts.filter((post) => post.user_id === Number(userId))
    }),
    selectServers: makeStatement({
      all: () => [...servers]
    }),
    selectTemplates: makeStatement({
      all: () => [...templates]
    })
  };

  const db = {
    prepare: () => makeStatement({}),
    exec: () => {}
  };

  return { db, queries };
}

export { openMockDb };
