/**
 * Generate PNG icons from icon.svg using the `sharp` library.
 *
 * Usage:
 *   npm install sharp
 *   node generate-icons.js
 */

const sharp = require("sharp");
const path = require("path");

const SOURCE = path.join(__dirname, "icons", "icon.svg");
const SIZES = [16, 32, 48, 128];

async function generate() {
  for (const size of SIZES) {
    const output = path.join(__dirname, "icons", `icon${size}.png`);
    await sharp(SOURCE)
      .resize(size, size)
      .png()
      .toFile(output);
    console.log(`✓ Created ${output} (${size}×${size})`);
  }
  console.log("\nAll icons generated successfully.");
}

generate().catch((err) => {
  console.error("Error generating icons:", err.message);
  process.exit(1);
});
