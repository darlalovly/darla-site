import fs from 'fs';
import path from 'path';

const IGNORE = [
  'node_modules',
  '.git',
  '.astro',
  'dist',
  '.DS_Store',
  '.vscode',
  'project-tree.txt',
  'generate-tree.js',
  'generate-tree.mjs'
];

function buildTree(dir, prefix = '') {
  let output = '';
  let items;
  try {
    items = fs.readdirSync(dir).filter(item => !IGNORE.includes(item));
  } catch (err) {
    return output;
  }

  items.sort((a, b) => {
    let aIsDir = false;
    let bIsDir = false;
    try {
      aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
      bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
    } catch (e) {}

    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const itemPath = path.join(dir, item);
    let isDir = false;
    try {
      isDir = fs.statSync(itemPath).isDirectory();
    } catch (e) {}

    const connector = isLast ? '└── ' : '├── ';
    output += `${prefix}${connector}${item}${isDir ? '/' : ''}\r\n`;

    if (isDir) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      output += buildTree(itemPath, childPrefix);
    }
  });

  return output;
}

const rootName = path.basename(process.cwd());
const treeHeader = `${rootName}/\r\n`;
const fullTree = treeHeader + buildTree(process.cwd());

fs.writeFileSync('project-tree.txt', fullTree, 'utf8');
console.log('Successfully generated project-tree.txt with formatted tree!');