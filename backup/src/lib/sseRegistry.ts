/**
 * sseRegistry.ts — In-memory SSE client registry
 *
 * Tracks open SSE connections keyed by userId.
 * Single-process only — fine for one server. If you ever run PM2 cluster,
 * replace with Redis pub/sub.
 */

export interface SSEClient {
  userId: string;
  send: (event: string, data: unknown) => void;
  close: () => void;
}

// userId → set of connected clients (multiple tabs)
// Stored on `global` so Next.js dev-mode hot reloads don't wipe connected clients.
const g = global as typeof globalThis & { __sseRegistry?: Map<string, Set<SSEClient>> };
if (!g.__sseRegistry) g.__sseRegistry = new Map();
const registry = g.__sseRegistry;

export function registerClient(client: SSEClient) {
  const set = registry.get(client.userId) ?? new Set();
  set.add(client);
  registry.set(client.userId, set);
}

export function unregisterClient(client: SSEClient) {
  const set = registry.get(client.userId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) registry.delete(client.userId);
}

/**
 * Emit an SSE event to all open tabs for a given user.
 * Safe to call even if the user isn't connected — no-op.
 */
export function emitToUser(userId: string, event: string, data: unknown) {
  const set = registry.get(userId);
  console.log(`[SSE] emitToUser userId="${userId}" event="${event}" connectedClients=${set?.size ?? 0} registryKeys=[${[...registry.keys()].join(",")}]`);
  if (!set || set.size === 0) return;
  for (const client of set) {
    try {
      client.send(event, data);
    } catch {
      // Dead connection — clean up
      set.delete(client);
    }
  }
  if (set.size === 0) registry.delete(userId);
}

/** Returns the user IDs of all currently connected clients. */
export function getConnectedUsers(): string[] {
  return [...registry.keys()];
}
