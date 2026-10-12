import { defineConfig } from 'vite';

// Repo GitHub Pages: the workflow sets BASE_PATH=/repository-name/ automatically.
// User/organization Pages root: set BASE_PATH=/ manually.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: { outDir: 'dist', sourcemap: false }
});
