import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://backlinksbuilder.net",
  output: "server",
  adapter: vercel(),
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Inter",
        cssVariable: "--font-sans",
        weights: [400, 500],
      }
    ],
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'process.env.ADMIN_USERNAME': JSON.stringify(process.env.ADMIN_USERNAME),
      'process.env.ADMIN_PASSWORD': JSON.stringify(process.env.ADMIN_PASSWORD),
      'process.env.STRIPE_SECRET_KEY': JSON.stringify(process.env.STRIPE_SECRET_KEY),
      'process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY),
      'process.env.STRIPE_WEBHOOK_SECRET': JSON.stringify(process.env.STRIPE_WEBHOOK_SECRET),
    },
  },
});
