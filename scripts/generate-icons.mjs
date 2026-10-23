#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';

const icons = [
  { input: 'public/icon-192.svg', output: 'public/icon-192.png', size: 192 },
  { input: 'public/icon-512.svg', output: 'public/icon-512.png', size: 512 },
  { input: 'public/icon-maskable-512.svg', output: 'public/icon-maskable-512.png', size: 512 }
];

async function generateIcons() {
  for (const icon of icons) {
    await sharp(icon.input)
      .resize(icon.size, icon.size)
      .png()
      .toFile(icon.output);
    
    console.log(`Generated ${icon.output} (${icon.size}x${icon.size})`);
  }
  
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
