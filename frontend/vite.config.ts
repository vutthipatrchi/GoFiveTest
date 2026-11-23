import { defineConfig } from "vite";

const proxy = { "/api": "http://127.0.0.1:3001" };
const address = { host: "127.0.0.1", port: 3000, strictPort: true, proxy };

export default defineConfig({
  server: address,
  preview: address,
});
