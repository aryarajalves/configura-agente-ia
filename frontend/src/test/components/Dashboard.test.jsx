/**
 * =============================================
 * TESTES UNITÁRIOS: Dashboard Component
 * =============================================
 * O Dashboard depende de:
 * - api.get('/agents'), api.get('/knowledge-bases'), api.get('/dashboard/stats')
 * - AgentCard, StatCard, ConfirmModal, GlobalContextManager
 * - react-router-dom (Link, useNavigate)
 * 
 * Testamos:
 * 1. Renderização do loading screen
 * 2. Carregamento de agentes e KBs
 * 3. Exibição de stats (KPIs)
 * 4. Filtragem por nome
 * 5. Empty state
 * 6. Ação de pausar agente
 * 7. Permissões por role
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock do GlobalContextManager antes do import do Dashboard
vi.mock('../../components/GlobalContextManager', () => ({
    default: () => <div data-testid="global-context-manager">Mock</div>,
}));

// Mock da API - precisa estar no topo antes da importação
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../api/client', () => ({
    api: {
        get: (...args) => mockGet(...args),
        post: (...args) => mockPost(...args),
        put: vi.fn(),
        delete: (...args) => mockDelete(...args),
    },
}));

vi.mock('../../config', () => ({
    API_URL: 'http://localhost:8002',
    AGENT_API_KEY: 'test-key',
}));

// Importa Dashboard DEPOIS dos mocks
import Dashboard from '../../components/Dashboard';

// Dados mock
const mockAgents = [
    { id: 1, name: 'Agente Vendas', model: 'gpt-4o', is_active: true, description: 'Agente de vendas', knowledge_base_id: null, tool_ids: [] },
    { id: 2, name: 'Agente Suporte', model: 'gemini-1.5-pro', is_active: true, description: 'Suporte técnico', knowledge_base_id: 1, tool_ids: [] },
    { id: 3, name: 'Agente Inativo', model: 'gpt-4o-mini', is_active: false, description: null, knowledge_base_id: null, tool_ids: [] },
];

const mockKBs = [{ id: 1, name: 'Base FAQ', description: 'FAQ geral' }];

const mockStats = { total_agents: 3, total_knowledge_bases: 1, total_interactions: 150, total_cost: 25.50 };

const setupDefaultMocks = () => {
    mockGet.mockImplementation((path) => {
        if (path === '/agents') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAgents) });
        if (path === '/knowledge-bases') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockKBs) });
        if (path === '/dashboard/stats') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
};

const renderDashboard = (role = 'Super Admin') => {
    localStorage.setItem('user_role', role);
    localStorage.setItem('user_name', 'Test User');
    return render(
        <MemoryRouter>
            <Dashboard />
        </MemoryRouter>
    );
};

describe('Dashboard Component', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        mockDelete.mockReset();
        setupDefaultMocks();
    });

    // ===== CARREGAMENTO =====
    describe('Carregamento Inicial', () => {
        it('deve exibir tela de loading inicialmente', () => {
            mockGet.mockReturnValue(new Promise(() => { }));
            renderDashboard();
            expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
        });

        it('deve carregar e exibir agentes após fetch', async () => {
            renderDashboard();
            await waitFor(() => {
                expect(screen.getByText('Agente Vendas')).toBeInTheDocument();
                expect(screen.getByText('Agente Suporte')).toBeInTheDocument();
            });
        });

        it('deve chamar as APIs corretas no mount', async () => {
            renderDashboard();
            await waitFor(() => {
                expect(mockGet).toHaveBeenCalledWith('/agents');
                expect(mockGet).toHaveBeenCalledWith('/knowledge-bases');
                expect(mockGet).toHaveBeenCalledWith('/dashboard/stats');
            });
        });
    });

    // ===== STATS KPIs =====
    describe('KPI Stats', () => {
        it('deve exibir stats de agentes ativos para Admin', async () => {
            renderDashboard('Super Admin');
            await waitFor(() => {
                expect(screen.getByText('Agentes Ativos')).toBeInTheDocument();
            });
        });

        it('deve exibir custo estimado formatado', async () => {
            renderDashboard('Super Admin');
            await waitFor(() => {
                expect(screen.getByText('R$ 25.50')).toBeInTheDocument();
            });
        });
    });

    // ===== FILTRAGEM =====
    describe('Filtragem de Agentes', () => {
        it('deve filtrar agentes pelo nome ao digitar na busca', async () => {
            renderDashboard();
            await waitFor(() => expect(screen.getByText('Agente Vendas')).toBeInTheDocument());

            const searchInput = screen.getByPlaceholderText('Buscar agente...');
            await userEvent.type(searchInput, 'Suporte');

            await waitFor(() => {
                expect(screen.getByText('Agente Suporte')).toBeInTheDocument();
                expect(screen.queryByText('Agente Vendas')).not.toBeInTheDocument();
            });
        });

        it('deve exibir empty state quando filtro não encontra resultados', async () => {
            renderDashboard();
            await waitFor(() => expect(screen.getByText('Agente Vendas')).toBeInTheDocument());

            const searchInput = screen.getByPlaceholderText('Buscar agente...');
            await userEvent.type(searchInput, 'NaoExisteAgente');

            await waitFor(() => {
                expect(screen.getByText('Nenhum agente encontrado')).toBeInTheDocument();
            });
        });
    });

    // ===== AÇÕES =====
    describe('Ações em Agentes', () => {
        it('deve chamar API de toggle ao pausar agente', async () => {
            mockPost.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ ...mockAgents[0], is_active: false }),
            });
            renderDashboard();
            await waitFor(() => expect(screen.getByText('Agente Vendas')).toBeInTheDocument());

            const pauseButtons = screen.getAllByTitle('Pausar');
            fireEvent.click(pauseButtons[0]);

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalledWith('/agents/1/toggle');
            });
        });
    });

    // ===== PERMISSÕES =====
    describe('Controle de Permissões', () => {
        it('deve mostrar botão "+ Novo Agente" para Admin', async () => {
            renderDashboard('Admin');
            await waitFor(() => expect(screen.getByText('+ Novo Agente')).toBeInTheDocument());
        });

        it('deve esconder botão "+ Novo Agente" para Usuário', async () => {
            renderDashboard('Usuário');
            await waitFor(() => expect(screen.getByText('Agente Vendas')).toBeInTheDocument());
            expect(screen.queryByText('+ Novo Agente')).not.toBeInTheDocument();
        });

        it('Usuário não deve ver botões de excluir nos cards', async () => {
            renderDashboard('Usuário');
            await waitFor(() => expect(screen.getByText('Agente Vendas')).toBeInTheDocument());
            expect(screen.queryAllByTitle('Excluir')).toHaveLength(0);
        });
    });
});
