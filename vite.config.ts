import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const base = process.env.GITHUB_ACTIONS === "true" && repositoryName ? `/${repositoryName}/` : "/";

  const geminiApiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

  return {
    base,
    define: {
      "globalThis.__APP_GEMINI_API_KEY__": JSON.stringify(geminiApiKey),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["saifu.png", "favicon.png", "apple-touch-icon.png", "icons/*.png"],
        manifest: {
          name: "SaifuMemo",
          short_name: "SaifuMemo",
          description: "家計簿と医療費記録をまとめて管理するアプリ",
          theme_color: "#3B7DD8",
          background_color: "#F7F6F2",
          display: "standalone",
          orientation: "portrait",
          start_url: base,
          scope: base,
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: { cacheName: "google-fonts-cache" },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { "@": "/src" },
    },
  };
});
