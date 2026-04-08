import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { API_URL, AGENT_API_KEY } from '../config';

const Sidebar = ({ onLogout }) => {
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [userData, setUserData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const userRole = localStorage.getItem('user_role') || 'Usuário';
    const isSuperAdmin = userRole === 'Super Admin';
    const isAdmin = userRole === 'Admin';
    const isUser = userRole === 'Usuário';

    const fetchUserData = async () => {
        try {
            const response = await fetch(`${API_URL}/users/me`, {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
                    'X-API-Key': AGENT_API_KEY
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUserData({ name: data.name || '', email: data.email || '', password: '' });
            }
        } catch (error) {
            console.error("Erro ao carregar dados do usuário:", error);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });
        try {
            const response = await fetch(`${API_URL}/users/me`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
                    'X-API-Key': AGENT_API_KEY
                },
                body: JSON.stringify(userData)
            });
            if (response.ok) {
                const updated = await response.json();
                if (updated && updated.name) {
                    localStorage.setItem('user_name', updated.name);
                }
                setStatus({ type: 'success', message: 'Perfil atualizado com sucesso!' });
                setTimeout(() => {
                    setShowSettingsModal(false);
                    setStatus({ type: '', message: '' });
                }, 1500);
            } else {
                const err = await response.json();
                setStatus({ type: 'error', message: err.detail || 'Erro ao atualizar.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Erro de conexão ou autenticação.' });
        } finally {
            setLoading(false);
        }
    };

    const openSettings = () => {
        setStatus({ type: '', message: '' });
        fetchUserData();
        setShowSettingsModal(true);
    };

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="logo-icon">🤖</div>
                    <span className="logo-text">Agent Flow</span>
                </div>

                <nav className="sidebar-nav">
                    {(isSuperAdmin || isAdmin || isUser) && (
                        <div className="nav-section">
                            <span className="nav-section-title">GERENCIAMENTO</span>
                            <NavLink
                                to="/"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">🤖</span>
                                <span className="nav-label">Meus Agentes</span>
                                <div className="active-indicator"></div>
                            </NavLink>
                            {(isSuperAdmin || isAdmin) && (
                                <>
                                    <NavLink
                                        to="/support"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">🎧</span>
                                        <span className="nav-label">Suporte Humano</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/knowledge-bases"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">📚</span>
                                        <span className="nav-label">Bases de Conhecimento</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/tools"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">🛠️</span>
                                        <span className="nav-label">Ferramentas (API)</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/financeiro"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">💰</span>
                                        <span className="nav-label">Financeiro</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/background-tasks"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">🕛</span>
                                        <span className="nav-label">Processamentos</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/integrations"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">🔌</span>
                                        <span className="nav-label">Integrações</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/performance/stress-test"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">⚡</span>
                                        <span className="nav-label">Teste de Estresse</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                    <NavLink
                                        to="/inbox"
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="nav-icon">📥</span>
                                        <span className="nav-label">Inbox (Falhas)</span>
                                        <div className="active-indicator"></div>
                                    </NavLink>
                                </>
                            )}
                        </div>
                    )}

                    {(isSuperAdmin || isAdmin) && (
                        <div className="nav-section">
                            <span className="nav-section-title">LABORATÓRIO</span>
                            <NavLink
                                to="/fine-tuning"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">🏭</span>
                                <span className="nav-label">Fine-Tuning</span>
                                <div className="active-indicator"></div>
                            </NavLink>
                        </div>
                    )}

                    {isSuperAdmin && (
                        <div className="nav-section">
                            <span className="nav-section-title">ADMINISTRAÇÃO</span>
                            <NavLink
                                to="/users"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">👥</span>
                                <span className="nav-label">Gestão de Usuários</span>
                                <div className="active-indicator"></div>
                            </NavLink>
                        </div>
                    )}

                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile-container">
                        <div className="user-profile">
                            <div className="user-avatar text-white">
                                {(localStorage.getItem('user_name') || 'A')[0]}
                            </div>
                            <div className="user-info">
                                <span className="user-name">{localStorage.getItem('user_name') || 'Usuário'}</span>
                                <span className="user-role">{localStorage.getItem('user_role') || 'Admin'}</span>
                            </div>
                        </div>
                        <button 
                            className="settings-sidebar-btn" 
                            onClick={openSettings}
                            title="Configurações de Perfil"
                        >
                            ⚙️
                        </button>
                    </div>
                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className="logout-btn-new"
                        title="Sair do sistema"
                    >
                        <span className="logout-btn-icon">🚪</span>
                        <span>Sair do Painel</span>
                    </button>
                </div>
            </aside>

            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <span className="modal-icon">⚙️</span>
                        <h2 className="modal-title">Configurações de Perfil</h2>
                        <p className="modal-message">Atualize seus dados de acesso ao Agent Flow.</p>
                        
                        <form onSubmit={handleUpdateUser} className="settings-form" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label>Nome Completo</label>
                                <input 
                                    type="text" 
                                    value={userData.name}
                                    onChange={e => setUserData({...userData, name: e.target.value})}
                                    placeholder="Seu nome"
                                    required
                                    autoComplete="name"
                                />
                            </div>

                            {!isSuperAdmin && (
                                <>
                                    <div className="form-group">
                                        <label>E-mail (Login)</label>
                                        <input 
                                            type="email" 
                                            value={userData.email}
                                            onChange={e => setUserData({...userData, email: e.target.value})}
                                            placeholder="seu@email.com"
                                            required
                                            autoComplete="username"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nova Senha (deixe em branco para manter)</label>
                                        <input 
                                            type="password" 
                                            value={userData.password}
                                            onChange={e => setUserData({...userData, password: e.target.value})}
                                            placeholder="Sua senha secreta"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </>
                            )}

                            {status.message && (
                                <div className={`status-message ${status.type}`} style={{ marginBottom: '1.5rem' }}>
                                    {status.message}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="modal-btn modal-btn-cancel"
                                    onClick={() => setShowSettingsModal(false)}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="modal-btn modal-btn-confirm"
                                    style={{ background: 'var(--primary-color)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
                                    disabled={loading}
                                >
                                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showLogoutModal && (
                <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <span className="modal-icon">👋</span>
                        <h2 className="modal-title">Até logo!</h2>
                        <p className="modal-message">
                            Você tem certeza que deseja encerrar sua sessão no painel do Agent Flow?
                        </p>
                        <div className="modal-actions">
                            <button
                                className="modal-btn modal-btn-cancel"
                                onClick={() => setShowLogoutModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="modal-btn modal-btn-confirm"
                                onClick={onLogout}
                            >
                                Sim, Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
