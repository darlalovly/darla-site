import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const postsDir = './public/images/posts';
const logoUrl = 'https://pub-23c94031ab954f6cb120959a02ecef04.r2.dev/darlalovly-logo.webp';

async function watermarkAllPosts() {
  console.log('Fetching logo from R2...');
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) {
    throw new Error(`Failed to download logo: ${logoResponse.statusText}`);
  }
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());

  function getAllImages(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllImages(filePath));
      } else if (/\.(webp|jpg|jpeg|png)$/i.test(file)) {
        results.push(filePath);
      }
    });
    return results;
  }

  const imageFiles = getAllImages(postsDir);
  console.log(`Found ${imageFiles.length} photos across all post folders.`);

  for (const filePath of imageFiles) {
    try {
      const inputBuffer = fs.readFileSync(filePath);
      const image = sharp(inputBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) continue;

      const logoWidth = Math.max(Math.round(metadata.width * 0.07), 24);
      
      const resizedLogo = await sharp(logoBuffer)
        .resize({ width: logoWidth })
        .composite([{
          input: Buffer.from([255, 255, 255, Math.round(255 * 0.40)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }])
        .toBuffer();

      const watermarkedBuffer = await image
        .composite([{
          input: resizedLogo,
          gravity: 'southeast',
        }])
        .toBuffer();

      fs.writeFileSync(filePath, watermarkedBuffer);
      console.log(`Watermarked: ${filePath}`);
    } catch (err) {
      console.error(`Failed to watermark ${filePath}:`, err);
    }
  }
}

watermarkAllPosts();