import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';
import ResetSuccessModal from './ResetSuccessModal';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, userId: null, userName: '' });
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showResetSuccess, setShowResetSuccess] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Usuário',
        status: 'ATIVO'
    });

    const userRole = localStorage.getItem('user_role') || 'Usuário';
    const isSuperAdmin = userRole === 'Super Admin';

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleResetSystem = async () => {
        try {
            setIsResetting(true);
            const response = await api.post('/system/reset-database');
            if (response.ok) {
                setShowResetConfirm(false); // Fecha o de confirmacao primeiro
                setShowResetSuccess(true);  // Abre o de sucesso bonito
            } else {
                alert("Erro ao resetar sistema. Verifique as permissões de rede.");
            }
        } catch (error) {
            console.error("Erro no reset:", error);
        } finally {
            setIsResetting(false);
            setShowResetConfirm(false);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                password: user.password,
                role: user.role,
                status: user.status
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'Usuário',
                status: 'ATIVO'
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = editingUser
                ? await api.put(`/users/${editingUser.id}`, formData)
                : await api.post('/users', formData);

            if (response.ok) {
                setShowModal(false);
                fetchUsers();
            } else {
                alert("Erro ao salvar usuário. Verifique se o e-mail já existe.");
            }
        } catch (error) {
            console.error("Erro ao salvar usuário:", error);
        }
    };

    const handleDeleteClick = (user) => {
        setConfirmDelete({
            isOpen: true,
            userId: user.id,
            userName: user.name
        });
    };

    const handleConfirmDelete = async () => {
        try {
            await api.delete(`/users/${confirmDelete.userId}`);
            setConfirmDelete({ isOpen: false, userId: null, userName: '' });
            fetchUsers();
        } catch (error) {
            console.error("Erro ao deletar usuário:", error);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="user-management">
            <header className="page-header">
                <div className="title-group">
                    <h1>Gestão de Usuários</h1>
                    {isSuperAdmin && (
                        <button
                            className="reset-system-btn"
                            onClick={() => setShowResetConfirm(true)}
                            title="Limpar todos os dados do banco"
                        >
                            <span className="icon">⚠️</span> Zerar Sistema
                        </button>
                    )}
                </div>
                <button className="add-user-btn" onClick={() => handleOpenModal()}>
                    <span className="icon">👤</span> + Novo Usuário
                </button>
            </header>

            <div className="filter-bar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="role-select"
                >
                    <option value="all">Todos os Cargos</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Usuário">Usuário</option>
                </select>
            </div>

            <div className="users-table-container card-premium">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>NOME / EMAIL</th>
                            <th>CARGO</th>
                            <th>STATUS</th>
                            <th className="text-right">AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Renderizar Super Admin Manual do .env primeiro */}
                        <tr className="user-row super-admin-row">
                            <td>
                                <div className="user-cell">
                                    <span className="user-name">Aryaraj</span>
                                    <span className="user-email">aryarajmarketing@gmail.com</span>
                                </div>
                            </td>
                            <td>
                                <span className="badge badge-super-admin">Super Admin</span>
                            </td>
                            <td>
                                <span className="status-indicator active">
                                    <span className="checkmark">✓</span> ATIVO
                                </span>
                            </td>
                            <td className="text-right">
                                {/* Sem ações para Super Admin do .env */}
                            </td>
                        </tr>

                        {loading ? (
                            <tr><td colSpan="4" className="text-center">Carregando usuários...</td></tr>
                        ) : filteredUsers.map(user => (
                            <tr key={user.id} className="user-row">
                                <td>
                                    <div className="user-cell">
                                        <span className="user-name">{user.name}</span>
                                        <span className="user-email">{user.email}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge badge-${(user.role || '').toLowerCase().replace(' ', '-')}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-indicator ${user.status === 'ATIVO' ? 'active' : 'inactive'}`}>
                                        <span className="checkmark">{user.status === 'ATIVO' ? '✓' : '○'}</span> {user.status}
                                    </span>
                                </td>
                                <td className="text-right">
                                    <div className="row-actions">
                                        <button className="action-btn edit" onClick={() => handleOpenModal(user)} title="Editar">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button className="action-btn delete" onClick={() => handleDeleteClick(user)} title="Excluir">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content user-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-refined">
                            <div className="modal-title-with-icon">
                                <div className="user-icon-circle">
                                    <span className="user-emoji">👤</span>
                                    <span className="plus-badge">+</span>
                                </div>
                                <h2 className="modal-title">{editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}</h2>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="user-form">
                            <div className="form-group">
                                <label>NOME COMPLETO</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: João Silva"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>EMAIL DAS BOAS-VINDAS</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="exemplo@email.com"
                                    required
                                    autoComplete="off"
                                />
                            </div>
                            <div className="form-group">
                                <label>SENHA INICIAL</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="........"
                                        required={!editingUser}
                                        autoComplete="new-password"
                                        style={{ paddingRight: '40px', width: '100%' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#94a3b8' }}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group half">
                                    <label>NÍVEL DE ACESSO (ROLE)</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="Usuário">Usuário (Acesso Limitado)</option>
                                        <option value="Admin">Admin (Controle Total)</option>
                                    </select>
                                </div>
                                <div className="form-group half">
                                    <label>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="ATIVO">Ativo</option>
                                        <option value="INATIVO">Inativo</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-btn modal-btn-cancel" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="modal-btn modal-btn-confirm">
                                    Salvar Usuário
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onCancel={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
                onConfirm={handleConfirmDelete}
                title="Excluir Usuário"
                message={`Tem certeza que deseja excluir o usuário "${confirmDelete.userName}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir Usuário"
                cancelText="Cancelar"
                type="danger"
            />

            <ConfirmModal
                isOpen={showResetConfirm}
                onCancel={() => setShowResetConfirm(false)}
                onConfirm={handleResetSystem}
                title="⚠️ ZERAR TODO O SISTEMA?"
                message="ESTA É UMA AÇÃO IRREVERSÍVEL! Todos os agentes, configurações de RAG, bases de conhecimento, logs de conversas e ferramentas serão EXCLUÍDOS PERMANENTEMENTE para deixar o projeto limpo. Apenas os usuários cadastrados serão mantidos. Deseja prosseguir?"
                confirmText={isResetting ? "Limpando..." : "Sim, Zerar Agora"}
                cancelText="Cancelar"
                type="danger"
            />

            <ResetSuccessModal
                isOpen={showResetSuccess}
                onClose={() => window.location.reload()}
            />
        </div>
    );
};

export default UserManagement;
