# Publishing `@netanelgilad/rolldown` + `@netanelgilad/vite`

Both packages are **published on npm** (public, under the `@netanelgilad` scope):

- [`@netanelgilad/rolldown@1.0.3-workerd.0`](https://www.npmjs.com/package/@netanelgilad/rolldown)
- [`@netanelgilad/vite@8.0.16-workerd.0`](https://www.npmjs.com/package/@netanelgilad/vite)

A clean `npm install @netanelgilad/vite` from public npm is all a consumer needs
(it transitively pulls the rolldown fork via an npm alias). The steps below are
the recipe used to (re)publish a new `-workerd.N` revision.

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
