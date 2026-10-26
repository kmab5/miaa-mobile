import sharp from 'sharp';
import { createHash } from 'node:crypto';
/** Inspect actual alpha geometry, including generated native resources. */
export async function checkMonochromeIcon(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const safeRadius = (info.width * 66) / 108 / 2;
  let furthest = 0;
  let visible = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        visible++;
        furthest = Math.max(
          furthest,
          Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2),
        );
      }
  if (info.width !== info.height || !visible || furthest > safeRadius)
    throw new Error(`Icon exceeds Android's 66dp safe circle or is empty: ${file}`);
  return createHash('sha256').update(data).digest('hex');
}
