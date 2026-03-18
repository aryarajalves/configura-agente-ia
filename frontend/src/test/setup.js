// Setup global para testes com Vitest + React Testing Library
import '@testing-library/jest-dom';

// Mock do localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock do navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
    },
    writable: true,
});

// Mock do window.location
delete window.location;
window.location = {
    href: 'http://localhost:5300/',
    pathname: '/',
    origin: 'http://localhost:5300',
    assign: vi.fn(),
    reload: vi.fn(),
};

// Mock do import.meta.env
globalThis.import = { meta: { env: {} } };

// Limpar mocks e localStorage entre testes
afterEach(() => {
    vi.restoreAllMocks();
    localStorageMock.clear();
});
