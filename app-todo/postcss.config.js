import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Explicit config path: keeps tailwind independent of process.cwd() (which is
// not the app root when vite runs via its JS API, e.g. inside workerd).
const here = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: path.join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
}
