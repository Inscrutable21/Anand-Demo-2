/**
 * CASA MOMO • MODULAR BUILD SCRIPT
 * Combines modular section files (/sections) into index.html
 * and modular stylesheets (/styles) into style.css
 */

const fs = require('fs');
const path = require('path');

function buildHTML() {
  const templatePath = path.join(__dirname, 'template.html');
  if (!fs.existsSync(templatePath)) {
    console.error('template.html not found!');
    return;
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // Match <!-- @include: sections/filename.html -->
  const includeRegex = /<!--\s*@include:\s*([^\s]+)\s*-->/g;

  html = html.replace(includeRegex, (match, filePath) => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      return `<!-- BEGIN ${filePath} -->\n${content}\n<!-- END ${filePath} -->`;
    } else {
      console.warn(`File not found: ${filePath}`);
      return `<!-- Missing include: ${filePath} -->`;
    }
  });

  const outputPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`[HTML] Successfully compiled index.html (${html.length} bytes)`);
}

function buildCSS() {
  const stylesDir = path.join(__dirname, 'styles');
  if (!fs.existsSync(stylesDir)) return;

  const styleFiles = [
    'variables.css',
    'cursor.css',
    'preloader.css',
    'header.css',
    'hero.css',
    'philosophy.css',
    'apartments.css',
    'host.css',
    'graz-guide.css',
    'reviews.css',
    'footer.css',
    'modals.css',
    'responsive.css'
  ];

  let bundle = `/* ==========================================================================\n   CASA MOMO • BOUTIQUE APARTMENTS IN GRAZ\n   Compiled Modular Stylesheet\n   ========================================================================== */\n\n`;

  styleFiles.forEach(file => {
    const filePath = path.join(stylesDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      bundle += `/* --- File: styles/${file} --- */\n${content}\n\n`;
    }
  });

  const outputPath = path.join(__dirname, 'style.css');
  fs.writeFileSync(outputPath, bundle, 'utf8');
  console.log(`[CSS] Successfully compiled style.css (${bundle.length} bytes)`);
}

function buildAll() {
  console.log('--- Building Casa Momo Project ---');
  buildHTML();
  buildCSS();
  console.log('--- Build Complete! ---');
}

buildAll();

// Check for --watch flag
if (process.argv.includes('--watch') || process.argv.includes('-w')) {
  console.log('[WATCH] Watching /sections, /styles, and template.html for changes...');

  const watchDirs = [
    path.join(__dirname, 'sections'),
    path.join(__dirname, 'styles'),
    path.join(__dirname, 'template.html')
  ];

  let timeout = null;
  const triggerDebouncedBuild = (event, filename) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log(`[CHANGE] Detected change in ${filename}. Rebuilding...`);
      buildAll();
    }, 100);
  };

  watchDirs.forEach(target => {
    if (fs.existsSync(target)) {
      fs.watch(target, { recursive: true }, triggerDebouncedBuild);
    }
  });
}

