
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';

function AgentCard({ agent, kbList, onDelete, onDuplicate, onPause, onShare }) {
    const navigate = useNavigate();
    const userRole = localStorage.getItem('user_role') || 'Usuário';
    const isUser = userRole === 'Usuário';

    return (
        <div className={`modern-agent-card ${!agent.is_active ? 'inactive' : ''}`}>
            <div className="card-header">
                <div
                    className={`status-indicator ${agent.is_active ? 'active' : 'paused'}`}
                    title={agent.is_active ? 'Online' : 'Pausado'}
                ></div>
                {!isUser && (
                    <div className="card-actions-top">
                        <button onClick={(e) => {
                            e.stopPropagation();
                            const shareUrl = `${window.location.origin}/chat/${agent.id}`;
                            navigator.clipboard.writeText(shareUrl)
                                .then(() => onShare('Link copiado com sucesso!', 'success'))
                                .catch(() => onShare('Erro ao copiar link.', 'error'));
                        }} title="Compartilhar Link Público">🔗</button>
                        <button onClick={() => onDuplicate(agent)} title="Duplicar">📑</button>
                        <button onClick={() => onPause(agent)} title={agent.is_active ? 'Pausar' : 'Ativar'}>
                            {agent.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button onClick={(e) => onDelete(e, agent.id, agent.name)} title="Excluir" className="delete-action">🗑️</button>
                    </div>
                )}
            </div>

            <div className="card-body">
                <h3>{agent.name} {!agent.is_active && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>(PAUSADO)</span>}</h3>
                <p className="description">{agent.description || "Sem descrição definida."}</p>

                <div className="tech-stack">
                    <span className="tech-badge model">
                        {agent.router_enabled && agent.router_complex_model
                            ? agent.router_complex_model
                            : agent.model}
                    </span>
                    {agent.knowledge_base_id && (
                        <span className="tech-badge kb">
                            📚 {kbList.find(kb => kb.id === agent.knowledge_base_id)?.name || 'Base Conectada'}
                        </span>
                    )}
                </div>
            </div>

            <div className={`card-footer ${isUser ? 'user-view' : ''}`}>
                {!isUser && (
                    <button onClick={() => navigate(`/agent/${agent.id}`)} className="btn-primary">
                        ⚙️ Configurar
                    </button>
                )}
                <button
                    disabled={!agent.is_active}
                    onClick={() => navigate(`/playground?agentId=${agent.id}`)}
                    className="btn-secondary"
                    style={{
                        opacity: agent.is_active ? 1 : 0.5,
                        gridColumn: isUser ? '1 / span 2' : 'auto'
                    }}
                >
                    💬 Chat
                </button>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, gradient }) {
    return (
        <div className="stat-card" style={{ background: gradient }}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-info">
                <span className="stat-value">{value}</span>
                <span className="stat-title">{title}</span>
            </div>
        </div>
    );
}

import GlobalContextManager from './GlobalContextManager';

function Dashboard() {
    // ... rest of state ...
    const [agents, setAgents] = useState([]);
    const [filteredAgents, setFilteredAgents] = useState([]);
    const [kbList, setKbList] = useState([]);
    const [stats, setStats] = useState({ total_agents: 0, total_knowledge_bases: 0, total_interactions: 0, total_cost: 0.0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, agentId: null, agentName: '', type: 'delete' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const refreshStats = async () => {
        try {
            const res = await api.get('/dashboard/stats');
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error("Erro ao atualizar stats", e);
        }
    };

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [modelFilter, setModelFilter] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [resAgents, resKBs] = await Promise.all([
                api.get('/agents'),
                api.get('/knowledge-bases')
            ]);

            if (!resAgents.ok || !resKBs.ok) {
                throw new Error("Não foi possível carregar os dados do servidor. O serviço pode estar reiniciando.");
            }

            const agentsData = await resAgents.json();
            const kbsData = await resKBs.json();

            if (!Array.isArray(agentsData)) {
                throw new Error("Formato de dados de agentes inválido recebido.");
            }

            setAgents(agentsData);
            setFilteredAgents(agentsData);
            setKbList(kbsData || []);
            refreshStats();
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
            setError(err.message || "Erro de conexão ao carregar agentes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        let result = agents;
        if (searchTerm) {
            result = result.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (modelFilter) {
            result = result.filter(a => a.model === modelFilter);
        }
        setFilteredAgents(result);
    }, [searchTerm, modelFilter, agents]);

    const handleDeleteClick = (e, id, name) => {
        e.preventDefault();
        setConfirmConfig({ isOpen: true, agentId: id, agentName: name, type: 'delete' });
    };

    const handleDuplicateClick = (agent) => {
        setConfirmConfig({ isOpen: true, agentId: agent.id, agentName: agent.name, type: 'duplicate' });
    };

    const handleConfirmAction = () => {
        const { agentId, type } = confirmConfig;

        if (type === 'delete') {
            api.delete(`/agents/${agentId}`)
                .then(res => {
                    if (res.ok) {
                        setAgents(prev => prev.filter(a => a.id !== agentId));
                        showToast('Agente excluído com sucesso!', 'success');
                        refreshStats();
                    } else {
                        showToast('Erro ao excluir agente', 'error');
                    }
                })
                .catch(err => showToast('Erro de conexão ao excluir', 'error'))
                .finally(() => setConfirmConfig({ isOpen: false, agentId: null, agentName: '', type: 'delete' }));
        } else {
            // Duplicate
            api.post(`/agents/${agentId}/duplicate`)
                .then(res => res.json())
                .then(created => {
                    setAgents(prev => [...prev, created]);
                    refreshStats();
                })
                .catch(err => console.error("Erro ao duplicar", err))
                .finally(() => setConfirmConfig({ isOpen: false, agentId: null, agentName: '', type: 'duplicate' }));
        }
    };

    const handlePause = async (agent) => {
        try {
            const res = await api.post(`/agents/${agent.id}/toggle`);
            const updated = await res.json();
            setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
            refreshStats();
        } catch (e) {
            console.error("Erro ao pausar", e);
        }
    };

    if (loading) return <div className="loading-screen">Carregando seu painel de controle...</div>;

    const uniqueModels = [...new Set(agents.map(a => a.model))];

    const userRole = localStorage.getItem('user_role') || 'Usuário';
    const isUser = userRole === 'Usuário';
    const currentName = localStorage.getItem('user_name') || 'Usuário';

    return (
        <div className="modern-dashboard">
            <header className="dashboard-header-flex">
                <div>
                    <h1>Olá, {currentName} 👋</h1>
                    <p className="subtitle">Gerencie sua frota de agentes inteligentes</p>
                </div>
                {!isUser && (
                    <Link to="/agent/new" className="create-agent-btn-shiny">
                        + Novo Agente
                    </Link>
                )}
            </header>

            {!isUser && (
                <>
                    {/* KPI Stats Row */}
                    <div className="stats-row fade-in">
                        <StatCard
                            title="Agentes Ativos"
                            value={stats.total_agents}
                            icon="🤖"
                            gradient="linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))"
                        />
                        <StatCard
                            title="Bases Conhecimento"
                            value={stats.total_knowledge_bases}
                            icon="📚"
                            gradient="linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))"
                        />
                        <StatCard
                            title="Total Interações"
                            value={stats.total_interactions}
                            icon="💬"
                            gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))"
                        />
                        <StatCard
                            title="Custo Estimado"
                            value={`R$ ${stats.total_cost.toFixed(2)}`}
                            icon="💰"
                            gradient="linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))"
                        />
                    </div>

                    <GlobalContextManager />
                </>
            )}

            {/* Filters & Search */}
            <div className="filter-bar fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="search-wrapper">
                    <svg className="search-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar agente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="">Todos os Modelos</option>
                    {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button
                    className="refresh-btn-dashboard"
                    onClick={fetchData}
                    title="Recarregar agentes"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '0 15px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    🔄
                </button>
            </div>

            {/* Agents Grid */}
            <div className="agents-grid-responsive fade-in" style={{ animationDelay: '0.2s' }}>
                {error ? (
                    <div className="empty-state-modern error-state">
                        <span style={{ fontSize: '3rem' }}>⚠️</span>
                        <h3>Ops! Algo deu errado</h3>
                        <p>{error}</p>
                        <button onClick={fetchData} className="create-agent-btn-shiny" style={{ marginTop: '1rem', border: 'none', cursor: 'pointer' }}>
                            Tentar Novamente
                        </button>
                    </div>
                ) : filteredAgents.length === 0 ? (
                    <div className="empty-state-modern">
                        <span style={{ fontSize: '3rem', opacity: 0.5 }}>🤷‍♂️</span>
                        <h3>Nenhum agente encontrado</h3>
                        <p>Tente ajustar seus filtros ou crie um novo agente.</p>
                    </div>
                ) : (
                    filteredAgents.map(agent => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            kbList={kbList}
                            onShare={showToast}
                            onDelete={handleDeleteClick}
                            onDuplicate={handleDuplicateClick}
                            onPause={handlePause}
                        />
                    ))
                )}
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                onConfirm={handleConfirmAction}
                title={confirmConfig.type === 'delete' ? 'Excluir Agente' : 'Duplicar Agente'}
                message={confirmConfig.type === 'delete'
                    ? `Tem certeza que deseja excluir o agente "${confirmConfig.agentName}"? Esta ação não pode ser desfeita.`
                    : `Deseja criar uma cópia do agente "${confirmConfig.agentName}"?`}
                confirmText={confirmConfig.type === 'delete' ? 'Excluir Definitivamente' : 'Duplicar'}
                cancelText="Cancelar"
                type={confirmConfig.type === 'delete' ? 'danger' : 'primary'}
            />

            <style>{`
                .modern-dashboard {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .dashboard-header-flex {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2.5rem;
                }
                .dashboard-header-flex h1 {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .subtitle {
                    color: #64748b;
                    font-size: 1rem;
                }
                
                /* Stats Row */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }
                .stat-card {
                    padding: 1.5rem;
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: transform 0.3s;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                }
                .stat-icon {
                    font-size: 2rem;
                    background: rgba(255,255,255,0.05);
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .stat-info {
                    display: flex;
                    flex-direction: column;
                }
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #fff;
                }
                .stat-title {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                /* Filter Bar */
                .filter-bar {
                    display: flex;
                    gap: 1.5rem;
                    margin-bottom: 2.5rem;
                    align-items: center;
                }
                .search-wrapper {
                    flex: 2;
                    display: flex;
                    align-items: center;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    border-radius: 12px;
                    padding: 0 1.2rem;
                    transition: all 0.3s;
                    height: 50px;
                }
                .search-wrapper:focus-within {
                    border-color: #6366f1;
                    background: rgba(15, 23, 42, 0.7);
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
                }
                .search-icon-svg {
                    margin-right: 0.8rem;
                    opacity: 0.4;
                    color: white;
                }
                .search-wrapper input {
                    background: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    color: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100%;
                    outline: none !important;
                    font-size: 1rem;
                    height: 100%;
                }
                .search-wrapper input::placeholder {
                    color: rgba(255,255,255,0.3);
                }
                .search-wrapper input:focus {
                    background: none !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .filter-select {
                    flex: 1;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 0 1.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    outline: none;
                    height: 50px; /* Match height */
                    font-size: 0.95rem;
                }

                /* Responsive Grid */
                .agents-grid-responsive {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                /* Modern Agent Card */
                .modern-agent-card {
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                    backdrop-filter: blur(10px);
                }
                .modern-agent-card:hover {
                    transform: translateY(-5px);
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
                }
                .modern-agent-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 4px;
                    background: linear-gradient(90deg, #6366f1, #a855f7);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .modern-agent-card:hover::before {
                    opacity: 1;
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .status-indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .status-indicator.active {
                    background: #10b981;
                    box-shadow: 0 0 10px #10b981;
                }
                .status-indicator.paused {
                    background: #f59e0b;
                    box-shadow: 0 0 10px #f59e0b;
                }
                .modern-agent-card.inactive {
                    background: rgba(30, 41, 59, 0.2);
                    filter: grayscale(0.5);
                    border-color: rgba(255, 255, 255, 0.02);
                }
                .modern-agent-card.inactive h3 {
                    opacity: 0.6;
                }
                .card-actions-top {
                    display: flex;
                    gap: 0.5rem;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .modern-agent-card:hover .card-actions-top {
                    opacity: 1;
                }
                .card-actions-top button {
                    background: rgba(255,255,255,0.05);
                    border: none;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 6px;
                    color: #cbd5e1;
                    transition: all 0.2s;
                }
                .card-actions-top button:hover {
                    background: rgba(255,255,255,0.15);
                    color: white;
                }
                .delete-action:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ef4444 !important;
                }

                .card-body h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.25rem;
                }
                .description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    min-height: 2.7rem;
                }

                .tech-stack {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }
                .tech-badge {
                    font-size: 0.75rem;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-weight: 500;
                }
                .tech-badge.model {
                    background: rgba(99, 102, 241, 0.1);
                    color: #818cf8;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }
                .tech-badge.kb {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .card-footer {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: auto;
                }
                .card-footer button {
                    padding: 0.8rem;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: #6366f1;
                    color: white;
                }
                .btn-primary:hover {
                    background: #4f46e5;
                }
                .btn-secondary {
                    background: rgba(255,255,255,0.05);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                }
                .btn-secondary:hover {
                    background: rgba(255,255,255,0.1);
                }

                .create-agent-btn-shiny {
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    color: white;
                    padding: 0.8rem 1.5rem;
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                    transition: all 0.3s;
                }
                .create-agent-btn-shiny:hover {
                    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
                    transform: translateY(-2px);
                }

                .loading-screen {
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: #64748b;
                }
                .empty-state-modern {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 4rem;
                    background: rgba(255,255,255,0.02);
                    border-radius: 20px;
                    border: 2px dashed rgba(255,255,255,0.1);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                }

                .toast-notification {
                    position: fixed;
                    bottom: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(30, 41, 59, 0.95);
                    backdrop-filter: blur(12px);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 50px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
                    z-index: 10000;
                    border: 1px solid rgba(255,255,255,0.05);
                    animation: toastSlideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
                }
                .toast-notification.success { border-color: rgba(16, 185, 129, 0.5); border-left: 4px solid #10b981; }
                .toast-notification.error { border-color: rgba(239, 68, 68, 0.5); border-left: 4px solid #ef4444; }
                .toast-icon { font-size: 1.2rem; }
                .toast-message { font-size: 0.9rem; font-weight: 600; }

                @keyframes toastSlideIn {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>

            {toast.show && (
                <div className={`toast-notification ${toast.type}`}>
                    <span className="toast-icon">
                        {toast.type === 'success' ? '✅' : '❌'}
                    </span>
                    <span className="toast-message">{toast.message}</span>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
