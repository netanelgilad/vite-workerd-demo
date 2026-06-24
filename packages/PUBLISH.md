# Publishing `@netanelgilad/rolldown` + `@netanelgilad/vite`

These two packages are packed and validated locally but **NOT published** (this
machine isn't logged in to npm). To publish once logged in:

```bash
# 0. Log in (scoped public packages under the @netanelgilad scope).
npm login

# 1. Publish the rolldown fork FIRST — @netanelgilad/vite depends on it via an
#    npm alias (rolldown: npm:@netanelgilad/rolldown@1.0.3-workerd.0), so the
#    registry must have it before vite is installable.
cd packages/rolldown
npm publish --access public
# (or publish the exact tarball that was validated:)
# npm publish netanelgilad-rolldown-1.0.3-workerd.0.tgz --access public

# 2. Publish vite.
cd ../vite
npm publish --access public
# npm publish netanelgilad-vite-8.0.16-workerd.0.tgz --access public
```

After publishing, a clean consumer install is simply:

```bash
npm install @netanelgilad/vite
# -> pulls @netanelgilad/rolldown (as `rolldown`) + the bundled esbuild-wasm shim automatically
```

## Notes

- Both packages set `publishConfig.access = "public"` so `--access public` is
  redundant but harmless.
- `bundleDependencies` (rolldown's patched emnapi/@tybys/@napi-rs runtime;
  vite's esbuild-wasm shim) are included in the tarballs — verify with
  `tar tzf <pkg>.tgz | grep node_modules`.
- Versions use a `-workerd.N` prerelease suffix to avoid colliding with the
  upstream version space. Bump `.N` for re-publishes.
- Keep the MIT `LICENSE` (rolldown) / `LICENSE.md` (vite) + `NOTICE.md`
  attribution files in the tarballs.
