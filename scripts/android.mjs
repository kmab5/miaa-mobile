import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { releaseMetadata, productionSigning, assertSigner } from '../config/release.cjs';
import { appRole, appDirectory, cli, loadEnvironment, root, run, runExpo } from './shared.mjs';
import entrypoints from '../config/normalize-android-entrypoints.cjs';
import { apps } from '../config/apps.cjs';
import { checkMonochromeIcon } from '../config/check-icon.mjs';
import { resolveEnvironment } from '../config/environment.cjs';
cli(async () => {
  const [input, variant = 'preview'] = process.argv.slice(2);
  const role = appRole(input);
  if (!['development', 'preview', 'production'].includes(variant))
    throw new Error('Choose development, preview or production.');
  const env = loadEnvironment({ MIAA_BUILD_VARIANT: variant, CI: '1' });
  const workers = Number(env.MIAA_ANDROID_BUILD_WORKERS || '1');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8)
    throw new Error('MIAA_ANDROID_BUILD_WORKERS must be an integer from 1 to 8.');
  resolveEnvironment(env);
  releaseMetadata(env);
  const signing = variant === 'production' ? productionSigning(env, role, root) : null;
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdk || !existsSync(sdk))
    throw new Error('Install Android Studio/SDK and set ANDROID_HOME. See docs/BUILDING.md.');
  const java = env.JAVA_HOME
    ? join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const javac = env.JAVA_HOME
    ? join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')
    : 'javac';
  run(java, ['-version'], { env });
  run(javac, ['-version'], { env });
  // Remove only generated image caches so source icon changes always reach native resources.
  rmSync(join(appDirectory(role), '.expo/web/cache/production/images'), {
    recursive: true,
    force: true,
  });
  runExpo(role, ['prebuild', '--platform', 'android', '--clean', '--no-install'], env);
  const native = join(appDirectory(role), 'android');
  entrypoints.assertAndroidEntrypoints(
    native,
    apps[role].applicationId +
      (variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev'),
  );
  await checkMonochromeIcon(
    join(native, 'app/src/main/res/mipmap-xxxhdpi/ic_launcher_monochrome.webp'),
  );
  const wrapperProperties = join(native, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  writeFileSync(
    wrapperProperties,
    readFileSync(wrapperProperties, 'utf8').replace(
      /^networkTimeout=\d+/m,
      'networkTimeout=120000',
    ),
  );
  const architectures = env.MIAA_ANDROID_ARCHITECTURES || 'arm64-v8a,x86_64';
  if (
    !/^(arm64-v8a|armeabi-v7a|x86_64|x86)(,(arm64-v8a|armeabi-v7a|x86_64|x86))*$/.test(
      architectures,
    )
  )
    throw new Error('Invalid MIAA_ANDROID_ARCHITECTURES.');
  const wrapper = join(native, 'gradle', 'wrapper', 'gradle-wrapper.jar');
  const jvm = ['-Xmx64m', '-Dfile.encoding=UTF-8'];
  // Respect standard HTTPS proxy routing without writing machine-specific settings to the repo.
  const rawProxy = env.HTTPS_PROXY || env.https_proxy;
  if (rawProxy) {
    const proxy = new URL(rawProxy);
    if (!proxy.username && !proxy.password)
      for (const protocol of ['https', 'http'])
        jvm.push(
          `-D${protocol}.proxyHost=${proxy.hostname}`,
          `-D${protocol}.proxyPort=${proxy.port || (proxy.protocol === 'https:' ? '443' : '80')}`,
        );
  }
  const task = variant !== 'development' ? ':app:assembleRelease' : ':app:assembleDebug';
  run(
    java,
    [
      ...jvm,
      '-classpath',
      wrapper,
      'org.gradle.wrapper.GradleWrapperMain',
      task,
      '--no-daemon',
      `--max-workers=${workers}`,
      '-Dorg.gradle.parallel=false',
      '--console=plain',
      '-Dorg.gradle.vfs.watch=false',
      `-PreactNativeArchitectures=${architectures}`,
    ],
    { cwd: native, env },
  );
  const flavor = variant !== 'development' ? 'release' : 'debug';
  const source = join(native, 'app', 'build', 'outputs', 'apk', flavor, `app-${flavor}.apk`);
  if (!existsSync(source))
    throw new Error('Gradle succeeded but the expected APK was not produced.');
  const signature = execFileSync(
    java,
    [
      '-jar',
      join(sdk, 'build-tools', '37.0.0', 'lib', 'apksigner.jar'),
      'verify',
      '--verbose',
      '--print-certs',
      source,
    ],
    { env, encoding: 'utf8' },
  );
  assertSigner(signature, signing?.certificateSha256);
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  const destination = join(root, 'artifacts', `miaa-${role}-${variant}-v${version}.apk`);
  copyFileSync(source, destination);
  console.log(`Built ${destination}`);
});
