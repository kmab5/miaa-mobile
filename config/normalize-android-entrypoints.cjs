const fs = require('node:fs');
const path = require('node:path');
function entries(directory, name) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? entries(file, name)
      : entry.isFile() && entry.name === name
        ? [file]
        : [];
  });
}
function packageOf(contents) {
  return contents.match(/^package\s+([^;\r\n]+);?/m)?.[1].trim();
}
function comparable(contents, activity) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || /^package\s/.test(line)) return false;
      if (!activity) return true;
      return (
        !/^import expo\.modules\.splashscreen\.SplashScreenManager\s*;?$/.test(line) &&
        !/^\/\/ @generated (?:begin|end) expo-splashscreen/.test(line) &&
        !/^(?:\/\/\s*)?setTheme\(R\.style\.AppTheme\);?$/.test(line) &&
        !/^SplashScreenManager\.registerOnActivity\(this\);?$/.test(line)
      );
    })
    .join('\n');
}
function assertAndroidEntrypoints(nativeRoot, namespace) {
  const javaRoot = path.join(nativeRoot, 'app/src/main/java');
  for (const name of ['MainActivity.kt', 'MainApplication.kt']) {
    const found = entries(javaRoot, name);
    const expected = path.join(javaRoot, ...namespace.split('.'), name);
    if (
      found.length !== 1 ||
      found[0] !== expected ||
      packageOf(fs.readFileSync(expected, 'utf8')) !== namespace
    )
      throw new Error(`Generated ${name} does not match Android namespace ${namespace}.`);
    if (
      name === 'MainActivity.kt' &&
      !fs.readFileSync(expected, 'utf8').includes('SplashScreenManager.registerOnActivity(this)')
    )
      throw new Error('The generated MainActivity lost the splash-screen registration.');
  }
}
/** Merge only the known CNG package-refactor/splash-template duplicate; refuse other conflicts. */
function normalizeAndroidEntrypoints(nativeRoot, namespace) {
  if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(namespace))
    throw new Error('Invalid Android namespace.');
  const javaRoot = path.join(nativeRoot, 'app/src/main/java');
  const plans = [];
  for (const name of ['MainActivity.kt', 'MainApplication.kt']) {
    const found = entries(javaRoot, name).map((file) => ({
      file,
      contents: fs.readFileSync(file, 'utf8'),
    }));
    if (!found.length) throw new Error(`Missing generated ${name}.`);
    const activity = name === 'MainActivity.kt';
    const alternatives = new Set(found.map((item) => comparable(item.contents, activity)));
    if (alternatives.size !== 1)
      throw new Error(`Conflicting generated ${name} files; refusing to discard native changes.`);
    const chosen = activity
      ? found.find((item) => item.contents.includes('SplashScreenManager.registerOnActivity(this)'))
      : (found.find((item) => packageOf(item.contents) === namespace) ?? found[0]);
    if (!chosen || !packageOf(chosen.contents))
      throw new Error(`Generated ${name} is missing required configuration.`);
    const target = path.join(javaRoot, ...namespace.split('.'), name);
    const contents = chosen.contents.replace(/^package\s+[^;\r\n]+;?/m, `package ${namespace}`);
    plans.push({ found, target, contents });
  }
  // Validate both entry points before writing either; unrelated native classes are untouched.
  for (const { found, target, contents } of plans) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents)
      fs.writeFileSync(target, contents);
    for (const item of found) if (item.file !== target) fs.unlinkSync(item.file);
  }
  assertAndroidEntrypoints(nativeRoot, namespace);
}
module.exports = { normalizeAndroidEntrypoints, assertAndroidEntrypoints };
