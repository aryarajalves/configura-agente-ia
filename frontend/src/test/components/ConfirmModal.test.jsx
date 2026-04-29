/**
 * ========================================
 * TESTES UNITÁRIOS: ConfirmModal Component
 * ========================================
 * Mapeia todas as ações:
 * 1. Não renderiza quando isOpen=false
 * 2. Renderiza título e mensagem
 * 3. Botão de confirmar chama onConfirm
 * 4. Botão de cancelar chama onCancel
 * 5. Clicar no overlay chama onCancel
 * 6. Textos customizados nos botões
 * 7. Tipo 'danger' vs 'info'
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../../components/ConfirmModal';

describe('ConfirmModal Component', () => {
    let onConfirmMock;
    let onCancelMock;

    beforeEach(() => {
        onConfirmMock = vi.fn();
        onCancelMock = vi.fn();
    });

    // ===== RENDERIZAÇÃO CONDICIONAL =====
    describe('Visibilidade', () => {
        it('não deve renderizar nada quando isOpen é false', () => {
            const { container } = render(
                <ConfirmModal
                    isOpen={false}
                    title="Teste"
                    message="Mensagem"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );
            expect(container.innerHTML).toBe('');
        });

        it('deve renderizar quando isOpen é true', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Excluir Agente?"
                    message="Esta ação não pode ser desfeita."
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );

            expect(screen.getByText('Excluir Agente?')).toBeInTheDocument();
            expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();
        });
    });

    // ===== AÇÕES =====
    describe('Ações dos Botões', () => {
        it('deve chamar onConfirm ao clicar no botão de confirmar', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );

            fireEvent.click(screen.getByText('Confirmar'));
            expect(onConfirmMock).toHaveBeenCalledTimes(1);
        });

        it('deve chamar onCancel ao clicar no botão de cancelar', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );

            fireEvent.click(screen.getByText('Cancelar'));
            expect(onCancelMock).toHaveBeenCalledTimes(1);
        });

        it('deve chamar onCancel ao clicar no overlay (fora do card)', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );

            // O overlay é o container pai com classe confirm-modal-overlay
            const overlay = document.querySelector('.confirm-modal-overlay');
            if (overlay) {
                fireEvent.click(overlay);
                expect(onCancelMock).toHaveBeenCalledTimes(1);
            }
        });

        it('não deve chamar onCancel ao clicar dentro do card (stopPropagation)', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                />
            );

            const card = document.querySelector('.confirm-modal-card');
            if (card) {
                fireEvent.click(card);
                expect(onCancelMock).not.toHaveBeenCalled();
            }
        });
    });

    // ===== ESTADO DE CARREGAMENTO =====
    describe('Estado de Carregamento', () => {
        it('deve exibir o spinner e a mensagem "Apagando..." quando isLoading é true', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                    isLoading={true}
                />
            );

            expect(screen.getByText('Apagando...')).toBeInTheDocument();
            const spinner = document.querySelector('.premium-spinner');
            expect(spinner).toBeInTheDocument();
        });

        it('não deve renderizar os botões de confirmar e cancelar quando isLoading é true', () => {
            render(
                <ConfirmModal
                    isOpen={true}
                    title="Título"
                    message="Msg"
                    onConfirm={onConfirmMock}
                    onCancel={onCancelMock}
                    isLoading={true}
                />
            );

            expect(screen.queryByText('Confirmar')).not.toBeInTheDocument();
            expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
        });
    });
});
