# QR Folio

Desktop and browser QR studio. Starts from a **classic black-and-white QR**, then you add logo, colors, and outer frames.

## Features

- Content: URL, keywords, free text, Wi‑Fi, email, phone, SMS, WhatsApp, place (Maps), calendar event, vCard
- Style: classic reset, presets, colors, module shapes, corners, logo, error correction
- Frames: plain, border, label, ticket, stamp, sign
- Export PNG / SVG, local library, multi-code sheet (planche)
- UI in French; product name **QR Folio** (English)

## Web

Open `index.html` in a modern browser, or:

```bash
npx serve .
```

## Windows executable

GitHub Actions builds a portable `.exe` and an NSIS installer on every push to `main`.

1. Open the **Actions** tab
2. Workflow **Build Windows**
3. Download artifact **`qr-folio-windows`**

### Local build

```bash
npm install
npm run build:win
```

Binaries land in `release/` (`QR-Folio-*-portable.exe`, `QR-Folio-Setup-*`).

## Microsoft Store (optional)

Set repository variables/secrets, then run the workflow with **package_store**:

| Type | Name | Role |
|------|------|------|
| Variable | `PWA_URL` | Public URL of the deployed app |
| Secret | `STORE_PACKAGE_ID` | Package ID (Partner Center) |
| Secret | `STORE_PUBLISHER` | CN=… Publisher ID |
| Secret | `STORE_PUBLISHER_DISPLAY_NAME` | Publisher display name |

## License

MIT
