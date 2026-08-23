import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test"
      ? []
      : [
          cloudflare({
            config: {
              name: "server",
              main: "./worker/index.ts",
              compatibility_date: "2026-05-22",
              assets: {
                binding: "ASSETS",
                not_found_handling: "single-page-application",
                run_worker_first: true,
              },
            },
          }),
        ],
}));
