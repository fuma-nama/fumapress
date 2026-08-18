import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";

export default defineConfig({
  plugins: [press(), tailwindcss()],
});
