import { client } from "@/db";
import { getUser } from "@/lib/session";
import { DEMO } from "@/lib/demo";
import { PROGRESS_CHANNEL, type Progress } from "@/lib/progress";

// Server-sent events: forwards the worker's Postgres NOTIFY progress (scoring, research) to the signed-in user.
export async function GET(request: Request) {
  if (DEMO) return new Response("No live progress in the demo", { status: 404 });
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unlisten: (() => Promise<void>) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      ({ unlisten } = await client.listen(PROGRESS_CHANNEL, (payload) => {
        const progress = JSON.parse(payload) as Progress;
        // Research briefs are shared by everyone; scoring progress is private to its owner.
        if (progress.kind === "research" || progress.userId === user.id) send(`data: ${payload}\n\n`);
      }));
      ping = setInterval(() => send(": ping\n\n"), 25_000); // keeps proxies from closing an idle stream
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        void unlisten?.();
        controller.close();
      });
    },
    cancel() {
      clearInterval(ping);
      void unlisten?.();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
