# App icons

The PWA manifest references three PNGs that must live here:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-512-maskable.png` (512×512, with safe padding for maskable)

The build does not fail if they're missing, but installed home-screen icons
won't render until you add them. Quickest path: drop a 512×512 PNG into an icon
generator (e.g. https://realfavicongenerator.net or `npx pwa-asset-generator`)
and export the three sizes above, or hand-export from `../favicon.svg`.
