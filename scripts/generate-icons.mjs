import sharp from 'sharp';
import fs from 'fs';

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of sizes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#0a0a0a"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${size * 0.65}">🦕</text>
  </svg>`;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/${name}`);
  
  console.log(`Generated ${name}`);
}

