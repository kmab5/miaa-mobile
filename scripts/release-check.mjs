/** Read-only metadata/credential preflight. Does not build, generate keys or contact a backend. */
import { appRole, root, cli, loadEnvironment } from './shared.mjs';
import { apps } from '../config/apps.cjs';
import { resolveEnvironment } from '../config/environment.cjs';
import { releaseMetadata, productionSigning } from '../config/release.cjs';
cli(() => {
  const [input, variant = 'production'] = process.argv.slice(2),
    role = appRole(input);
  const env = loadEnvironment({ MIAA_BUILD_VARIANT: variant });
  const environment = resolveEnvironment(env),
    metadata = releaseMetadata(env);
  const signing = variant === 'production' ? productionSigning(env, role, root) : null;
  const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
  console.log(
    JSON.stringify(
      {
        role,
        variant,
        applicationId: apps[role].applicationId + suffix,
        apiOrigin: environment.apiOrigin,
        ...metadata,
        signing: signing
          ? { expectedCertificateSha256: signing.certificateSha256 }
          : 'test signing',
        credentialsPrinted: false,
        compiled: false,
      },
      null,
      2,
    ),
  );
});
