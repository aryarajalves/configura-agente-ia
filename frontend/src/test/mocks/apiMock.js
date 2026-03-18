/**
 * Mock centralizado do cliente API.
 * Todas as funções retornam Promises com Responses mockadas.
 */
import { vi } from 'vitest';

// Helper para criar Response mock
export const createMockResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
});

// Mock padrão do api client
export const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
};

// Reseta todas as funções mock
export const resetApiMocks = () => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.put.mockReset();
    mockApi.delete.mockReset();
    mockApi.request.mockReset();
};

// Mock do módulo api/client
vi.mock('../api/client', () => ({
    api: mockApi,
}));

// Mock do módulo config
vi.mock('../config', () => ({
    API_URL: 'http://localhost:8002',
    AGENT_API_KEY: 'test-api-key-123',
    default: {
        API_URL: 'http://localhost:8002',
        AGENT_API_KEY: 'test-api-key-123',
    },
}));
