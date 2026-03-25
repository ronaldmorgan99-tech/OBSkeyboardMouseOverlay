# OBS Keyboard + Mouse Overlay

A browser-based keyboard/mouse input overlay designed for OBS Browser Source.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Build production bundle:
   ```bash
   npm run build
   ```

## OBS Browser Source Notes (Focus + Input Limitations)

When this overlay runs as an **OBS Browser Source**, browser-origin input events have important limitations:

- Keyboard and mouse DOM events are only reliable while the Browser Source has focus.
- During normal gameplay, your game usually has focus, so Browser Source key/mouse events can be missing or stale.
- Mouse movement in Browser Source is not global OS mouse tracking; it reflects pointer activity inside the Browser Source context.

Because of this, **browser-events mode alone is best-effort** for live capture.

## Reliable Input Pipeline (with Fallback)

The app now supports two input providers behind a shared input pipeline:

1. **Browser Events Provider** (default)
   - Uses `window` keyboard/mouse/wheel listeners.
2. **WebSocket Provider** (optional external input)
   - Connects to a local/external companion process (for example, an OBS plugin or helper app) that pushes JSON input events.

### Fallback behavior

If External Input Mode is enabled but WebSocket is unavailable:

- The app shows the external connection status in the UI.
- The overlay automatically falls back to Browser Events Provider until WebSocket becomes connected.

This keeps the overlay responsive even when the external pipeline is temporarily down.

## External Input Mode

Open the settings panel and enable **External Input Mode**, then set a WebSocket URL (default: `ws://127.0.0.1:4456`).

Supported JSON event shapes:

```json
{ "type": "key", "code": "KeyW", "pressed": true }
{ "type": "mouse_button", "button": 0, "pressed": true }
{ "type": "mouse_move", "x": 0.42, "y": 0.77 }
{ "type": "wheel", "direction": "up" }
{ "type": "wheel", "deltaY": -120 }
{ "type": "snapshot", "activeKeys": ["KeyW"], "activeMouseButtons": [0], "mousePos": { "x": 0.5, "y": 0.5 } }
```

Notes:
- `x` and `y` are normalized to `0..1`.
- `snapshot` is optional and can be used to periodically fully resync state.
