import { jest } from '@jest/globals';
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
export const mockParams: Record<string, string | string[] | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    Link: ({
      children,
      href,
    }: {
      children: React.ReactElement<{ onPress?: () => void }>;
      href: unknown;
    }) => React.cloneElement(children, { onPress: () => mockRouter.push(href) }),
  };
});
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
