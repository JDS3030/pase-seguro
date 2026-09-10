import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./backend/src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false, // test files share a real DB — serialize to avoid deleteMany() race conditions
    include: ["backend/src/**/*.test.ts"],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://paseo:paseo@localhost:5432/paseo_seguro",
      STRIPE_SECRET_KEY: "sk_test_ficticia_para_pruebas",
      STRIPE_WEBHOOK_SECRET: "whsec_ficticio_para_pruebas",
      QUOTE_SIGNING_SECRET: "secreto-de-pruebas-no-usar-en-produccion",
      APP_URL: "http://localhost:3000",
    },
  },
});
