/** Permanent production identifiers. Development and preview builds get suffixes. */
const apps = Object.freeze({
  admin: {
    role: 'admin',
    name: "Mi'aa Admin",
    slug: 'miaa-admin',
    applicationId: 'com.kmab.miaa.admin',
    scheme: 'miaa-admin',
    shortCode: 'A',
  },
  mother: {
    role: 'mother',
    name: "Mi'aa Mother",
    slug: 'miaa-mother',
    applicationId: 'com.kmab.miaa.mother',
    scheme: 'miaa-mother',
    shortCode: 'M',
  },
  cyclist: {
    role: 'cyclist',
    name: "Mi'aa Cyclist",
    slug: 'miaa-cyclist',
    applicationId: 'com.kmab.miaa.cyclist',
    scheme: 'miaa-cyclist',
    shortCode: 'R',
  },
  client: {
    role: 'client',
    name: "Mi'aa Client",
    slug: 'miaa-client',
    applicationId: 'com.kmab.miaa.client',
    scheme: 'miaa-client',
    shortCode: 'C',
  },
});
module.exports = { apps, roles: Object.keys(apps) };
