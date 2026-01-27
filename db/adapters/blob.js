/**
 * Vercel Blob adapter - stores entire DB state in a single JSON blob
 * Simple, cheap, good for test servers with light traffic
 *
 * Set BLOB_READ_WRITE_TOKEN in your Vercel environment
 * Set DB_ADAPTER=blob to use this adapter
 */

import { put, head, del } from '@vercel/blob';

const BLOB_KEY = 'parascene-db.json';

// In-memory state (loaded from blob on first access)
let state = null;
let stateLoaded = false;
let saveTimeout = null;

const EMPTY_STATE = {
  users: [],
  user_profiles: [],
  sessions: [],
  moderation_queue: [],
  servers: [],
  server_members: [],
  policy_knobs: [],
  notifications: [],
  feed_items: [],
  explore_items: [],
  creations: [],
  templates: [],
  created_images: [],
  user_credits: [],
  user_follows: [],
  likes_created_image: [],
  comments_created_image: [],
  // ID counters
  _nextUserId: 1,
  _nextNotificationId: 1,
  _nextUserCreditsId: 1,
  _nextSessionId: 1,
  _nextServerId: 1,
  _nextCreatedImageId: 1,
};

async function loadState() {
  if (stateLoaded) return state;

  console.log('[blob] Loading state... BLOB_KEY:', BLOB_KEY);
  console.log('[blob] Token present:', !!process.env.BLOB_READ_WRITE_TOKEN);

  try {
    // Check if blob exists
    const blobInfo = await head(BLOB_KEY).catch((e) => {
      console.log('[blob] head() returned:', e?.message || 'null');
      return null;
    });

    if (blobInfo) {
      console.log('[blob] Found existing blob:', blobInfo.url);
      const response = await fetch(blobInfo.url);
      if (response.ok) {
        state = await response.json();
        console.log('[blob] Loaded state from blob, users:', state.users?.length || 0);
      } else {
        state = { ...EMPTY_STATE };
        console.log('[blob] Blob fetch failed, created new empty state');
      }
    } else {
      state = { ...EMPTY_STATE };
      console.log('[blob] No existing blob, created new state');
    }
  } catch (error) {
    console.warn('[blob] Error loading state:', error.message);
    state = { ...EMPTY_STATE };
  }

  stateLoaded = true;
  return state;
}

async function saveState() {
  if (!state) {
    console.log('[blob] No state to save');
    return;
  }

  console.log('[blob] saveState called, token present:', !!process.env.BLOB_READ_WRITE_TOKEN);
  console.log('[blob] Users in state:', state.users?.length || 0);

  try {
    const data = JSON.stringify(state);
    console.log('[blob] Saving state...', data.length, 'bytes, users:', state.users?.map(u => u.email));
    const result = await put(BLOB_KEY, data, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    console.log('[blob] SUCCESS saved to blob:', result.url);
    return result;
  } catch (error) {
    console.error('[blob] FAILED to save state:', error.message);
    console.error('[blob] Error stack:', error.stack);
    throw error; // Re-throw to make caller aware
  }
}

// On serverless, we must save immediately since the function may terminate
// For local dev, we could debounce, but keeping it simple with immediate saves
async function scheduleSave() {
  try {
    // Always save immediately on serverless (no debouncing)
    await saveState();
  } catch (error) {
    console.error('[blob] scheduleSave error:', error.message);
    throw error; // Re-throw to make failures visible
  }
}

// Force immediate save (for critical operations)
async function forceSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await saveState();
}

const TABLE_TIMESTAMP_FIELDS = {
  users: ['created_at'],
  user_profiles: ['created_at', 'updated_at'],
  moderation_queue: ['created_at'],
  servers: ['created_at', 'updated_at', 'status_date'],
  policy_knobs: ['updated_at'],
  notifications: ['created_at'],
  feed_items: ['created_at'],
  explore_items: ['created_at'],
  creations: ['created_at'],
  templates: ['created_at'],
  created_images: ['created_at'],
  user_follows: ['created_at'],
};

