# SnapLink Icons

The source icon is `icon.svg` (128×128). Generate PNGs from it using one of the
methods below.

---

## Method 1: Node.js with `sharp` (recommended)

```bash
npm install sharp
node generate-icons.js
```

---

## Method 2: PowerShell (Windows, requires Inkscape)

```powershell
& "C:\Program Files\Inkscape\bin\inkscape.com" icons\icon.svg --export-type=png --export-width=16  --export-filename=icons\icon16.png
& "C:\Program Files\Inkscape\bin\inkscape.com" icons\icon.svg --export-type=png --export-width=32  --export-filename=icons\icon32.png
& "C:\Program Files\Inkscape\bin\inkscape.com" icons\icon.svg --export-type=png --export-width=48  --export-filename=icons\icon48.png
& "C:\Program Files\Inkscape\bin\inkscape.com" icons\icon.svg --export-type=png --export-width=128 --export-filename=icons\icon128.png
```

If Inkscape is installed in a different location, adjust the path.

---

## Method 3: Online converter

1. Go to <https://svgtopng.com/>
2. Upload `icons/icon.svg`
3. Download at 16, 32, 48, and 128 pixels
4. Rename and place in this folder as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
