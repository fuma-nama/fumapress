import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [press(), tailwindcss()],
});
