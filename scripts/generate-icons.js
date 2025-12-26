const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [192, 512, 180];
const emoji = '🦕';

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, size, size);
  
  // Draw emoji
  ctx.font = `${size * 0.7}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  
  const buffer = canvas.toBuffer('image/png');
  const filename = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  fs.writeFileSync(`public/${filename}`, buffer);
  console.log(`Generated ${filename}`);
});

