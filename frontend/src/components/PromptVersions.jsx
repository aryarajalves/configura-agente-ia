import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';

const PromptVersions = ({ agentId, onRestore }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteId, setDeleteId] = useState(null);
    const [restoreData, setRestoreData] = useState(null);
    const [viewId, setViewId] = useState(null);
    const [editDraft, setEditDraft] = useState(null);
    const [editName, setEditName] = useState('');
    const [editText, setEditText] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const fetchDrafts = async () => {
        if (!agentId || agentId === 'new') {
            setLoading(false);
            return;
        }
        try {
            const res = await api.get(`/agents/${agentId}/drafts`);
            const data = await res.json();
            setDrafts(data || []);
        } catch (e) {
            console.error("Erro ao buscar rascunhos:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, [agentId]);

    const handleDelete = async () => {
        try {
            await api.delete(`/drafts/${deleteId}`);
            fetchDrafts();
        } catch (e) {
            console.error("Erro ao excluir rascunho:", e);
        } finally {
            setDeleteId(null);
        }
    };

    const confirmRestore = () => {
        onRestore(restoreData.prompt_text);
        setRestoreData(null);
    };

    const handleEditStart = (draft) => {
        setEditDraft(draft);
        setEditName(draft.version_name);
        setEditText(draft.prompt_text);
    };

    const handleEditSave = async () => {
        if (!editName.trim() || !editText.trim()) return;
        setIsSavingEdit(true);
        try {
            const res = await api.put(`/drafts/${editDraft.id}`, {
                version_name: editName,
                prompt_text: editText,
                agent_id: agentId // Required by model even if not changed
            });
            if (res.ok) {
                setEditDraft(null);
                fetchDrafts();
            }
        } catch (e) {
            console.error("Erro ao editar rascunho:", e);
        } finally {
            setIsSavingEdit(false);
        }
    };

    if (!agentId || agentId === 'new') {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Salve o agente primeiro para habilitar o controle de versões de prompt.</p>
            </div>
        );
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Carregando versões...</div>;

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="section-label">Histórico de Versões do Prompt</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{drafts.length} versões salvas</span>
            </div>

            {drafts.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nenhuma versão salva ainda. No editor de prompt, clique em "Salvar Rascunho" para criar um ponto de restauração.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {drafts.map(d => (
                        <div key={d.id} className="draft-wrapper">
                            <div className={`draft-card ${viewId === d.id ? 'active' : ''}`} style={{
                                background: 'rgba(15, 23, 42, 0.4)',
                                border: '1px solid var(--border-color)',
                                padding: '1.2rem 1.5rem',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                position: 'relative',
                                zIndex: 2
                            }} onClick={() => setViewId(viewId === d.id ? null : d.id)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        {viewId === d.id ? '📖' : '📜'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', marginBottom: '2px' }}>{d.version_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🕒 {new Date(d.created_at).toLocaleString('pt-BR')}</span>
                                            <span style={{ opacity: 0.3 }}>•</span>
                                            <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{d.token_count || Math.ceil(d.prompt_text.length / 4)} tokens</span>
                                            <span style={{ opacity: 0.3 }}>•</span>
                                            <span>{d.character_count || d.prompt_text.length} caracteres</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleEditStart(d)}
                                        className="secondary-btn edit-trigger"
                                        style={{
                                            padding: '0.6rem 1rem',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            color: '#60a5fa',
                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                            borderRadius: '10px'
                                        }}
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        onClick={() => setRestoreData(d)}
                                        className="secondary-btn restore-trigger"
                                        style={{
                                            padding: '0.6rem 1.2rem',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10b981',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            borderRadius: '10px'
                                        }}
                                    >
                                        🔄 Restaurar
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(d.id)}
                                        className="delete-trigger"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.1)',
                                            padding: '0.6rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        🗑️
                                    </button>
                                    <div style={{ marginLeft: '10px', opacity: 0.3, transform: viewId === d.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                        ▼
                                    </div>
                                </div>
                            </div>

                            {/* Conteúdo Expandido */}
                            {viewId === d.id && (
                                <div className="draft-content-preview fade-in" style={{
                                    background: 'rgba(2, 6, 23, 0.4)',
                                    margin: '-10px 10px 0 10px',
                                    padding: '2rem 1.5rem 1.5rem 1.5rem',
                                    borderRadius: '0 0 16px 16px',
                                    border: '1px solid var(--border-color)',
                                    borderTop: 'none',
                                    fontSize: '0.9rem',
                                    color: '#cbd5e1',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '400px',
                                    overflowY: 'auto'
                                }}>
                                    {d.prompt_text}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Confirmação de Restauração */}
            <ConfirmModal
                isOpen={!!restoreData}
                title="Confirmar Restauração"
                message={`Você deseja substituir o prompt atual pelo rascunho "${restoreData?.version_name}"?`}
                onConfirm={confirmRestore}
                onCancel={() => setRestoreData(null)}
                confirmText="🔄 Sim, Restaurar"
                type="info"
            />

            {/* Modal de Confirmação de Exclusão */}
            <ConfirmModal
                isOpen={!!deleteId}
                title="Excluir Versão"
                message="Esta ação é permanente e não pode ser desfeita. Excluir este rascunho?"
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
                confirmText="Excluir Permanentemente"
                type="danger"
            />

            {/* Modal de Edição de Rascunho */}
            {editDraft && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(10px)',
                    zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '20px'
                }}>
                    <div className="step-card fade-in" style={{
                        width: '100%', maxWidth: '800px', padding: '2.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem' }}>
                                ✏️ Editar Rascunho
                            </h3>
                            <button onClick={() => setEditDraft(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>

                        <div className="form-group">
                            <label>Nome da Versão</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ width: '100%', padding: '1rem', background: '#020617', border: '1px solid var(--border-color)', color: 'white', borderRadius: '12px' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label>Texto do Prompt</label>
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                style={{
                                    width: '100%', minHeight: '300px', padding: '1.2rem',
                                    background: '#020617', border: '1px solid var(--border-color)',
                                    color: 'white', borderRadius: '12px', fontFamily: 'monospace',
                                    lineHeight: '1.6', fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                            <button
                                onClick={() => setEditDraft(null)}
                                className="secondary-btn"
                                style={{ flex: 1, padding: '1rem' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditSave}
                                className="create-agent-btn"
                                style={{ flex: 2, padding: '1rem' }}
                                disabled={isSavingEdit || !editName.trim() || !editText.trim()}
                            >
                                {isSavingEdit ? 'Salvando...' : '💾 Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .draft-wrapper {
                    position: relative;
                }
                .draft-card:hover {
                    border-color: rgba(99, 102, 241, 0.4) !important;
                    background: rgba(15, 23, 42, 0.6) !important;
                    transform: translateY(-2px);
                }
                .draft-card.active {
                    border-color: var(--accent-color) !important;
                    background: rgba(99, 102, 241, 0.05) !important;
                    border-bottom-left-radius: 0 !important;
                    border-bottom-right-radius: 0 !important;
                }
                .restore-trigger:hover {
                    background: rgba(16, 185, 129, 0.2) !important;
                    transform: scale(1.05);
                }
                .edit-trigger:hover {
                    background: rgba(59, 130, 246, 0.2) !important;
                    transform: scale(1.05);
                }
                .delete-trigger:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                }
                .draft-content-preview {
                    scrollbar-width: thin;
                    scrollbar-color: var(--accent-color) transparent;
                }
            `}</style>
        </div>
    );
};

export default PromptVersions;
