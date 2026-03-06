import { getDhanFeedManager, LiveQuote } from '@/lib/dhanFeed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const manager = getDhanFeedManager();

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot
      const quotes = manager.getQuotes();
      if (quotes.size > 0) {
        const snapshot = Array.from(quotes.values());
        controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      }

      // Send connection status
      controller.enqueue(
        encoder.encode(`event: status\ndata: ${JSON.stringify({ connected: manager.isConnected() })}\n\n`)
      );

      // Throttle updates to max once per 300ms to avoid flooding the browser
      let pendingUpdate: LiveQuote[] | null = null;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        if (pendingUpdate && controller.desiredSize !== null) {
          try {
            controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(pendingUpdate)}\n\n`));
          } catch {
            // Stream closed
          }
          pendingUpdate = null;
        }
        throttleTimer = null;
      };

      const listener = (allQuotes: Map<number, LiveQuote>) => {
        pendingUpdate = Array.from(allQuotes.values());
        if (!throttleTimer) {
          throttleTimer = setTimeout(flush, 300);
        }
      };

      manager.addListener(listener);

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      cleanup = () => {
        manager.removeListener(listener);
        if (throttleTimer) clearTimeout(throttleTimer);
        clearInterval(heartbeat);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
