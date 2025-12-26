import sharp from 'sharp';
import fs from 'fs';
import https from 'https';
import path from 'path';

// Twemoji comet SVG URL
const TWEMOJI_URL = 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/2604.svg';

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

// Download the Twemoji SVG
function downloadSvg(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading Twemoji comet...');
  const svgContent = await downloadSvg(TWEMOJI_URL);
  
  for (const { size, name } of sizes) {
    const padding = Math.floor(size * 0.15);
    const iconSize = size - (padding * 2);
    
    // Create SVG with dark background and centered emoji
    const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#0a0a0a" rx="${size * 0.2}"/>
      <g transform="translate(${padding}, ${padding})">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 36 36">
          ${svgContent.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
        </svg>
      </g>
    </svg>`;
    
    await sharp(Buffer.from(compositeSvg))
      .png()
      .toFile(`public/${name}`);
    
    console.log(`Generated ${name}`);
  }
  
  // Also create favicon.svg with the dinosaur
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
    ${svgContent.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </svg>`;
  
  fs.writeFileSync('public/favicon.svg', faviconSvg);
  console.log('Generated favicon.svg');
}

main().catch(console.error);
