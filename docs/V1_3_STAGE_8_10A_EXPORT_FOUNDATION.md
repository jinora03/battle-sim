# Kinetic Battle Engine v1.3 Stage 8.10A — Export Foundation

Stage 8.10A introduces the first replay-driven video export path. It does not screen-record the application UI and does not depend on the display resolution of the current phone, desktop, or watch-sized viewport.

## Initial output

- 1920 × 1080
- 60 FPS
- WebM
- VP9 when supported, with VP8 fallback
- video-only output; deterministic audio scheduling is reserved for Stage 8.10C

## Pipeline

1. Capture an immutable replay, final tick, and simulation checksum from the live battle runtime.
2. Recreate the battle in a separate `LocalSimulationRunner`.
3. Apply replay commands and advance exactly one simulation tick for each output frame.
4. Render the resulting snapshot to a dedicated hidden Pixi canvas fixed at 1920 × 1080.
5. Encode each canvas frame with an explicit timestamp through WebCodecs.
6. Package the encoded samples into a WebM file.
7. Verify the replay's final simulation checksum before completing the download.

The exporter can render more slowly than real time. Because frames are timestamped from replay frame indices rather than wall-clock rendering speed, slow devices do not drop simulation frames from the output.

## Safeguards

- three-minute duration limit
- encoded-memory estimate before starting
- hard encoded-byte limit during muxing
- encoder queue backpressure
- progress and estimated completion reporting
- cancellation through `AbortController`
- renderer, encoder, canvas host, and object URL cleanup
- clear unsupported-browser result when WebCodecs VP9/VP8 encoding is unavailable

## Deferred work

Stage 8.10B adds purpose-built vertical and landscape broadcast compositions. Stage 8.10C adds 4K presets and deterministic offline audio synchronization. The current export uses the battle renderer on a dedicated fixed-size canvas as the foundation for those later layouts.
