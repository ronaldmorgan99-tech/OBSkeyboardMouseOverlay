<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3291ebaa-fba5-497b-9e1e-9453834b2ed3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
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
