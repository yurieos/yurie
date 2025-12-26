import sharp from 'sharp';
import fs from 'fs';

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function main() {
  console.log('Generating icons from custom SVG...');
  
  const svgContent = fs.readFileSync('public/favicon.svg', 'utf-8');
  
  for (const { size, name } of sizes) {
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(`public/${name}`);
    
    console.log(`Generated ${name}`);
  }
}

main().catch(console.error);
