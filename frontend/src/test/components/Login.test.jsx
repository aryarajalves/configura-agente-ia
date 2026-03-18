/**
 * ========================================
 * TESTES UNITÁRIOS: Login Component
 * ========================================
 * Mapeia todas as ações:
 * 1. Renderização inicial
 * 2. Digitação nos campos
 * 3. Login com sucesso
 * 4. Login com erro de credenciais
 * 5. Login com erro de conexão
 * 6. Estado de loading
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock inline da API
const mockPost = vi.fn();
vi.mock('../../api/client', () => ({
    api: {
        get: vi.fn(),
        post: (...args) => mockPost(...args),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../../config', () => ({
    API_URL: 'http://localhost:8002',
    AGENT_API_KEY: 'test-key',
}));

import Login from '../../components/Login';

describe('Login Component', () => {
    let onLoginMock;

    beforeEach(() => {
        onLoginMock = vi.fn();
        mockPost.mockReset();
    });

    // ===== RENDERIZAÇÃO =====
    describe('Renderização Inicial', () => {
        it('deve renderizar o formulário de login com todos os campos', () => {
            render(<Login onLogin={onLoginMock} />);
            expect(screen.getByText('Agent Flow')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
            expect(screen.getByText('Acessar Painel')).toBeInTheDocument();
        });

        it('deve renderizar o subtítulo e footer', () => {
            render(<Login onLogin={onLoginMock} />);
            expect(screen.getByText(/Acesse seu painel/i)).toBeInTheDocument();
            expect(screen.getByText(/Automação Sem Limites/i)).toBeInTheDocument();
        });

        it('botão de login deve estar habilitado inicialmente', () => {
            render(<Login onLogin={onLoginMock} />);
            expect(screen.getByText('Acessar Painel')).not.toBeDisabled();
        });
    });

    // ===== INTERAÇÕES =====
    describe('Interações com Campos', () => {
        it('deve permitir digitar no campo de email', async () => {
            render(<Login onLogin={onLoginMock} />);
            const emailInput = screen.getByPlaceholderText('seu@email.com');
            await userEvent.type(emailInput, 'test@example.com');
            expect(emailInput.value).toBe('test@example.com');
        });

        it('deve permitir digitar no campo de senha', async () => {
            render(<Login onLogin={onLoginMock} />);
            const passwordInput = screen.getByPlaceholderText('••••••••');
            await userEvent.type(passwordInput, 'minha-senha-123');
            expect(passwordInput.value).toBe('minha-senha-123');
        });
    });

    // ===== LOGIN COM SUCESSO =====
    describe('Login com Sucesso', () => {
        it('deve salvar token e chamar onLogin quando credenciais corretas', async () => {
            mockPost.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    token: 'jwt-token-123',
                    user: { name: 'Admin Super', role: 'Super Admin' }
                }),
            });

            render(<Login onLogin={onLoginMock} />);
            await userEvent.type(screen.getByPlaceholderText('seu@email.com'), 'admin@test.com');
            await userEvent.type(screen.getByPlaceholderText('••••••••'), '123456');
            fireEvent.submit(screen.getByText('Acessar Painel').closest('form'));

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalledWith('/login', { email: 'admin@test.com', password: '123456' });
            });

            await waitFor(() => {
                expect(onLoginMock).toHaveBeenCalledTimes(1);
                expect(localStorage.getItem('admin_token')).toBe('jwt-token-123');
                expect(localStorage.getItem('user_name')).toBe('Admin Super');
                expect(localStorage.getItem('user_role')).toBe('Super Admin');
            });
        });
    });

    // ===== ERROS =====
    describe('Login com Erro', () => {
        it('deve exibir mensagem de erro quando credenciais são inválidas', async () => {
            mockPost.mockResolvedValue({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ detail: 'Email ou senha inválidos' }),
            });

            render(<Login onLogin={onLoginMock} />);
            await userEvent.type(screen.getByPlaceholderText('seu@email.com'), 'wrong@test.com');
            await userEvent.type(screen.getByPlaceholderText('••••••••'), 'senha-errada');
            fireEvent.submit(screen.getByText('Acessar Painel').closest('form'));

            await waitFor(() => {
                expect(screen.getByText('Email ou senha inválidos')).toBeInTheDocument();
            });
            expect(onLoginMock).not.toHaveBeenCalled();
        });

        it('deve exibir erro de conexão quando servidor não responde', async () => {
            mockPost.mockRejectedValue(new Error('Network Error'));

            render(<Login onLogin={onLoginMock} />);
            await userEvent.type(screen.getByPlaceholderText('seu@email.com'), 'admin@test.com');
            await userEvent.type(screen.getByPlaceholderText('••••••••'), '123456');
            fireEvent.submit(screen.getByText('Acessar Painel').closest('form'));

            await waitFor(() => {
                expect(screen.getByText('Erro de conexão com o servidor')).toBeInTheDocument();
            });
        });
    });

    // ===== LOADING =====
    describe('Estado de Loading', () => {
        it('deve mostrar "Entrando..." durante carregamento', async () => {
            mockPost.mockReturnValue(new Promise(() => { }));

            render(<Login onLogin={onLoginMock} />);
            await userEvent.type(screen.getByPlaceholderText('seu@email.com'), 'admin@test.com');
            await userEvent.type(screen.getByPlaceholderText('••••••••'), '123456');
            fireEvent.submit(screen.getByText('Acessar Painel').closest('form'));

            await waitFor(() => {
                expect(screen.getByText('Entrando...')).toBeInTheDocument();
            });
        });
    });
});
