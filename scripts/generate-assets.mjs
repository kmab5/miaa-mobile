/** Regenerate app icons from the checked-in original vectors; no network or AI imagery. */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { apps } from '../config/apps.cjs';
const icon = readFileSync('assets/brand/icon-primary.svg', 'utf8').match(/<g[\s\S]*<\/g>/)[0];
const mono = readFileSync('assets/brand/icon-black.svg', 'utf8').match(/<g[\s\S]*<\/g>/)[0];
const letters = {
  admin: 'M10 90L50 10L90 90M28 56H72',
  mother: 'M10 90V10L50 56L90 10V90',
  cyclist: 'M15 90V10H55Q90 10 90 35Q90 60 55 60H15M55 60L90 90',
  client: 'M88 20C65 -4 10 0 10 50C10 100 65 104 88 80',
};
const badge = '<rect x="580" y="590" width="156" height="156" rx="48" fill="#000000"/>';
// Keep the entire mark/badge inside Android's central 66dp safe circle on its 108dp canvas.
for (const role of Object.keys(apps)) {
  const glyph = (color) =>
    `<g transform="translate(608 618)"><path d="${letters[role]}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  const mark = (vector) =>
    `<svg x="212" y="170" width="600" height="600" viewBox="0 0 39.845519 39.845519">${vector}</svg>`;
  const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#ffffff"/>${mark(icon)}${badge}${glyph('#ffffff')}</svg>`;
  for (const name of ['icon', 'adaptive-icon'])
    await sharp(Buffer.from(drawing)).png().toFile(`apps/${role}/assets/${name}.png`);
  await sharp(Buffer.from(drawing)).resize(64).png().toFile(`apps/${role}/assets/favicon.png`);
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 39.845519 39.845519">${mono}</svg>`,
    ),
  )
    .png()
    .toFile(`apps/${role}/assets/splash.png`);
  // Themed icons use alpha, so cut the role glyph out instead of painting it white.
  const monochrome = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><mask id="role" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/>${glyph('#000000')}</mask></defs><g mask="url(#role)">${mark(mono)}${badge}</g></svg>`;
  await sharp(Buffer.from(monochrome)).png().toFile(`apps/${role}/assets/monochrome-icon.png`);
}
console.log('Generated icons for all four apps.');