export function openDb() {
  const queries = {
    selectUserByEmail: {
      get: async (email) => {
        const s = await loadState();
        return s.users.find((user) => user.email === email);
      }
    },
    selectUserById: {
      get: async (id) => {
        const s = await loadState();
        const user = s.users.find((entry) => entry.id === Number(id));
        if (!user) return undefined;
        const { password_hash, ...safeUser } = user;
        return safeUser;
      }
    },
    selectUserProfileByUserId: {
      get: async (userId) => {
        const s = await loadState();
        return s.user_profiles.find((row) => row.user_id === Number(userId));
      }
    },
    selectUserProfileByUsername: {
      get: async (userName) => {
        const s = await loadState();
        return s.user_profiles.find((row) => row.user_name === String(userName));
      }
    },
    upsertUserProfile: {
      run: async (userId, profile) => {
        const s = await loadState();
        const id = Number(userId);
        const now = new Date().toISOString();
        const existing = s.user_profiles.find((row) => row.user_id === id);
        const next = {
          user_id: id,
          user_name: profile?.user_name ?? null,
          display_name: profile?.display_name ?? null,
          about: profile?.about ?? null,
          socials: profile?.socials ?? null,
          avatar_url: profile?.avatar_url ?? null,
          cover_image_url: profile?.cover_image_url ?? null,
          badges: profile?.badges ?? null,
          meta: profile?.meta ?? null,
          created_at: existing?.created_at ?? now,
          updated_at: now
        };
        if (existing) {
          Object.assign(existing, next);
        } else {
          s.user_profiles.push(next);
        }
        await scheduleSave();
        return { changes: 1 };
      }
    },
    selectSessionByTokenHash: {
      get: async (tokenHash, userId) => {
        const s = await loadState();
        return s.sessions.find(
          (session) =>
            session.token_hash === tokenHash &&
            session.user_id === Number(userId)
        );
      }
    },
    insertUser: {
      run: async (email, password_hash, role) => {
        const s = await loadState();
        const user = {
          id: s._nextUserId++,
          email,
          password_hash,
          role,
          created_at: new Date().toISOString()
        };
        s.users.push(user);
        await scheduleSave();
        return { insertId: user.id, lastInsertRowid: user.id, changes: 1 };
      }
    },
    insertSession: {
      run: async (userId, tokenHash, expiresAt) => {
        const s = await loadState();
        const session = {
          id: s._nextSessionId++,
          user_id: Number(userId),
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        };
        s.sessions.push(session);
        await scheduleSave();
        return { insertId: session.id, lastInsertRowid: session.id, changes: 1 };
      }
    },
    refreshSessionExpiry: {
      run: async (id, expiresAt) => {
        const s = await loadState();
        const session = s.sessions.find((entry) => entry.id === Number(id));
        if (!session) return { changes: 0 };
        session.expires_at = expiresAt;
        await scheduleSave();
        return { changes: 1 };
      }
    },
    deleteSessionByTokenHash: {
      run: async (tokenHash, userId) => {
        const s = await loadState();
        const beforeCount = s.sessions.length;
        if (userId) {
          s.sessions = s.sessions.filter(
            (sess) => !(sess.token_hash === tokenHash && sess.user_id === Number(userId))
          );
        } else {
          s.sessions = s.sessions.filter((sess) => sess.token_hash !== tokenHash);
        }
        if (s.sessions.length !== beforeCount) await scheduleSave();
        return { changes: beforeCount - s.sessions.length };
      }
    },
    deleteExpiredSessions: {
      run: async (nowIso) => {
        const s = await loadState();
        const beforeCount = s.sessions.length;
        const nowMs = Date.parse(nowIso);
        s.sessions = s.sessions.filter((sess) => {
          const expiresAtMs = Date.parse(sess.expires_at);
          return !(Number.isFinite(nowMs) && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs);
        });
        if (s.sessions.length !== beforeCount) await scheduleSave();
        return { changes: beforeCount - s.sessions.length };
      }
    },
    selectUsers: {
      all: async () => {
        const s = await loadState();
        return s.users.map(({ password_hash, ...safeUser }) => {
          const profile = s.user_profiles.find((row) => row.user_id === Number(safeUser.id));
          return {
            ...safeUser,
            user_name: profile?.user_name ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null
          };
        });
      }
    },
    selectModerationQueue: {
      all: async () => {
        const s = await loadState();
        return [...s.moderation_queue];
      }
    },
    selectProviders: {
      all: async () => {
        const s = await loadState();
        return s.servers.map(provider => {
          const user = s.users.find(u => u.id === provider.user_id);
          return { ...provider, owner_email: user?.email || null };
        });
      }
    },
    insertProvider: {
      run: async (userId, name, status, serverUrl, serverConfig = null, authToken = null) => {
        const s = await loadState();
        const id = s._nextServerId++;
        const now = new Date().toISOString();
        const resolvedAuthToken = typeof authToken === 'string' && authToken.trim() ? authToken.trim() : null;
        s.servers.push({
          id, user_id: userId, name, status, server_url: serverUrl,
          auth_token: resolvedAuthToken, status_date: null, description: null,
          members_count: 0, server_config: serverConfig, created_at: now, updated_at: now
        });
        await scheduleSave();
        return { insertId: id, changes: 1 };
      }
    },
    selectPolicies: {
      all: async () => {
        const s = await loadState();
        return [...s.policy_knobs];
      }
    },
    selectNotificationsForUser: {
      all: async (userId, role) => {
        const s = await loadState();
        return s.notifications.filter((note) => note.user_id === userId || note.role === role);
      }
    },
    selectUnreadNotificationCount: {
      get: async (userId, role) => {
        const s = await loadState();
        return {
          count: s.notifications.filter(
            (note) => !note.acknowledged_at && (note.user_id === userId || note.role === role)
          ).length
        };
      }
    },
    acknowledgeNotificationById: {
      run: async (id, userId, role) => {
        const s = await loadState();
        const notification = s.notifications.find(
          (note) => note.id === Number(id) && !note.acknowledged_at && (note.user_id === userId || note.role === role)
        );
        if (!notification) return { changes: 0 };
        notification.acknowledged_at = new Date().toISOString();
        await scheduleSave();
        return { changes: 1 };
      }
    },
    insertNotification: {
      run: async (userId, role, title, message, link) => {
        const s = await loadState();
        const notification = {
          id: s._nextNotificationId++,
          user_id: userId ?? null, role: role ?? null, title, message,
          link: link ?? null, created_at: new Date().toISOString(), acknowledged_at: null
        };
        s.notifications.push(notification);
        await scheduleSave();
        return { insertId: notification.id, lastInsertRowid: notification.id, changes: 1 };
      }
    },
    selectFeedItems: {
      all: async (excludeUserId) => {
        const s = await loadState();
        const viewerId = excludeUserId ?? null;
        if (viewerId === null || viewerId === undefined) return [];
        const followingIdSet = new Set(
          s.user_follows.filter((row) => row.follower_id === Number(viewerId)).map((row) => String(row.following_id))
        );
        const filtered = s.feed_items.filter((item) => {
          const authorId = item.user_id ?? null;
          if (authorId === null || authorId === undefined) return false;
          return followingIdSet.has(String(authorId));
        });
        return filtered.map((item) => {
          const profile = s.user_profiles.find((p) => p.user_id === Number(item.user_id));
          return {
            ...item,
            author_user_name: profile?.user_name ?? null,
            author_display_name: profile?.display_name ?? null,
            author_avatar_url: profile?.avatar_url ?? null
          };
        });
      }
    },
    selectExploreFeedItems: {
      all: async (viewerId) => {
        const s = await loadState();
        const id = viewerId ?? null;
        if (id === null || id === undefined) return [];
        const viewerIdNum = Number(id);
        const followingIds = new Set(
          s.user_follows.filter((row) => row.follower_id === viewerIdNum).map((row) => Number(row.following_id))
        );
        const filtered = s.feed_items
          .filter((item) => {
            if (item.user_id === null || item.user_id === undefined) return false;
            const itemUserId = Number(item.user_id);
            if (itemUserId === viewerIdNum) return false;
            return !followingIds.has(itemUserId);
          })
          .slice()
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        return filtered.map((item) => {
          const profile = s.user_profiles.find((p) => p.user_id === Number(item.user_id));
          return {
            ...item,
            author_user_name: profile?.user_name ?? null,
            author_display_name: profile?.display_name ?? null,
            author_avatar_url: profile?.avatar_url ?? null
          };
        });
      }
    },
    insertUserFollow: {
      run: async (followerId, followingId) => {
        const s = await loadState();
        const a = Number(followerId);
        const b = Number(followingId);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return { changes: 0 };
        if (a === b) return { changes: 0 };
        const exists = s.user_follows.some((row) => row.follower_id === a && row.following_id === b);
        if (exists) return { changes: 0 };
        s.user_follows.push({ follower_id: a, following_id: b, created_at: new Date().toISOString() });
        await scheduleSave();
        return { changes: 1 };
      }
    },
    deleteUserFollow: {
      run: async (followerId, followingId) => {
        const s = await loadState();
        const a = Number(followerId);
        const b = Number(followingId);
        const idx = s.user_follows.findIndex((row) => row.follower_id === a && row.following_id === b);
        if (idx === -1) return { changes: 0 };
        s.user_follows.splice(idx, 1);
        await scheduleSave();
        return { changes: 1 };
      }
    },
    selectUserFollowStatus: {
      get: async (followerId, followingId) => {
        const s = await loadState();
        const a = Number(followerId);
        const b = Number(followingId);
        const exists = s.user_follows.some((row) => row.follower_id === a && row.following_id === b);
        return exists ? { viewer_follows: 1 } : undefined;
      }
    },
    selectUserFollowers: {
      all: async (userId) => {
        const s = await loadState();
        const id = Number(userId);
        const rows = s.user_follows
          .filter((row) => row.following_id === id)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return rows.map((row) => {
          const profile = s.user_profiles.find((p) => p.user_id === Number(row.follower_id));
          return {
            user_id: row.follower_id, followed_at: row.created_at,
            user_name: profile?.user_name ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null
          };
        });
      }
    },
    selectUserFollowing: {
      all: async (userId) => {
        const s = await loadState();
        const id = Number(userId);
        const rows = s.user_follows
          .filter((row) => row.follower_id === id)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return rows.map((row) => {
          const profile = s.user_profiles.find((p) => p.user_id === Number(row.following_id));
          return {
            user_id: row.following_id, followed_at: row.created_at,
            user_name: profile?.user_name ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null
          };
        });
      }
    },
    selectExploreItems: {
      all: async () => {
        const s = await loadState();
        return [...s.explore_items];
      }
    },
    selectCreationsForUser: {
      all: async (userId) => {
        const s = await loadState();
        return s.creations.filter((creation) => creation.user_id === Number(userId));
      }
    },
    selectServers: {
      all: async () => {
        const s = await loadState();
        return s.servers.map(server => {
          const user = s.users.find(u => u.id === server.user_id);
          return { ...server, owner_email: user?.email || null };
        });
      }
    },
    selectServerById: {
      get: async (serverId) => {
        const s = await loadState();
        const server = s.servers.find(sv => sv.id === Number(serverId));
        if (!server) return null;
        const user = s.users.find(u => u.id === server.user_id);
        return { ...server, owner_email: user?.email || null };
      }
    },
    updateServerConfig: {
      run: async (serverId, serverConfig) => {
        const s = await loadState();
        const server = s.servers.find(sv => sv.id === Number(serverId));
        if (server) {
          server.server_config = serverConfig;
          server.updated_at = new Date().toISOString();
          await scheduleSave();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    },
    updateServer: {
      run: async (serverId, nextServer) => {
        const s = await loadState();
        const server = s.servers.find(sv => sv.id === Number(serverId));
        if (!server) return { changes: 0 };
        server.user_id = nextServer?.user_id ?? server.user_id;
        server.name = nextServer?.name ?? server.name;
        server.status = nextServer?.status ?? server.status;
        server.server_url = nextServer?.server_url ?? server.server_url;
        server.auth_token = nextServer?.auth_token ?? null;
        server.status_date = nextServer?.status_date ?? server.status_date ?? null;
        server.description = nextServer?.description ?? server.description ?? null;
        server.members_count = nextServer?.members_count ?? server.members_count ?? 0;
        server.server_config = nextServer?.server_config ?? server.server_config ?? null;
        server.updated_at = new Date().toISOString();
        await scheduleSave();
        return { changes: 1 };
      }
    },
    checkServerMembership: {
      get: async (serverId, userId) => {
        const s = await loadState();
        return s.server_members.some(
          m => m.server_id === Number(serverId) && m.user_id === Number(userId)
        );
      }
    },
    addServerMember: {
      run: async (serverId, userId) => {
        const s = await loadState();
        const serverIdNum = Number(serverId);
        const userIdNum = Number(userId);
        if (s.server_members.some(m => m.server_id === serverIdNum && m.user_id === userIdNum)) {
          return { changes: 0 };
        }
        s.server_members.push({ server_id: serverIdNum, user_id: userIdNum, created_at: new Date().toISOString() });
        const server = s.servers.find(sv => sv.id === serverIdNum);
        if (server) server.members_count = (server.members_count || 0) + 1;
        await scheduleSave();
        return { changes: 1 };
      }
    },
    removeServerMember: {
      run: async (serverId, userId) => {
        const s = await loadState();
        const serverIdNum = Number(serverId);
        const userIdNum = Number(userId);
        const index = s.server_members.findIndex(m => m.server_id === serverIdNum && m.user_id === userIdNum);
        if (index === -1) return { changes: 0 };
        s.server_members.splice(index, 1);
        const server = s.servers.find(sv => sv.id === serverIdNum);
        if (server) server.members_count = Math.max(0, (server.members_count || 0) - 1);
        await scheduleSave();
        return { changes: 1 };
      }
    },
    insertServer: {
      run: async (userId, name, status, serverUrl, serverConfig = null, authToken = null, description = null) => {
        const s = await loadState();
        const id = s._nextServerId++;
        const now = new Date().toISOString();
        const resolvedAuthToken = typeof authToken === 'string' && authToken.trim() ? authToken.trim() : null;
        s.servers.push({
          id, user_id: userId, name, status, server_url: serverUrl,
          auth_token: resolvedAuthToken, status_date: null, description: description || null,
          members_count: 0, server_config: serverConfig, created_at: now, updated_at: now
        });
        await scheduleSave();
        return { insertId: id, changes: 1 };
      }
    },
    selectTemplates: {
      all: async () => {
        const s = await loadState();
        return [...s.templates];
      }
    },
    insertCreatedImage: {
      run: async (userId, filename, filePath, width, height, color, status = 'creating') => {
        const s = await loadState();
        const image = {
          id: s._nextCreatedImageId++,
          user_id: userId, filename, file_path: filePath, width, height, color, status,
          created_at: new Date().toISOString()
        };
        s.created_images.push(image);
        await scheduleSave();
        return { insertId: image.id, lastInsertRowid: image.id, changes: 1 };
      }
    },
    updateCreatedImageStatus: {
      run: async (id, userId, status, color = null) => {
        const s = await loadState();
        const image = s.created_images.find(img => img.id === Number(id) && img.user_id === Number(userId));
        if (!image) return { changes: 0 };
        image.status = status;
        if (color) image.color = color;
        await scheduleSave();
        return { changes: 1 };
      }
    },
    selectCreatedImagesForUser: {
      all: async (userId) => {
        const s = await loadState();
        return s.created_images.filter(img => img.user_id === Number(userId));
      }
    },
    selectPublishedCreatedImagesForUser: {
      all: async (userId) => {
        const s = await loadState();
        return s.created_images.filter(
          img => img.user_id === Number(userId) && (img.published === true || img.published === 1)
        );
      }
    },
    selectAllCreatedImageCountForUser: {
      get: async (userId) => {
        const s = await loadState();
        return { count: s.created_images.filter(img => img.user_id === Number(userId)).length };
      }
    },
    selectPublishedCreatedImageCountForUser: {
      get: async (userId) => {
        const s = await loadState();
        return {
          count: s.created_images.filter(
            img => img.user_id === Number(userId) && (img.published === true || img.published === 1)
          ).length
        };
      }
    },
    selectLikesReceivedForUserPublished: {
      get: async () => ({ count: 0 })
    },
    selectCreatedImageById: {
      get: async (id, userId) => {
        const s = await loadState();
        return s.created_images.find(img => img.id === Number(id) && img.user_id === Number(userId));
      }
    },
    selectCreatedImageByFilename: {
      get: async (filename) => {
        const s = await loadState();
        return s.created_images.find(img => img.filename === filename);
      }
    },
    publishCreatedImage: {
      run: async (id, userId, title, description) => {
        const s = await loadState();
        const image = s.created_images.find(img => img.id === Number(id) && img.user_id === Number(userId));
        if (!image) return { changes: 0 };
        image.published = true;
        image.published_at = new Date().toISOString();
        image.title = title;
        image.description = description;
        await scheduleSave();
        return { changes: 1 };
      }
    },
    deleteCreatedImageById: {
      run: async (id, userId) => {
        const s = await loadState();
        const index = s.created_images.findIndex(img => img.id === Number(id) && img.user_id === Number(userId));
        if (index === -1) return { changes: 0 };
        s.created_images.splice(index, 1);
        await scheduleSave();
        return { changes: 1 };
      }
    },
    selectUserCredits: {
      get: async (userId) => {
        const s = await loadState();
        return s.user_credits.find(row => row.user_id === Number(userId));
      }
    },
    insertUserCredits: {
      run: async (userId, balance, lastDailyClaimAt) => {
        const s = await loadState();
        const existing = s.user_credits.find(row => row.user_id === Number(userId));
        if (existing) {
          const error = new Error('Credits already exist for user');
          error.code = 'CREDITS_ALREADY_EXIST';
          throw error;
        }
        const now = new Date().toISOString();
        const row = {
          id: s._nextUserCreditsId++,
          user_id: Number(userId), balance: Number(balance) || 0,
          last_daily_claim_at: lastDailyClaimAt || null, created_at: now, updated_at: now
        };
        s.user_credits.push(row);
        await scheduleSave();
        return { insertId: row.id, lastInsertRowid: row.id, changes: 1 };
      }
    },
    updateUserCreditsBalance: {
      run: async (userId, amount) => {
        const s = await loadState();
        const id = Number(userId);
        const delta = Number(amount) || 0;
        let row = s.user_credits.find(entry => entry.user_id === id);
        const now = new Date().toISOString();
        if (!row) {
          row = {
            id: s._nextUserCreditsId++,
            user_id: id, balance: 0, last_daily_claim_at: null, created_at: now, updated_at: now
          };
          s.user_credits.push(row);
        }
        const next = Math.max(0, Number(row.balance || 0) + delta);
        row.balance = next;
        row.updated_at = now;
        await scheduleSave();
        return { changes: 1 };
      }
    },
    claimDailyCredits: {
      run: async (userId, amount = 10) => {
        const s = await loadState();
        const id = Number(userId);
        const delta = Number(amount) || 0;
        const now = new Date();
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const todayUTCStr = todayUTC.toISOString().slice(0, 10);
        let row = s.user_credits.find(entry => entry.user_id === id);
        const nowIso = new Date().toISOString();
        if (!row) {
          row = {
            id: s._nextUserCreditsId++,
            user_id: id, balance: delta, last_daily_claim_at: nowIso, created_at: nowIso, updated_at: nowIso
          };
          s.user_credits.push(row);
          await scheduleSave();
          return { success: true, balance: row.balance, changes: 1 };
        }
        if (row.last_daily_claim_at) {
          const lastClaimDate = new Date(row.last_daily_claim_at);
          const lastClaimUTC = new Date(Date.UTC(lastClaimDate.getUTCFullYear(), lastClaimDate.getUTCMonth(), lastClaimDate.getUTCDate()));
          const lastClaimUTCStr = lastClaimUTC.toISOString().slice(0, 10);
          if (lastClaimUTCStr >= todayUTCStr) {
            return { success: false, balance: row.balance, changes: 0, message: 'Daily credits already claimed today' };
          }
        }
        row.balance = Number(row.balance || 0) + delta;
        row.last_daily_claim_at = nowIso;
        row.updated_at = nowIso;
        await scheduleSave();
        return { success: true, balance: row.balance, changes: 1 };
      }
    },
    transferCredits: {
      run: async (fromUserId, toUserId, amount) => {
        const s = await loadState();
        const fromId = Number(fromUserId);
        const toId = Number(toUserId);
        const delta = Number(amount);
        if (!Number.isFinite(delta) || delta <= 0) {
          const error = new Error('Invalid amount');
          error.code = 'INVALID_AMOUNT';
          throw error;
        }
        const nowIso = new Date().toISOString();
        let fromRow = s.user_credits.find(entry => entry.user_id === fromId);
        if (!fromRow) {
          fromRow = {
            id: s._nextUserCreditsId++,
            user_id: fromId, balance: 0, last_daily_claim_at: null, created_at: nowIso, updated_at: nowIso
          };
          s.user_credits.push(fromRow);
        }
        let toRow = s.user_credits.find(entry => entry.user_id === toId);
        if (!toRow) {
          toRow = {
            id: s._nextUserCreditsId++,
            user_id: toId, balance: 0, last_daily_claim_at: null, created_at: nowIso, updated_at: nowIso
          };
          s.user_credits.push(toRow);
        }
        if (Number(fromRow.balance || 0) < delta) {
          const error = new Error('Insufficient credits');
          error.code = 'INSUFFICIENT_CREDITS';
          throw error;
        }
        fromRow.balance = Number(fromRow.balance || 0) - delta;
        fromRow.updated_at = nowIso;
        toRow.balance = Number(toRow.balance || 0) + delta;
        toRow.updated_at = nowIso;
        await scheduleSave();
        return { fromBalance: fromRow.balance, toBalance: toRow.balance };
      }
    }
  };

  const db = {
    prepare: () => ({ run: () => {}, get: () => {}, all: () => [] }),
    exec: () => {}
  };

  async function seed(tableName, items, options = {}) {
    if (!items || items.length === 0) return;
    const s = await loadState();
    const { skipIfExists = false, transform, checkExists } = options;

    let targetArray = s[tableName];
    if (!targetArray) {
      console.warn(`Unknown table: ${tableName}`);
      return;
    }

    if (skipIfExists) {
      if (checkExists) {
        const existing = await checkExists();
        if (existing && existing.length > 0) return;
      } else {
        if (targetArray.length > 0) return;
      }
    }

    const seededAt = new Date().toISOString();
    const timestampFields = TABLE_TIMESTAMP_FIELDS[tableName] || [];

    for (const item of items) {
      const transformedItem = transform ? transform(item) : item;
      const newItem = { ...transformedItem };
      if (!newItem.id) {
        newItem.id = targetArray.length > 0
          ? Math.max(...targetArray.map(i => i.id || 0)) + 1
          : 1;
      }
      for (const field of timestampFields) {
        if (!newItem[field]) newItem[field] = seededAt;
      }
      targetArray.push(newItem);
    }

    // Update ID counters
    if (tableName === 'users') {
      s._nextUserId = s.users.length > 0 ? Math.max(...s.users.map(u => u.id || 0)) + 1 : 1;
    }

    await scheduleSave();
  }

  async function reset() {
    const s = await loadState();
    Object.keys(EMPTY_STATE).forEach(key => {
      if (Array.isArray(EMPTY_STATE[key])) {
        s[key] = [];
      } else {
        s[key] = EMPTY_STATE[key];
      }
    });
    await forceSave();
  }

  // Storage interface - uses Vercel Blob for images too
  const storage = {
    uploadImage: async (buffer, filename) => {
      try {
        const blob = await put(`images/created/${filename}`, buffer, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        return blob.url;
      } catch (error) {
        console.error('[blob] Error uploading image:', error.message);
        return `/images/created/${filename}`;
      }
    },

    getImageUrl: (filename) => {
      // Images are stored with public URLs, but we return the path
      // The actual URL is stored in the database record
      return `/images/created/${filename}`;
    },

    getImageBuffer: async (filename) => {
      try {
        const blobInfo = await head(`images/created/${filename}`).catch(() => null);
        if (!blobInfo) throw new Error(`Image not found: ${filename}`);
        const response = await fetch(blobInfo.url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${filename}`);
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        throw new Error(`Image file not available: ${filename}`);
      }
    },

    getGenericImageBuffer: async (key) => {
      try {
        const safeKey = String(key || '').replace(/^\/+/, '');
        const blobInfo = await head(`images/generic/${safeKey}`).catch(() => null);
        if (!blobInfo) throw new Error(`Image not found: ${safeKey}`);
        const response = await fetch(blobInfo.url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${safeKey}`);
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        throw new Error(`Image not found: ${String(key || '')}`);
      }
    },

    uploadGenericImage: async (buffer, key) => {
      try {
        const safeKey = String(key || '').replace(/^\/+/, '');
        const blob = await put(`images/generic/${safeKey}`, buffer, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        return blob.url;
      } catch (error) {
        throw new Error('Failed to upload image');
      }
    },

    deleteGenericImage: async (key) => {
      try {
        const safeKey = String(key || '').replace(/^\/+/, '');
        await del(`images/generic/${safeKey}`);
      } catch {
        // ignore
      }
    },

    deleteImage: async (filename) => {
      try {
        await del(`images/created/${filename}`);
      } catch {
        // ignore
      }
    },

    clearAll: async () => {
      // Can't easily clear all blobs, would need to list and delete
      console.warn('[blob] clearAll not fully implemented for blob storage');
    }
  };

  return { db, queries, seed, reset, storage };
}
