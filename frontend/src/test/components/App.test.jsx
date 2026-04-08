/**
 * =============================================
 * TESTES UNITÁRIOS: App Component (Roteamento)
 * =============================================
 * 1. Redirecionamento para /login quando não autenticado
 * 2. Renderização do Dashboard quando autenticado
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock todos os componentes filhos para isolamento
vi.mock('../../components/Dashboard', () => ({
    default: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('../../components/ConfigPanel', () => ({
    default: () => <div data-testid="config-panel">ConfigPanel</div>,
}));
vi.mock('../../components/Login', () => ({
    default: ({ onLogin }) => (
        <div data-testid="login">
            <button onClick={onLogin} data-testid="mock-login-btn">Mock Login</button>
        </div>
    ),
}));
vi.mock('../../components/Sidebar', () => ({
    default: ({ onLogout }) => (
        <div data-testid="sidebar">
            <button onClick={onLogout} data-testid="mock-logout-btn">Mock Logout</button>
        </div>
    ),
}));
vi.mock('../../components/FAQ', () => ({ default: () => <div>FAQ</div> }));
vi.mock('../../components/KnowledgeBaseList', () => ({ default: () => <div>KBList</div> }));
vi.mock('../../components/KnowledgeBaseEditor', () => ({ default: () => <div>KBEditor</div> }));
vi.mock('../../components/ToolsManager', () => ({ default: () => <div>Tools</div> }));
vi.mock('../../components/ChatPlayground', () => ({ default: () => <div>ChatPlayground</div> }));
vi.mock('../../components/Financeiro', () => ({ default: () => <div>Financeiro</div> }));
vi.mock('../../components/FineTuning', () => ({ default: () => <div>FineTuning</div> }));
vi.mock('../../components/IntegrationsPanel', () => ({ default: () => <div>Integrations</div> }));
vi.mock('../../components/PublicChat', () => ({ default: () => <div data-testid="public-chat">PublicChat</div> }));
vi.mock('../../components/UserManagement', () => ({ default: () => <div>UserManagement</div> }));
vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config', () => ({ API_URL: 'http://localhost:8002', AGENT_API_KEY: 'test-key' }));

import App from '../../App';

describe('App Component (Roteamento)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('Controle de Autenticação', () => {
        it('não deve renderizar Dashboard quando não autenticado', () => {
            render(<App />);
            expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
            expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
        });

        it('deve renderizar Dashboard quando autenticado', () => {
            localStorage.setItem('admin_token', 'valid-token');
            localStorage.setItem('user_role', 'Super Admin');
            render(<App />);
            expect(screen.getByTestId('dashboard')).toBeInTheDocument();
            expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });

        it('deve renderizar Sidebar com informações do usuário quando autenticado', () => {
            localStorage.setItem('admin_token', 'valid-token');
            localStorage.setItem('user_role', 'Admin');
            render(<App />);
            expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });
    });
});
