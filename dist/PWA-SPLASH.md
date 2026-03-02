# PWA Splash Screen – Kaha Hai?

PWA ka splash screen **ek alag file nahi hota**. Browser ise **web app manifest** aur **icons** se banata hai.

---

## 1. Config (yahan set hota hai)

**File:** `vite.config.ts` → `VitePWA({ manifest: { ... } })`

- **`name`** → splash par app naam ("Next iOS")
- **`background_color`** → splash ki background (ab `#000000` – black)
- **`theme_color`** → status bar / theme
- **`icons`** → splash par dikhne wala icon (512×512 zaroori hai)

Build ke baad ye **`dist/manifest.webmanifest`** me jaata hai.

---

## 2. Assets (splash ke liye use hote hain)

**Folder:** `public/`

| File              | Use                          |
|-------------------|------------------------------|
| `pwa-192x192.png` | Small icon / Android (must be **exactly 192×192 px**) |
| `pwa-512x512.png` | Splash icon (min 512×512)    |

Inhi dono ko manifest me refer kiya hai; Chrome/Android inhi se splash banaata hai.

**Troubleshooting:** If the browser shows "Resource size is not correct" for the icon, the image file must exist in `public/` and its pixel dimensions must **exactly** match the manifest (192×192 and 512×512). Wrong size or 404 causes this error.

---

## 3. Splash change karne ke liye

- **Rang:** `vite.config.ts` me `background_color` aur `theme_color` badlo.
- **Icon:** `public/pwa-512x512.png` replace karo (512×512 PNG rakho).
- **Naam:** `vite.config.ts` me `name` / `short_name` badlo.

Phir `npm run build` chalao.

---

## 4. iOS (Add to Home Screen)

`index.html` me **`apple-touch-icon`** hai → home screen icon.  
Agar iOS par bhi splash jaisa startup screen chahiye to `index.html` me **`apple-touch-startup-image`** add kiya ja sakta hai (alag doc me likha hai).
