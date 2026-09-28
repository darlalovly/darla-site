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

  // Function to scan all subfolders inside /public/images/posts
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

      // Set logo size to 15% of image width
      const logoWidth = Math.round(metadata.width * 0.15);
      const resizedLogo = await sharp(logoBuffer).resize({ width: logoWidth }).toBuffer();

      // Bake watermark into bottom-right corner
      const watermarkedBuffer = await image
        .composite([{
          input: resizedLogo,
          gravity: 'southeast',
        }])
        .toBuffer();

      // Overwrite the original file in place
      fs.writeFileSync(filePath, watermarkedBuffer);
      console.log(`Watermarked: ${filePath}`);
    } catch (err) {
      console.error(`Failed to watermark ${filePath}:`, err);
    }
  }
}

watermarkAllPosts();