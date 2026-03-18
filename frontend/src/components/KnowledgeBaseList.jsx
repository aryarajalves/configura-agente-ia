import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';
import UnansweredQuestions from './UnansweredQuestions';

function KnowledgeBaseList() {
    const [bases, setBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, baseId: null, baseName: '' });
    const [activeTab, setActiveTab] = useState('bases');
    const [filterType, setFilterType] = useState('all'); // 'all', 'qa', 'product'

    useEffect(() => {
        api.get('/knowledge-bases')
            .then(res => res.json())
            .then(data => {
                setBases(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Erro ao buscar bases:", err);
                setLoading(false);
            });
    }, []);

    const handleDeleteClick = (e, id, name) => {
        e.preventDefault();
        setModalConfig({ isOpen: true, baseId: id, baseName: name });
    };

    const handleConfirmDelete = () => {
        const { baseId } = modalConfig;
        setIsDeleting(true);
        api.delete(`/knowledge-bases/${baseId}`)
            .then(res => {
                if (res.ok) {
                    setBases(bases.filter(b => b.id !== baseId));
                } else {
                    alert('Erro ao excluir');
                }
            })
            .catch(err => alert('Erro de conexão'))
            .finally(() => {
                setIsDeleting(false);
                setModalConfig({ isOpen: false, baseId: null, baseName: '' });
            });
    };

    const filteredBases = bases.filter(base => {
        if (filterType === 'all') return true;
        if (filterType === 'qa') return base.kb_type === 'qa';
        if (filterType === 'product') return base.kb_type === 'product';
        return true;
    });

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Centrais de Conhecimento</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Gerencie bibliotecas de respostas e ensine seus agentes.
                    </p>
                </div>
                {activeTab === 'bases' && (
                    <Link to="/knowledge-bases/new" className="create-agent-btn">
                        + Nova Base
                    </Link>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div className="tab-control" style={{
                    display: 'flex',
                    gap: '1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    paddingBottom: '0.5rem'
                }}>
                    <button
                        onClick={() => setActiveTab('bases')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'bases' ? 'white' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'bases' ? 800 : 500,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'bases' ? '2px solid #6366f1' : 'none',
                            paddingBottom: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        📚 Minhas Bases
                    </button>
                    <button
                        onClick={() => setActiveTab('inbox')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'inbox' ? 'white' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'inbox' ? 800 : 500,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'inbox' ? '2px solid #6366f1' : 'none',
                            paddingBottom: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        📥 Inbox de Dúvidas
                    </button>
                </div>

                {activeTab === 'bases' && (
                    <div className="filter-controls" style={{
                        display: 'flex',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '4px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        {[
                            { id: 'all', label: 'Tudo', icon: '🌈' },
                            { id: 'qa', label: 'FAQ', icon: '💬' },
                            { id: 'product', label: 'Produtos', icon: '📦' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilterType(f.id)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: filterType === f.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    color: filterType === f.id ? '#818cf8' : '#64748b',
                                    boxShadow: filterType === f.id ? '0 4px 12px rgba(99, 102, 241, 0.1)' : 'none'
                                }}
                            >
                                <span style={{ opacity: filterType === f.id ? 1 : 0.6 }}>{f.icon}</span>
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeTab === 'bases' ? (
                loading ? (
                    <div className="loading">Carregando bases...</div>
                ) : (
                    <div className="agents-grid">
                        {filteredBases.length === 0 ? (
                            <div className="empty-state" style={{
                                gridColumn: '1/-1',
                                padding: '6rem 2rem',
                                textAlign: 'center',
                                background: 'var(--card-bg)',
                                borderRadius: '2rem',
                                border: '1px dashed var(--border-color)'
                            }}>
                                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem', opacity: 0.3 }}>📂</span>
                                <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>Nenhuma base encontrada</h2>
                                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                                    {filterType === 'all'
                                        ? "Crie sua primeira biblioteca de conhecimento para começar a treinar seus agentes de IA."
                                        : `Você ainda não possui bases do tipo ${filterType === 'qa' ? 'FAQ' : 'Produtos'}.`}
                                </p>
                                {filterType === 'all' && (
                                    <Link to="/knowledge-bases/new" className="create-agent-btn" style={{ marginTop: '2rem' }}>
                                        + Criar Minha Primeira Base
                                    </Link>
                                )}
                            </div>
                        ) : (
                            filteredBases.map(base => (
                                <div key={base.id} className="agent-card">
                                    <div className="agent-card-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{base.kb_type === 'product' ? '📦' : '💬'}</span>
                                            <h3>{base.name}</h3>
                                        </div>
                                        <span className="agent-model-badge">
                                            KB #{base.id}
                                        </span>
                                    </div>
                                    <p className="agent-description">
                                        {base.description || "Sem descrição definida para esta base de conhecimento."}
                                    </p>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            background: base.kb_type === 'product' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                            color: base.kb_type === 'product' ? '#a855f7' : '#6366f1',
                                            fontWeight: 800,
                                            textTransform: 'uppercase'
                                        }}>
                                            {base.kb_type === 'product' ? 'Catálogo' : 'FAQ / QA'}
                                        </span>
                                    </div>

                                    <div className="kb-stat">
                                        <span className="kb-stat-value">{base.items?.length || 0}</span>
                                        <span className="kb-stat-label">Itens de Conhecimento</span>
                                    </div>

                                    <div className="agent-actions">
                                        <Link to={`/knowledge-bases/${base.id}?view=content`} className="access-btn">
                                            Editar Conteúdo
                                        </Link>
                                        <Link 
                                            to={`/knowledge-bases/${base.id}?view=metadata`} 
                                            className="delete-btn" 
                                            style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
                                            title="Configurações da Base"
                                        >
                                            ⚙️
                                        </Link>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, base.id, base.name)}
                                            className="delete-btn"
                                            title="Excluir Base"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )
            ) : (
                <UnansweredQuestions />
            )}

            <ConfirmModal
                isOpen={modalConfig.isOpen}
                title="Excluir Base"
                message={`Deseja realmente excluir a base "${modalConfig.baseName}"? Todos os agentes vinculados a ela perderão este conhecimento.`}
                onConfirm={handleConfirmDelete}
                onCancel={() => setModalConfig({ isOpen: false, baseId: null, baseName: '' })}
                confirmText="Excluir"
                cancelText="Cancelar"
                type="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}

export default KnowledgeBaseList;
