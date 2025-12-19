import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "/",
  plugins: [
    react(),

    // Copy MediaPipe WASM files so they are served at /wasm
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@mediapipe/tasks-vision/wasm/*",
          dest: "wasm",
        },
      ],
    }),

    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ErgoFit – Offline Posture Analysis",
        short_name: "ErgoFit",
        start_url: "/",
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#0b1220",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // ✅ Allow large WASM files without precaching them
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
  ],
});
