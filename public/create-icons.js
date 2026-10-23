const fs = require('fs');

// Minimal 1x1 blue PNG
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// For 192x192 and 512x512, we'll just replicate this
fs.writeFileSync('icon-192.png', png1x1);
fs.writeFileSync('icon-512.png', png1x1);

console.log('Created placeholder icons (1x1 blue PNG)');
