import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const UnansweredQuestions = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState(null); // 'answer' | 'discard' | null
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [editingQuestionText, setEditingQuestionText] = useState(''); // Nova funcionalidade: editar pergunta
    const [kbList, setKbList] = useState([]);
    const [selectedKbId, setSelectedKbId] = useState('');
    const [saving, setSaving] = useState(false);
    const [expandedContext, setExpandedContext] = useState({});
    const [publicToken, setPublicToken] = useState('');
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const kbRes = await api.get('/knowledge-bases');
            const kbData = await kbRes.json();
            setKbList(kbData);
            if (kbData.length > 0) setSelectedKbId(kbData[0].id);

            const res = await api.get('/unanswered-questions?status=PENDENTE');
            const data = await res.json();
            if (data.success) {
                setQuestions(data.items);
            }
        } catch (err) {
            console.error("Erro ao buscar dúvidas pendentes", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();

        const fetchPublicToken = async () => {
            try {
                const res = await api.get('/settings/public-tokens');
                if (res.ok) {
                    const data = await res.json();
                    setPublicToken(data.PUBLIC_ACCESS_TOKEN_UNANSWERED || '');
                }
            } catch (e) {
                console.error("Erro ao buscar token público", e);
            }
        };
        fetchPublicToken();
    }, []);

    const handleCopyPublicLink = () => {
        if (!publicToken) return;
        const link = `${window.location.origin}/public/questions/${publicToken}`;
        navigator.clipboard.writeText(link);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 3000);
    };

    const openModal = (q, type) => {
        setSelectedQuestion(q);
        setActiveModal(type);
        setAnswerText('');
        if (type === 'answer') {
            setEditingQuestionText(q.question);
        }
    };

    const handleAnswerSubmit = async () => {
        if (!answerText.trim() || !selectedKbId || !selectedQuestion) return;
        setSaving(true);
        try {
            const res = await api.post(`/unanswered-questions/${selectedQuestion.id}/answer`, {
                answer: answerText,
                knowledge_base_id: parseInt(selectedKbId),
                question: editingQuestionText !== selectedQuestion.question ? editingQuestionText : null
            });
            const data = await res.json();
            if (data.success) {
                // remove da lista local
                setQuestions(questions.filter(q => q.id !== selectedQuestion.id));
                setActiveModal(null);
            } else {
                alert(data.detail || "Erro ao salvar resposta.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão ao salvar resposta.");
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!selectedQuestion) return;
        setSaving(true);
        try {
            const res = await api.post(`/unanswered-questions/${selectedQuestion.id}/discard`);
            const data = await res.json();
            if (data.success) {
                setQuestions(questions.filter(q => q.id !== selectedQuestion.id));
                setActiveModal(null);
            } else {
                alert(data.detail || "Erro ao descartar.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão ao descartar.");
        } finally {
            setSaving(false);
        }
    };

    const toggleContext = (id) => {
        setExpandedContext(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
                    70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                }
                .uq-card {
                    background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 20px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    animation: fadeSlideUp 0.4s ease forwards;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                }
                .uq-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
                    opacity: 0.7;
                }
                .uq-card:hover {
                    border-color: rgba(239,68,68,0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(239,68,68,0.1);
                }
                .uq-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    background: rgba(239,68,68,0.12);
                    color: #f87171;
                    border: 1px solid rgba(239,68,68,0.2);
                }
                .uq-agent-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 3px 8px;
                    border-radius: 20px;
                    background: rgba(99,102,241,0.12);
                    color: #818cf8;
                    border: 1px solid rgba(99,102,241,0.2);
                }
                .uq-question-text {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: #f1f5f9;
                    line-height: 1.5;
                    padding: 0.75rem 1rem;
                    background: rgba(255,255,255,0.03);
                    border-left: 3px solid #ef4444;
                    border-radius: 0 12px 12px 0;
                    margin: 0.25rem 0;
                }
                .uq-context-toggle {
                    background: none;
                    border: none;
                    color: #64748b;
                    font-size: 0.78rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 0;
                    transition: color 0.2s;
                }
                .uq-context-toggle:hover { color: #94a3b8; }
                .uq-context-box {
                    background: rgba(0,0,0,0.25);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 1rem;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    color: #64748b;
                    white-space: pre-wrap;
                    line-height: 1.6;
                    font-family: 'JetBrains Mono', monospace;
                    max-height: 120px;
                    overflow-y: auto;
                }
                .uq-actions {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .uq-btn-teach {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0.6rem 1.4rem;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                }
                .uq-btn-teach:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(99,102,241,0.4);
                    background: linear-gradient(135deg, #818cf8, #6366f1);
                }
                .uq-btn-discard {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.6rem 1rem;
                    border-radius: 12px;
                    border: 1px solid rgba(239,68,68,0.25);
                    background: rgba(239,68,68,0.05);
                    color: #f87171;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .uq-btn-discard:hover {
                    background: rgba(239,68,68,0.12);
                    border-color: rgba(239,68,68,0.4);
                    transform: translateY(-1px);
                }

                /* Modal Premium */
                .uq-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    animation: fadeSlideUp 0.2s ease;
                }
                .uq-modal {
                    background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 24px;
                    padding: 2rem;
                    max-width: 620px;
                    width: 90%;
                    box-shadow: 0 30px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
                    position: relative;
                }
                .uq-modal-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .uq-modal-icon {
                    width: 46px;
                    height: 46px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                    flex-shrink: 0;
                }
                .uq-modal-icon.teach {
                    background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.3));
                    border: 1px solid rgba(99,102,241,0.3);
                }
                .uq-modal-icon.discard {
                    background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.3));
                    border: 1px solid rgba(239,68,68,0.3);
                }
                .uq-modal-title { font-size: 1.2rem; font-weight: 800; color: #f1f5f9; margin: 0 0 4px 0; }
                .uq-modal-subtitle { font-size: 0.8rem; color: #64748b; margin: 0; }
                .uq-close-btn {
                    position: absolute; top: 1.25rem; right: 1.25rem;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #64748b; border-radius: 8px;
                    width: 30px; height: 30px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; font-size: 1rem; transition: all 0.2s;
                }
                .uq-close-btn:hover { background: rgba(255,255,255,0.1); color: white; }
                .uq-question-preview {
                    padding: 1rem;
                    background: rgba(99,102,241,0.06);
                    border: 1px solid rgba(99,102,241,0.15);
                    border-radius: 14px;
                    color: #c7d2fe;
                    font-style: italic;
                    font-size: 0.95rem;
                    margin-bottom: 1.5rem;
                    line-height: 1.6;
                }
                .uq-form-label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #64748b;
                    margin-bottom: 0.5rem;
                }
                .uq-textarea {
                    width: 100%;
                    min-height: 130px;
                    padding: 1rem;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #f1f5f9;
                    border-radius: 14px;
                    resize: vertical;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .uq-textarea:focus { outline: none; border-color: rgba(99,102,241,0.4); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
                .uq-input {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #f1f5f9;
                    border-radius: 14px;
                    font-size: 0.9rem;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                    margin-bottom: 1rem;
                }
                .uq-input:focus { outline: none; border-color: rgba(99,102,241,0.4); }
                .uq-select {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #f1f5f9;
                    border-radius: 14px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .uq-select:focus { outline: none; border-color: rgba(99,102,241,0.4); }
                .uq-modal-footer {
                    display: flex;
                    gap: 0.75rem;
                    justify-content: flex-end;
                    margin-top: 1.5rem;
                }
                .uq-modal-btn-primary {
                    display: flex; align-items: center; gap: 8px;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                }
                .uq-modal-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
                .uq-modal-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
                .uq-modal-btn-secondary {
                    padding: 0.75rem 1.25rem;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: transparent;
                    color: #94a3b8;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .uq-modal-btn-secondary:hover { background: rgba(255,255,255,0.05); color: white; }
                .uq-modal-btn-danger {
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 14px rgba(239,68,68,0.3);
                }
                .uq-modal-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(239,68,68,0.4); }
                .uq-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 1.25rem 0; }
            `}</style>

            <div style={{ marginTop: '1.5rem' }}>
                {/* Header do Inbox */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.3))',
                            border: '1px solid rgba(239,68,68,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                        }}>📥</div>
                        <div>
                            <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1rem', fontWeight: 800 }}>Inbox de Dúvidas</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem' }}>
                                {loading ? 'Carregando...' : `${questions.length} pergunta${questions.length !== 1 ? 's' : ''} pendente${questions.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchQuestions}
                        style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#64748b', borderRadius: '10px', padding: '6px 12px',
                            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >🔄 Atualizar</button>
                    <button
                        onClick={handleCopyPublicLink}
                        style={{
                            background: showCopySuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.04)',
                            border: '1px solid ' + (showCopySuccess ? '#10b981' : 'rgba(99, 102, 241, 0.15)'),
                            color: showCopySuccess ? '#4ade80' : '#818cf8', borderRadius: '10px', padding: '6px 12px',
                            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        <span>{showCopySuccess ? '✅' : '🔗'}</span>
                        {showCopySuccess ? 'Copiado!' : 'Link Público'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>⏳</div>
                        <p style={{ color: '#64748b', margin: 0 }}>Buscando dúvidas no Inbox...</p>
                    </div>
                ) : questions.length === 0 ? (
                    <div style={{
                        padding: '4rem 2rem', textAlign: 'center',
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(15,23,42,0.8) 100%)',
                        borderRadius: '20px', border: '1px dashed rgba(16,185,129,0.2)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                        <h3 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Inbox Zerado!</h3>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
                            Seus agentes estão afiados! Todas as perguntas foram respondidas.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {questions.map((q, idx) => (
                            <div key={q.id} className="uq-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-ring 2s infinite' }}></div>
                                    <span className="uq-badge">⚠️ Pendente</span>
                                    {q.agent_id && <span className="uq-agent-tag">🤖 Agente #{q.agent_id}</span>}
                                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                                        🕐 {formatDate(q.created_at)}
                                    </span>
                                </div>

                                <div className="uq-question-text">💬 {q.question}</div>

                                {q.session_id && (
                                    <div style={{ marginTop: '0.25rem' }}>
                                        <button
                                            className="uq-context-toggle"
                                            onClick={() => navigate(`/playground?session_id=${q.session_id}&agent_id=${q.agent_id || ''}&view_mode=true`)}
                                            style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.2)' }}
                                        >
                                            🔍 Analisar Conversa na Integra
                                        </button>
                                    </div>
                                )}

                                <div className="uq-divider" style={{ margin: '0.25rem 0' }}></div>

                                <div className="uq-actions">
                                    <button className="uq-btn-teach" onClick={() => openModal(q, 'answer')}>
                                        ✍️ Ensinar Resposta
                                    </button>
                                    <button className="uq-btn-discard" onClick={() => openModal(q, 'discard')}>
                                        🗑️ Descartar
                                    </button>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#334155', fontStyle: 'italic' }}>
                                        Sessão: {q.session_id || '-'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {activeModal === 'answer' && selectedQuestion && (
                <div className="uq-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="uq-modal" onClick={e => e.stopPropagation()}>
                        <button className="uq-close-btn" onClick={() => setActiveModal(null)}>✕</button>
                        <div className="uq-modal-header">
                            <div className="uq-modal-icon teach">✍️</div>
                            <div>
                                <h3 className="uq-modal-title">Ensinar Resposta à IA</h3>
                                <p className="uq-modal-subtitle">A resposta será adicionada à base de conhecimento selecionada</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label className="uq-form-label">❓ Pergunta (Você pode editar para ficar mais clara)</label>
                            <input
                                className="uq-input"
                                value={editingQuestionText}
                                onChange={e => setEditingQuestionText(e.target.value)}
                                placeholder="Pergunta do usuário..."
                            />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label className="uq-form-label">✏️ Resposta Oficial</label>
                            <textarea
                                className="uq-textarea"
                                value={answerText}
                                onChange={e => setAnswerText(e.target.value)}
                                placeholder="Digite a resposta que o agente deverá usar..."
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                            <label className="uq-form-label">📚 Base de Conhecimento</label>
                            <select
                                className="uq-select"
                                value={selectedKbId}
                                onChange={e => setSelectedKbId(e.target.value)}
                            >
                                <option value="" disabled>Selecione uma base...</option>
                                {kbList.map(kb => (
                                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="uq-modal-footer">
                            <button className="uq-modal-btn-secondary" onClick={() => setActiveModal(null)}>Cancelar</button>
                            <button className="uq-modal-btn-primary" onClick={handleAnswerSubmit} disabled={!answerText.trim() || !selectedKbId || saving}>
                                {saving ? '⏳ Salvando...' : '🧠 Salvar e Ensinar IA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'discard' && selectedQuestion && (
                <div className="uq-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="uq-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <button className="uq-close-btn" onClick={() => setActiveModal(null)}>✕</button>
                        <div className="uq-modal-header">
                            <div className="uq-modal-icon discard">🗑️</div>
                            <div>
                                <h3 className="uq-modal-title">Descartar Dúvida?</h3>
                                <p className="uq-modal-subtitle">Esta ação não pode ser desfeita</p>
                            </div>
                        </div>
                        <div className="uq-question-preview" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                            💬 "{selectedQuestion.question}"
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem 0', lineHeight: 1.6 }}>
                            A pergunta será marcada como descartada e removida do Inbox.
                        </p>
                        <div className="uq-modal-footer">
                            <button className="uq-modal-btn-secondary" onClick={() => setActiveModal(null)}>Cancelar</button>
                            <button className="uq-modal-btn-danger" onClick={handleDiscard} disabled={saving}>
                                {saving ? '⏳ Descartando...' : '🗑️ Sim, Descartar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UnansweredQuestions;
