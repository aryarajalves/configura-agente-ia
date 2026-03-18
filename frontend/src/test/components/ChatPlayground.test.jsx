import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPlayground from '../../components/ChatPlayground';
import { api } from '../../api/client';
import { MemoryRouter } from 'react-router-dom';

// Mock do cliente API
vi.mock('../../api/client', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

// Mock do framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('ChatPlayground Component', () => {
    const mockAgent = {
        id: 4,
        name: 'Agente - Eneagrama',
        model: 'gemini-3.1-pro-preview',
        is_active: true,
        system_prompt: 'Persona Prompt',
        knowledge_base: [],
        model_settings: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock default responses
        api.get.mockImplementation((path) => {
            if (path.includes('/agents/4')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAgent)
            });
            if (path.includes('/agents')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([mockAgent])
            });
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        api.post.mockImplementation((path) => {
            if (path.includes('/execute')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    response: 'Resposta mockada',
                    agent_id: 4,
                    cost_brl: 0.01,
                    input_tokens: 10,
                    output_tokens: 10,
                    model_used: 'gpt-4o-mini'
                })
            });
            if (path.includes('/tester/sentiment')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ sentiment: 80 })
            });
            return Promise.resolve({ ok: true });
        });

        // Mock window.location
        delete window.location;
        window.location = new URL('http://localhost:5300/playground?agentId=4');

        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });
    });

    it('should render the playground for the selected agent', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/playground?agentId=4']}>
                    <ChatPlayground />
                </MemoryRouter>
            );
        });

        expect(await screen.findByText('Agente - Eneagrama')).toBeInTheDocument();
    });

    it('should send a message and show the response', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/playground?agentId=4']}>
                    <ChatPlayground />
                </MemoryRouter>
            );
        });

        const input = screen.getByPlaceholderText('Mensagem para o agente');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'Olá!' } });
        });

        const buttons = screen.getAllByRole('button');
        const sendButton = buttons.find(b => b.className.includes('send-trigger'));

        await waitFor(() => {
            expect(sendButton).not.toBeDisabled();
        });

        await act(async () => {
            fireEvent.click(sendButton);
        });

        expect(screen.getByText('Olá!')).toBeInTheDocument();

        // Verificamos se a resposta de sucesso apareceu
        await waitFor(() => {
            expect(screen.getByText('Resposta mockada')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('should show error if execute fails', async () => {
        api.post.mockImplementation((path) => {
            if (path.includes('/execute')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve('ERRO MOCKADO')
                });
            }
            return Promise.resolve({ ok: true });
        });

        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/playground?agentId=4']}>
                    <ChatPlayground />
                </MemoryRouter>
            );
        });

        const input = screen.getByPlaceholderText('Mensagem para o agente');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'Erro!' } });
        });

        const buttons = screen.getAllByRole('button');
        const sendButton = buttons.find(b => b.className.includes('send-trigger'));

        await act(async () => {
            fireEvent.click(sendButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/ERRO MOCKADO/i)).toBeInTheDocument();
        });
    });
});
