# ErgoFit (Offline Posture Analysis)

Dark-themed web ergonomics app (PWA) that runs pose detection fully in-browser.

## Setup
```bash
npm install
npm run dev
```

## Offline test (recommended)
```bash
npm run build
npm run preview
```
Then install as a PWA in Chrome and test with airplane mode.

## Notes
- This project uses MediaPipe Tasks Vision PoseLandmarker running via local WASM assets.
- The Vite build copies WASM files to `/wasm` using `vite-plugin-static-copy`.
