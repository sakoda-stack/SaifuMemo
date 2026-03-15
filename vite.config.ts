import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate" = アプリを開くたびに自動で最新版に更新
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "さいふメモ",
        short_name: "さいふメモ",
        description: "家族の家計簿・確定申告サポートアプリ",
        theme_color: "#3B7DD8",
        background_color: "#F7F6F2",
        display: "standalone",          // ← ブラウザのUIを隠してアプリっぽく見せる
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // オフラインでも動くようにキャッシュ設定
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // アプリ起動時にすべてのファイルをキャッシュに入れる
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
});
