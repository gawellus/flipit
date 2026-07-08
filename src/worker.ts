import { handle } from "@astrojs/cloudflare/handler";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  ASSETS: Fetcher;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, ctx);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
        },
      }),
    );
  },
} satisfies ExportedHandler<Env>;
