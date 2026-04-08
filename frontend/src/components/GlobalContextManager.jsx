import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';

const GlobalContextManager = () => {
    const [variables, setVariables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newVar, setNewVar] = useState({ key: '', value: '', type: 'string', description: '' });
    const [deleteVar, setDeleteVar] = useState(null);
    const [saving, setSaving] = useState(null); // ID of var being saved

    const fetchVariables = async () => {
        try {
            const res = await api.get(`/global-variables`);
            const data = await res.json();
            setVariables(data);
        } catch (e) {
            console.error("Erro ao buscar variáveis globais", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVariables();
    }, []);

    const handleUpdate = async (v) => {
        setSaving(v.id);
        try {
            await api.put(`/global-variables/${v.id}`, v);
            // Show some success feedback?
        } catch (e) {
            alert("Erro ao salvar variável");
        } finally {
            setSaving(null);
        }
    };

    const handleCreate = async () => {
        if (!newVar.key.trim()) return;
        try {
            const res = await api.post(`/global-variables`, newVar);
            if (res.ok) {
                setNewVar({ key: '', value: '', type: 'string', description: '' });
                setIsAdding(false);
                fetchVariables();
            } else {
                const data = await res.json();
                alert(data.detail || "Erro ao criar variável");
            }
        } catch (e) {
            alert("Erro de conexão");
        }
    };

    const handleDelete = async () => {
        if (!deleteVar) return;
        try {
            await api.delete(`/global-variables/${deleteVar.id}`);
            fetchVariables();
        } catch (e) {
            alert("Erro ao deletar");
        } finally {
            setDeleteVar(null);
        }
    };

    if (loading) return <div style={{ opacity: 0.5, padding: '1rem' }}>Carregando variáveis...</div>;

    return (
        <div className="global-context-card fade-in">
            <div className="card-header-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justify_content: 'center', fontSize: '1.5rem' }}>🌍</div>
                    <div>
                        <h3 style={{ margin: 0 }}>Variáveis de Contexto Globais</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            Disponíveis para todos os Agentes. Use &#123;key&#125; nos prompts.
                        </p>
                    </div>
                </div>
                <button className="add-var-btn" onClick={() => setIsAdding(true)}>+ Nova Variável</button>
            </div>

            <div className="vars-list">
                {variables.filter(v => !v.key.startsWith('PUBLIC_ACCESS_TOKEN_')).map(v => (
                    <div key={v.id} className="var-item">
                        <div className="var-main-info">
                            <div className="var-key-box">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <code className="var-key">{v.key}</code>
                                    {v.is_default && <span className="default-badge">Padrão</span>}
                                </div>
                                <select
                                    className="var-type-select"
                                    value={v.type || 'string'}
                                    onChange={e => {
                                        const updated = { ...v, type: e.target.value };
                                        setVariables(variables.map(item => item.id === v.id ? updated : item));
                                        handleUpdate(updated);
                                    }}
                                >
                                    <option value="string">abc Texto</option>
                                    <option value="number">123 Número</option>
                                    <option value="boolean">🔘 Booleano</option>
                                </select>
                            </div>
                            <input
                                placeholder="Valor da variável"
                                value={v.value || ''}
                                onChange={e => setVariables(variables.map(item => item.id === v.id ? { ...item, value: e.target.value } : item))}
                                onBlur={() => handleUpdate(v)}
                                className="var-input"
                            />
                        </div>
                        <div className="var-meta">
                            <input
                                placeholder="Descrição opcional..."
                                value={v.description || ''}
                                onChange={e => setVariables(variables.map(item => item.id === v.id ? { ...item, description: e.target.value } : item))}
                                onBlur={() => handleUpdate(v)}
                                className="var-desc-input"
                            />
                            <div className="var-actions">
                                {saving === v.id ? (
                                    <span className="saving-indicator">Salvando...</span>
                                ) : (
                                    !v.is_default && (
                                        <button className="var-del-btn" onClick={() => setDeleteVar(v)} title="Remover variável">🗑️</button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isAdding && ReactDOM.createPortal(
                <div className="add-var-overlay fade-in" onClick={() => setIsAdding(false)}>
                    <div className="add-var-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-accent"></div>
                        <div className="modal-content-padding">
                            <div className="modal-icon-top">🌍</div>
                            <h4>Criar Nova Variável Global</h4>
                            <p className="modal-subtitle">Defina uma chave que poderá ser usada em qualquer prompt do sistema.</p>

                            <div className="ft-edit-grid">
                                <div className="form-group-glow">
                                    <label>Nome (Chave)</label>
                                    <div className="input-wrapper-modern">
                                        <span className="input-icon">🔑</span>
                                        <input
                                            placeholder="ex: link_suporte"
                                            value={newVar.key}
                                            onChange={e => setNewVar({ ...newVar, key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                                        />
                                    </div>
                                    <small>Use letras, números e sublinhados.</small>
                                </div>
                                <div className="form-group-glow">
                                    <label>Valor Inicial</label>
                                    <div className="input-wrapper-modern">
                                        <span className="input-icon">📄</span>
                                        <input
                                            placeholder="ex: https://wa.me/..."
                                            value={newVar.value}
                                            onChange={e => setNewVar({ ...newVar, value: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group-glow">
                                    <label>Tipo da Variável</label>
                                    <div className="input-wrapper-modern">
                                        <span className="input-icon">⚙️</span>
                                        <select
                                            className="modal-type-select"
                                            value={newVar.type}
                                            onChange={e => setNewVar({ ...newVar, type: e.target.value })}
                                            style={{
                                                width: '100%', background: 'rgba(0, 0, 0, 0.2)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '14px', padding: '14px 14px 14px 44px',
                                                color: 'white', fontSize: '0.95rem', cursor: 'pointer',
                                                appearance: 'none', outline: 'none'
                                            }}
                                        >
                                            <option value="string">Texto (String)</option>
                                            <option value="number">Número (Number)</option>
                                            <option value="boolean">Lógico (Boolean)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group-glow">
                                    <label>Descrição (Opcional)</label>
                                    <div className="input-wrapper-modern">
                                        <span className="input-icon">💡</span>
                                        <input
                                            placeholder="Explique para que serve esta variável..."
                                            value={newVar.description}
                                            onChange={e => setNewVar({ ...newVar, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer-grid">
                            <button onClick={() => setIsAdding(false)} className="btn-modal-secondary">
                                Cancelar
                            </button>
                            <button onClick={handleCreate} className="btn-modal-primary" disabled={!newVar.key.trim()}>
                                Criar Variável
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ConfirmModal
                isOpen={!!deleteVar}
                title="Remover Variável"
                message={`Deseja realmente excluir "${deleteVar?.key}"?`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteVar(null)}
                confirmText="Excluir"
                type="danger"
            />

            <style>{`
                .global-context-card {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 1.5rem;
                    margin-bottom: 3rem;
                    backdrop-filter: blur(10px);
                }
                .card-header-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                .add-var-btn {
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    color: white;
                    border: none;
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
                }
                .add-var-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(99, 102, 241, 0.4);
                }
                .vars-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                    gap: 1rem;
                }
                .var-item {
                    background: rgba(30, 41, 59, 0.3);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 16px;
                    padding: 1.2rem;
                    transition: all 0.2s;
                }
                .var-item:hover {
                    background: rgba(30, 41, 59, 0.5);
                    border-color: rgba(99, 102, 241, 0.2);
                }
                .var-main-info {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 0.8rem;
                }
                .var-key-box {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .var-key {
                    background: rgba(99, 102, 241, 0.1);
                    padding: 4px 10px;
                    border-radius: 8px;
                    color: #818cf8;
                    font-weight: 700;
                    font-size: 0.85rem;
                    width: fit-content;
                    font-family: 'Fira Code', monospace;
                }
                .default-badge {
                    font-size: 0.6rem;
                    background: rgba(255,255,255,0.05);
                    color: #94a3b8;
                    padding: 2px 6px;
                    border-radius: 4px;
                    width: fit-content;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .var-input {
                    flex: 1.5;
                    background: #0f172a !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: white !important;
                    border-radius: 10px !important;
                    padding: 10px 14px !important;
                    font-size: 0.9rem !important;
                    outline: none !important;
                    transition: all 0.2s;
                }
                .var-input:focus {
                    border-color: #6366f1 !important;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.1) !important;
                }
                .var-meta {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                    border-top: 1px solid rgba(255,255,255,0.03);
                    padding-top: 0.8rem;
                }
                .var-desc-input {
                    flex: 1;
                    background: transparent !important;
                    border: none !important;
                    color: #64748b !important;
                    font-size: 0.8rem !important;
                    padding: 4px 0 !important;
                    outline: none !important;
                }
                .var-desc-input:hover {
                    color: #94a3b8 !important;
                }
                .var-del-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    opacity: 0.2;
                    transition: all 0.2s;
                    font-size: 1.1rem;
                }
                .var-del-btn:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }
                .saving-indicator {
                    font-size: 0.7rem;
                    color: #10b981;
                    font-style: italic;
                }

                .add-var-overlay {
                    position: fixed; inset: 0;
                    background: rgba(7, 10, 19, 0.85); backdrop-filter: blur(12px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 10000000; padding: 20px;
                }
                .add-var-modal {
                    background: #111827; border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 32px; width: 100%; max-width: 480px;
                    max-height: 90vh; display: flex; flex-direction: column;
                    box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.9);
                    overflow: hidden; position: relative;
                    animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .modal-header-accent {
                    height: 6px; background: linear-gradient(90deg, #6366f1, #a855f7);
                }
                .modal-content-padding { 
                    padding: 40px 32px 32px; 
                    overflow-y: auto;
                    flex: 1;
                }
                .ft-edit-grid { display: flex; flex-direction: column; gap: 8px; }
                .modal-icon-top {
                    width: 60px; height: 60px; background: rgba(99, 102, 241, 0.1);
                    border-radius: 18px; display: flex; align-items: center; justify-content: center;
                    font-size: 1.8rem; margin-bottom: 24px; color: #818cf8;
                }
                .add-var-modal h4 {
                    font-size: 1.5rem; color: white; margin: 0 0 8px 0; font-weight: 800;
                }
                .modal-subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 32px; line-height: 1.5; }
                
                .form-group-glow { margin-bottom: 20px; }
                .form-group-glow label {
                    display: block; color: #cbd5e1; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;
                }
                .input-wrapper-modern {
                    position: relative; display: flex; align-items: center;
                }
                .input-icon {
                    position: absolute; left: 16px; opacity: 0.5; font-size: 1rem;
                }
                .form-group-glow input {
                    width: 100%; background: rgba(0, 0, 0, 0.2) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    border-radius: 14px !important; padding: 14px 14px 14px 44px !important;
                    color: white !important; font-size: 0.95rem !important; transition: all 0.3s;
                }
                .form-group-glow input:focus {
                    border-color: #6366f1 !important; background: rgba(0,0,0,0.4) !important;
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.1) !important;
                }
                .form-group-glow small { color: #64748b; font-size: 0.75rem; margin-top: 6px; display: block; }

                .modal-footer-grid {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
                    background: rgba(255,255,255,0.05); border-top: 1px solid rgba(255,255,255,0.05);
                }
                .btn-modal-primary, .btn-modal-secondary {
                    border: none; padding: 20px; font-size: 0.95rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s; background: #111827;
                }
                .btn-modal-secondary { color: #64748b; }
                .btn-modal-secondary:hover { background: rgba(255,255,255,0.02); color: white; }
                .btn-modal-primary { color: #818cf8; }
                .btn-modal-primary:hover { background: #6366f1; color: white; }
                .btn-modal-primary:disabled { opacity: 0.3; cursor: not-allowed; }

                .var-type-select {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 6px;
                    color: #94a3b8;
                    font-size: 0.65rem;
                    padding: 2px 4px;
                    width: fit-content;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s;
                }
                .var-type-select:hover {
                    border-color: rgba(99,102,241,0.3);
                    color: #cbd5e1;
                }
                .modal-type-select option {
                    background: #111827;
                    color: white;
                }
                @keyframes modalPop { 
                    from { opacity: 0; transform: scale(0.9) translateY(20px); } 
                    to { opacity: 1; transform: scale(1) translateY(0); } 
                }
            `}</style>
        </div>
    );
};

export default GlobalContextManager;
