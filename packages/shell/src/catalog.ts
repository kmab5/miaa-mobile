import type { AppRole } from '@miaa/config';
import type { TranslationKey } from '@miaa/i18n';
import type { IconName } from '@miaa/ui';
export type WorkspaceModule = {
  id: string;
  title: TranslationKey;
  description: TranslationKey;
  detail: TranslationKey;
  icon: IconName;
};
const module = (id: string, icon: IconName): WorkspaceModule => ({
  id,
  icon,
  title: `module.${id}` as TranslationKey,
  description: `module.${id}Desc` as TranslationKey,
  detail: `module.${id}Detail` as TranslationKey,
});
export const workspaces: Record<
  AppRole,
  {
    title: TranslationKey;
    headline: TranslationKey;
    introduction: TranslationKey;
    workspaceTitle: TranslationKey;
    icon: IconName;
    modules: WorkspaceModule[];
  }
> = {
  admin: {
    title: 'admin.title',
    headline: 'admin.headline',
    introduction: 'admin.intro',
    workspaceTitle: 'admin.workspace',
    icon: 'admin',
    modules: [
      module('daily', 'list'),
      module('people', 'people'),
      module('ordersAdmin', 'package'),
      module('catalog', 'client'),
      module('reports', 'reports'),
      module('support', 'archive'),
    ],
  },
  mother: {
    title: 'mother.title',
    headline: 'mother.headline',
    introduction: 'mother.intro',
    workspaceTitle: 'mother.workspace',
    icon: 'mother',
    modules: [
      module('preparation', 'list'),
      module('meal', 'client'),
      module('requests', 'support'),
    ],
  },
  cyclist: {
    title: 'cyclist.title',
    headline: 'cyclist.headline',
    introduction: 'cyclist.intro',
    workspaceTitle: 'cyclist.workspace',
    icon: 'cyclist',
    modules: [
      module('run', 'cyclist'),
      module('lookup', 'package'),
      module('earnings', 'money'),
      module('meal', 'client'),
    ],
  },
  client: {
    title: 'client.title',
    headline: 'client.headline',
    introduction: 'client.intro',
    workspaceTitle: 'client.workspace',
    icon: 'client',
    modules: [
      module('today', 'client'),
      module('discover', 'location'),
      module('orders', 'package'),
      module('address', 'location'),
    ],
  },
};
export function findWorkspaceModule(role: AppRole, id: unknown): WorkspaceModule | undefined {
  return typeof id === 'string'
    ? workspaces[role].modules.find((module) => module.id === id)
    : undefined;
}
