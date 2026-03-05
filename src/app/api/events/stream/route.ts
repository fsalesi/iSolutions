import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { registerClient, unregisterClient, SSEClient } from "@/lib/sseRegistry";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/stream
 *
 * Long-lived SSE connection. Each browser tab connects here on mount.
 * Sends a heartbeat comment every 25s to keep the connection alive through
 * proxies and load balancers.
 *
 * Events emitted to clients:
 *   - "notification"  { unread: number }   — user was @mentioned
 */
export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);

  let client: SSEClient;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const encode = (chunk: string) => new TextEncoder().encode(chunk);

      const send = (event: string, data: unknown) => {
        controller.enqueue(encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const close = () => {
        try { controller.close(); } catch { /* already closed */ }
      };

      client = { userId, send, close };
      registerClient(client);

      // Initial connected ack
      controller.enqueue(encode(`: connected\n\n`));

      // Heartbeat every 25s — prevents proxy timeouts
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);
    },

    cancel() {
      clearInterval(heartbeat);
      if (client) unregisterClient(client);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
