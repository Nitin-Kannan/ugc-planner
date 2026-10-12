import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work on GitHub Pages under any repo name
// (https://<username>.github.io/<repo-name>/) without editing this file.
export default defineConfig({
  plugins: [react()],
  base: './',
});
