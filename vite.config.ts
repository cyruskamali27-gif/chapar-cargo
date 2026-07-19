import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Emit dist/version.json from the ACTUAL emitted filenames.
//
// version.json used to be a hand-written file that nobody updated, so for nine days the
// console banner reported a Jul-10 build while a Jul-19 bundle was live. During a
// blank-page incident that is the one signal you want to trust, and it was lying. Deriving
// it from the bundle at write time means it cannot drift: if the hash changed, so did this.
function versionStamp() {
  return {
    name: 'chapar-version-stamp',
    // writeBundle runs after the files exist on disk and knows their final hashed names.
    writeBundle(options: { dir?: string }, bundle: Record<string, unknown>) {
      const names = Object.keys(bundle)
      const js = names.find(n => /^assets\/index-.*\.js$/.test(n)) || null
      const css = names.find(n => /^assets\/index-.*\.css$/.test(n)) || null
      let commit = 'unknown'
      try { commit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() } catch { /* not a repo / no git */ }
      const out = {
        version: commit,
        builtAt: new Date().toISOString(),
        bundle: js ? path.basename(js) : null,
        css: css ? path.basename(css) : null,
      }
      const dir = options.dir || path.resolve(__dirname, 'dist')
      fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify(out, null, 2) + '\n', 'utf8')
      console.log(`[version-stamp] ${out.version} @ ${out.builtAt} → ${out.bundle}`)
    },
  }
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    versionStamp(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
