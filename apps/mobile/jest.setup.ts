jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Sentry e analytics são inertes nos testes.
jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn(), wrap: (c: unknown) => c }));
// Ícones carregam fontes nativas; nos testes não renderizam nada.
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
