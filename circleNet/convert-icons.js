const fs = require('fs');
const path = require('path');

// Simple SVG to PNG converter using canvas or sharp
// This requires: npm install sharp
// Run with: node convert-icons.js

try {
  const sharp = require('sharp');
  
  const iconDir = path.join(__dirname, 'public', 'icons');
  const svgFiles = [
    { svg: 'compose-192.svg', png: 'compose-192.png', size: 192 },
    { svg: 'compose-96.svg', png: 'compose-96.png', size: 96 },
    { svg: 'messages-192.svg', png: 'messages-192.png', size: 192 },
    { svg: 'messages-96.svg', png: 'messages-96.png', size: 96 },
    { svg: 'explore-192.svg', png: 'explore-192.png', size: 192 },
    { svg: 'explore-96.svg', png: 'explore-96.png', size: 96 },
    { svg: 'notifications-192.svg', png: 'notifications-192.png', size: 192 },
    { svg: 'notifications-96.svg', png: 'notifications-96.png', size: 96 },
    { svg: 'upload-192.svg', png: 'upload-192.png', size: 192 },
  ];

  let completed = 0;
  svgFiles.forEach(({ svg, png, size }) => {
    const svgPath = path.join(iconDir, svg);
    const pngPath = path.join(iconDir, png);

    if (fs.existsSync(svgPath)) {
      sharp(svgPath)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(pngPath)
        .then(() => {
          console.log(`✓ Created ${png}`);
          completed++;
          if (completed === svgFiles.length) {
            console.log('\n✅ All PNG icons generated!');
          }
        })
        .catch(err => console.error(`✗ Error creating ${png}:`, err));
    } else {
      console.warn(`⚠ SVG not found: ${svg}`);
    }
  });

} catch (err) {
  console.error('Error: sharp is not installed.');
  console.log('\nTo fix, run:');
  console.log('  npm install sharp');
  console.log('\nThen run:');
  console.log('  node convert-icons.js');
  process.exit(1);
}
