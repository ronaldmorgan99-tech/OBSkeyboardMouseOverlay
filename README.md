# OBS Keyboard + Mouse Overlay

A real-time browser overlay for streamers that visualizes keyboard and mouse input for OBS scenes.

## What this app does

This project renders a live input overlay in the browser that can be added as an OBS Browser Source.

### Key features

- **Keyboard overlay** with active key highlighting (QWER row, Shift/ASDF row, Ctrl/Space row).
- **Mouse overlay** with left/right/middle click states, wheel activity, and pointer movement feedback.
- **Built-in visual presets** (`Neon Elite`, `Cyber Stealth`, `Glass Minimal`, `Inferno Pro`).
- **Chroma key mode** (solid green background) for OBS Chroma Key filtering.
- **Transparent mode** for direct alpha compositing in OBS Browser Source.
- Additional tuning options for colors, glow, scanlines, spacing, animation speed, and optional RGB cycling.

---

## Local setup

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the overlay in your browser:

   - `http://localhost:3000`
   - If running from another machine on your LAN, use your host IP and port `3000`.

### Optional build / deploy

Build static assets:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

You can deploy the generated `dist/` folder to any static host (or serve it behind your preferred web server) and then point OBS Browser Source to that URL.

> Note: A Gemini/AI Studio API key is **not required** for the overlay behavior described above.

---

## OBS Browser Source setup

1. In OBS, add a new **Browser Source**.
2. Set URL to your running overlay page (for example `http://localhost:3000`).
3. Suggested starting size:
   - **Width:** `1920`
   - **Height:** `1080`
   - Match this to your scene/output resolution as needed.
4. Set **FPS** to `60` for smooth input animations (use `30` if performance is limited).
5. Enable **Shutdown source when not visible** only if you are okay with it resetting when hidden.
6. Enable **Refresh browser when scene becomes active** if you want a fresh state per scene switch.
7. If needed, add custom CSS in Browser Source (optional):

   ```css
   body { margin: 0; background: transparent !important; overflow: hidden; }
   ```

### Transparency / chroma workflow

- **Transparent workflow (recommended):**
  - Turn on **Transparent Mode** in the overlay settings panel.
  - In OBS Browser Source, enable transparent background support (default behavior for Browser Source).
  - No chroma filter needed.

- **Chroma workflow (fallback):**
  - Turn on **Chroma Key** in the overlay settings panel (green background).
  - In OBS, add a **Chroma Key** filter to the Browser Source and key out green.
  - Adjust similarity/smoothness until the green background is fully removed.

---

## Known limitations

- The overlay updates from browser input events, so it generally needs active browser focus/captured input to reflect key presses.
- In OBS, Browser Sources may not receive global keyboard input unless the source is interacted with (or the app is used via a focused browser window).
- Mouse/keyboard behavior can vary across OS/browser/OBS combinations.

---

## Troubleshooting

### Overlay is not updating

- Confirm the URL loads and stays active in a normal browser tab first.
- Ensure the Browser Source is visible in the active scene.
- Refresh the Browser Source cache/reload the source.
- If you need live key capture, test in a focused browser tab to verify input event flow.

### Green screen is still visible

- If using **Transparent Mode**, make sure **Chroma Key** is disabled.
- If using **Chroma Key mode**, add or retune OBS Chroma Key filter settings (similarity/smoothness/spill reduction).
- Avoid enabling both workflows at once; use one mode at a time.

### Performance tuning

- Lower Browser Source FPS from `60` to `30`.
- Reduce visual complexity in settings (glow strength, scanlines, heavy effects).
- Lower Browser Source resolution if needed.
- Close extra browser tabs/apps consuming GPU/CPU resources.
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## OBS quick setup

You can preconfigure a clean browser-source URL for OBS using query params, so you do not need to toggle settings each launch.

### Supported URL flags

- `mode=overlay`
  - Enables overlay mode behavior and automatically hides the settings button/panel.
- `hideSettings=1`
  - Hides the settings button/panel (also accepts `true`).
- `transparent=1`
  - Enables transparent mode on load (also accepts `true`).
- `preset=<Preset Name>`
  - Applies a preset at startup (case-insensitive), e.g. `preset=Neon%20Elite`.

### Example OBS URL

```text
http://localhost:5173/?mode=overlay&hideSettings=1&transparent=1&preset=Neon%20Elite
```
