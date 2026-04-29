import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import { api } from '../api/client';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import ExpandableField from './ExpandableField';

function KnowledgeBaseEditor() {
    const { id } = useParams();
    const location = useLocation();
    const isNew = id === 'new';
    const navigate = useNavigate();
    
    // Pegar a view desejada via query param (?view=metadata ou ?view=content)
    const searchParams = new URLSearchParams(location.search);
    const initialView = searchParams.get('view') || (isNew ? 'metadata' : 'content');
    const [view, setView] = useState(initialView);

    const [name, setName] = useState(isNew ? 'Nova Base de Conhecimento' : '');
    const [description, setDescription] = useState('');
    const [kbType, setKbType] = useState('qa'); // 'qa' or 'product'
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(!isNew);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (!isNew) {
            api.get(`/knowledge-bases/${id}`)
                .then(res => res.json())
                .then(data => {
                    setName(data.name);
                    setDescription(data.description || '');
                    setKbType(data.kb_type || 'qa');
                    setItems(data.items || []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Erro ao carregar base:", err);
                    setLoading(false);
                });
        }
    }, [id, isNew]);

    // Atualiza a visualização se o parâmetro mudar
    useEffect(() => {
        const v = searchParams.get('view');
        if (v) setView(v);
    }, [location.search]);

    // Clear status toast after some time
    useEffect(() => {
        if (status && status.type !== 'info') {
            const timer = setTimeout(() => {
                setStatus(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const handleSave = async () => {
        if (!name.trim()) {
            setStatus({ type: 'error', message: 'O nome da base é obrigatório.' });
            return;
        }

        setStatus({ type: 'info', message: 'Salvando...' });
        const payload = {
            name: name.trim(),
            description,
            kb_type: kbType
        };

        try {
            const url = isNew ? `/knowledge-bases` : `/knowledge-bases/${id}`;
            const response = await (isNew ? api.post(url, payload) : api.put(url, payload));

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', message: 'Dados da base salvos com sucesso!' });
                if (isNew) {
                    setTimeout(() => navigate(`/knowledge-bases/${data.id}?view=content`), 800);
                }
            } else {
                const errorMsg = data.detail || 'Erro ao salvar base.';
                setStatus({ type: 'error', message: errorMsg });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Erro de conexão com o servidor.' });
        }
    };

    const handleAddItem = async (question, answer, category, metadata) => {
        if (isNew) return;

        const response = await api.post(`/knowledge-bases/${id}/items`, { question, answer, category, metadata });

        if (response.ok) {
            const newItem = await response.json();
            setItems([...items, newItem]);
        }
    };

    const handleDeleteItem = async (itemId) => {
        const response = await api.delete(`/knowledge-items/${itemId}`);
        if (response.ok) {
            setItems(items.filter(i => i.id !== itemId));
        }
    };

    const handleUpdateItem = async (itemId, question, answer, category, metadata) => {
        const response = await api.put(`/knowledge-items/${itemId}`, { question, answer, category, metadata });
        if (response.ok) {
            const updated = await response.json();
            setItems(items.map(i => i.id === itemId ? updated : i));
        }
    };

    if (loading) return <div className="loading">Carregando base...</div>;

    return (
        <div className="dashboard-container">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to="/knowledge-bases" className="access-btn-back">
                    <span style={{ fontSize: '1.2rem' }}>‹</span> Voltar para lista
                </Link>
                
                {!isNew && (
                    <div className="view-selector" style={{ 
                        display: 'flex', 
                        gap: '5px', 
                        background: 'rgba(255,255,255,0.03)', 
                        padding: '5px', 
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <button 
                            onClick={() => navigate(`?view=metadata`)}
                            className={`tab-btn ${view === 'metadata' ? 'active' : ''}`}
                            style={viewTabStyle(view === 'metadata')}
                        >
                            ⚙️ Identificação
                        </button>
                        <button 
                            onClick={() => navigate(`?view=content`)}
                            className={`tab-btn ${view === 'content' ? 'active' : ''}`}
                            style={viewTabStyle(view === 'content')}
                        >
                            📚 Conteúdo
                        </button>
                    </div>
                )}
            </div>

            <h1 className="panel-title" style={{
                fontSize: '2.5rem',
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
            }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)',
                    flexShrink: 0
                }}>
                    <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                        {view === 'metadata' ? '⚙️' : '📚'}
                    </span>
                </div>
                <span>{isNew ? 'Nova Base de Conhecimento' : (view === 'metadata' ? 'Configurar Identificação' : 'Gerenciar Conteúdo')}</span>
            </h1>

            <div className="editor-layout" style={{ 
                display: 'grid', 
                gridTemplateColumns: view === 'metadata' ? '1fr 340px' : '1fr', 
                gap: '2.5rem',
                alignItems: 'start'
            }}>
                {/* Visualização de Identificação (Metadata) */}
                {view === 'metadata' && (
                    <>
                        <div className="step-card" style={{ width: '100%', margin: 0 }}>
                            <div className="step-indicator">
                                <div className="step-number">1</div>
                                <span className="step-title">Identificação da Base</span>
                            </div>

                            <div className="form-group">
                                <label>Nome da Base</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: FAQ de Vendas"
                                    style={{ fontSize: '1.1rem', padding: '15px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Tipo de Base</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                                    <button
                                        onClick={() => isNew && setKbType('qa')}
                                        className={`type-select-btn ${kbType === 'qa' ? 'active' : ''} ${!isNew ? 'disabled' : ''}`}
                                        style={typeBtnStyle(kbType === 'qa', '#6366f1', !isNew)}
                                        disabled={!isNew}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                                            <span style={{ fontSize: '1.4rem', opacity: kbType === 'qa' ? 1 : 0.5 }}>💬</span>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>FAQ / QA</div>
                                                <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 500 }}>Respostas Diretas</div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => isNew && setKbType('product')}
                                        className={`type-select-btn ${kbType === 'product' ? 'active' : ''} ${!isNew ? 'disabled' : ''}`}
                                        style={typeBtnStyle(kbType === 'product', '#a855f7', !isNew)}
                                        disabled={!isNew}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                                            <span style={{ fontSize: '1.4rem', opacity: kbType === 'product' ? 1 : 0.5 }}>📦</span>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Produtos</div>
                                                <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 500 }}>Catálogo Técnico</div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                                {!isNew && (
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span>ℹ️</span> O tipo da base não pode ser alterado após a criação.
                                    </p>
                                )}
                            </div>

                            <div className="form-group">
                                <ExpandableField
                                    label="Descrição Opcional"
                                    type="textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Sobre o que é este conhecimento? Descreva para que os agentes entendam o contexto."
                                    style={{ minHeight: '160px' }}
                                />
                            </div>

                            <button onClick={handleSave} className="create-agent-btn" style={{ width: '100%', marginTop: '1.5rem', padding: '1.2rem' }}>
                                {isNew ? 'Criar e Ir para Conteúdo →' : 'Salvar Alterações de Identificação'}
                            </button>
                        </div>

                        {/* Coluna da Direita: Dicas e Stats */}
                        <div className="side-panel">
                            {!isNew && (
                                <div className="step-card" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.1)' }}>
                                    <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        📊 Status da Base
                                    </h4>
                                    <div className="kb-stat" style={{ margin: 0, padding: '1rem' }}>
                                        <span className="kb-stat-value" style={{ fontSize: '2rem' }}>{items.length}</span>
                                        <span className="kb-stat-label">Itens indexados</span>
                                    </div>
                                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Esta base está ativa e pronta para ser consultada pelos seus robôs.
                                    </div>
                                </div>
                            )}

                            <div className="step-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                                <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    💡 Dicas de Configuração
                                </h4>
                                <ul style={{ 
                                    paddingLeft: '1.2rem', 
                                    color: 'var(--text-secondary)', 
                                    fontSize: '0.85rem', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '12px' 
                                }}>
                                    <li><strong>Nome Claro:</strong> Use nomes que identifiquem facilmente o conteúdo (ex: <i>Menu Pizzaria</i>).</li>
                                    <li><strong>Descrição RAG:</strong> A descrição ajuda o algoritmo a entender quando buscar informações nesta base.</li>
                                    <li><strong>Tipo FAQ:</strong> Ideal para respostas diretas a perguntas comuns.</li>
                                    <li><strong>Tipo Produtos:</strong> Melhor para descrições técnicas, preços e estoque.</li>
                                </ul>
                            </div>
                        </div>
                    </>
                )}

                {/* Visualização de Conteúdo */}
                {view === 'content' && !isNew && (
                    <div className="content-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
                        <div className="step-indicator">
                            <div className="step-number">2</div>
                            <span className="step-title">Biblioteca de Itens</span>
                        </div>
                        <KnowledgeBaseManager
                            kbId={id}
                            knowledgeBase={items}
                            onAdd={handleAddItem}
                            onDelete={handleDeleteItem}
                            onUpdate={handleUpdateItem}
                            collapsible={false}
                            kbType={kbType}
                        />
                    </div>
                )}
            </div>

            {status && (
                <div className={`save-status-toast status-message ${status.type}`} onClick={() => setStatus(null)}>
                    {status.message}
                </div>
            )}

            <style>{`
                .type-select-btn {
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(255,255,255,0.02);
                    color: #94a3b8;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: center;
                }
                .type-select-btn:hover {
                    background: rgba(255,255,255,0.05);
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}

const typeBtnStyle = (isActive, activeColor, isDisabled = false) => ({
    background: isActive ? `${activeColor}15` : 'rgba(255,255,255,0.02)',
    borderColor: isActive ? activeColor : 'rgba(255,255,255,0.05)',
    color: isActive ? activeColor : '#94a3b8',
    boxShadow: isActive ? `0 0 20px -5px ${activeColor}30` : 'none',
    transform: isActive ? 'scale(1.02)' : 'none',
    opacity: isDisabled && !isActive ? 0.3 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer'
});

const viewTabStyle = (isActive) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
    color: isActive ? '#818cf8' : '#64748b',
    transition: 'all 0.3s'
});

export default KnowledgeBaseEditor;
