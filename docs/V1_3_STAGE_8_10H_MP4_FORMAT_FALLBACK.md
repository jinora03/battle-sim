# Stage 8.10H — MP4 + WebM Format Fallback

Stage 8.10H adds a creator-facing format selector without replacing the existing deterministic WebM path.

## Formats

- **Auto** — prefers H.264/AVC + AAC in MP4 and falls back to VP9/VP8 + Opus in WebM.
- **MP4** — requires H.264 and, when audio is enabled, AAC support for the requested resolution/FPS.
- **WebM** — preserves the established VP9/VP8 + Opus pipeline.

The fixed-frame replay renderer remains independent of browser viewport size and does not use `captureStream()` or `MediaRecorder` for high-quality export.

## MP4 architecture

The MP4 path uses WebCodecs directly:

- H.264 with AVC length-prefixed output (`avc` format)
- AAC-LC (`mp4a.40.2`)
- fragmented MP4 packaging (`ftyp` + `moov` + `moof` + `mdat`)
- hardware-preferred encoder probing followed by browser-selected acceleration fallback

The exporter chooses the container before replay rendering starts, so Auto never renders the battle twice merely to change containers.

## Compatibility behavior

If Auto cannot resolve a complete MP4 path, it keeps the requested audio and video settings and uses WebM instead. Explicit MP4 does not silently change to WebM; the UI explains the unsupported H.264/AAC configuration and lets the user choose Auto, WebM, a lower resolution, or silent output.

No simulation, AI, fighter balance, replay command, physics, or deterministic checksum behavior is changed by this stage.
