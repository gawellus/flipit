import { handle } from "@astrojs/cloudflare/handler";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
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
