/**
 * =============================================
 * TESTES UNITÁRIOS: Sidebar Component
 * =============================================
 * Mapeia todas as ações:
 * 1. Renderização dos links de navegação
 * 2. Controle de visibilidade por role (Super Admin, Admin, Usuário)
 * 3. Exibição do nome e role do usuário
 * 4. Modal de logout (abrir, cancelar, confirmar)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

describe('Sidebar Component', () => {
    let onLogoutMock;

    beforeEach(() => {
        onLogoutMock = vi.fn();
    });

    const renderSidebar = (role = 'Super Admin', name = 'Admin Super') => {
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_name', name);
        return render(
            <MemoryRouter>
                <Sidebar onLogout={onLogoutMock} />
            </MemoryRouter>
        );
    };

    // ===== RENDERIZAÇÃO =====
    describe('Renderização Básica', () => {
        it('deve renderizar o logo do Agent Flow', () => {
            renderSidebar();
            expect(screen.getByText('Agent Flow')).toBeInTheDocument();
        });

        it('deve exibir o nome do usuário', () => {
            renderSidebar('Admin', 'João Silva');
            expect(screen.getByText('João Silva')).toBeInTheDocument();
        });

        it('deve exibir o role do usuário', () => {
            renderSidebar('Super Admin');
            expect(screen.getByText('Super Admin')).toBeInTheDocument();
        });
    });

    // ===== VISIBILIDADE POR ROLE =====
    describe('Controle de Permissões - Super Admin', () => {
        it('Super Admin deve ver TODOS os links', () => {
            renderSidebar('Super Admin');

            expect(screen.getByText('Meus Agentes')).toBeInTheDocument();
            expect(screen.getByText('Bases de Conhecimento')).toBeInTheDocument();
            expect(screen.getByText('Ferramentas (API)')).toBeInTheDocument();
            expect(screen.getByText('Financeiro')).toBeInTheDocument();
            expect(screen.getByText('Integrações')).toBeInTheDocument();
            expect(screen.getByText('Fine-Tuning')).toBeInTheDocument();
            expect(screen.getByText('Gestão de Usuários')).toBeInTheDocument();
        });
    });

    describe('Controle de Permissões - Admin', () => {
        it('Admin deve ver links de gerenciamento e laboratório, mas NÃO gestão de usuários', () => {
            renderSidebar('Admin');

            expect(screen.getByText('Meus Agentes')).toBeInTheDocument();
            expect(screen.getByText('Bases de Conhecimento')).toBeInTheDocument();
            expect(screen.getByText('Ferramentas (API)')).toBeInTheDocument();
            expect(screen.getByText('Financeiro')).toBeInTheDocument();
            expect(screen.getByText('Fine-Tuning')).toBeInTheDocument();
            expect(screen.queryByText('Gestão de Usuários')).not.toBeInTheDocument();
        });
    });

    describe('Controle de Permissões - Usuário', () => {
        it('Usuário deve ver apenas "Meus Agentes"', () => {
            renderSidebar('Usuário');

            expect(screen.getByText('Meus Agentes')).toBeInTheDocument();
            expect(screen.queryByText('Bases de Conhecimento')).not.toBeInTheDocument();
            expect(screen.queryByText('Ferramentas (API)')).not.toBeInTheDocument();
            expect(screen.queryByText('Fine-Tuning')).not.toBeInTheDocument();
            expect(screen.queryByText('Gestão de Usuários')).not.toBeInTheDocument();
        });
    });

    // ===== MODAL DE LOGOUT =====
    describe('Modal de Logout', () => {
        it('deve abrir o modal de logout ao clicar em "Sair do Painel"', () => {
            renderSidebar();

            fireEvent.click(screen.getByText('Sair do Painel'));
            expect(screen.getByText('Até logo!')).toBeInTheDocument();
            expect(screen.getByText(/encerrar sua sessão/i)).toBeInTheDocument();
        });

        it('deve fechar o modal ao clicar em "Cancelar"', () => {
            renderSidebar();

            fireEvent.click(screen.getByText('Sair do Painel'));
            expect(screen.getByText('Até logo!')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Cancelar'));
            expect(screen.queryByText('Até logo!')).not.toBeInTheDocument();
        });

        it('deve chamar onLogout ao clicar em "Sim, Sair"', () => {
            renderSidebar();

            fireEvent.click(screen.getByText('Sair do Painel'));
            fireEvent.click(screen.getByText('Sim, Sair'));

            expect(onLogoutMock).toHaveBeenCalledTimes(1);
        });
    });
});
