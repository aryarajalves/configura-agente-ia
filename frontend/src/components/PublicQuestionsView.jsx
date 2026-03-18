import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const PublicQuestionsView = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Action states
    const [activeModal, setActiveModal] = useState(null); // 'answer' | 'discard' | null
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [editingQuestionText, setEditingQuestionText] = useState('');
    const [kbList, setKbList] = useState([]);
    const [selectedKbId, setSelectedKbId] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchQuestions = async () => {
        try {
            const res = await api.get(`/public/unanswered/${token}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Link inválido ou expirado.");
                return;
            }
            const data = await res.json();
            if (data.success) {
                setQuestions(data.items);
            }
            
            // Fetch KBs
            const kbRes = await api.get(`/public/knowledge-bases/${token}`);
            if (kbRes.ok) {
                const kbData = await kbRes.json();
                setKbList(kbData);
                if (kbData.length > 0) setSelectedKbId(kbData[0].id);
            }
        } catch (err) {
            setError("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
        const interval = setInterval(fetchQuestions, 60000);
        return () => clearInterval(interval);
    }, [token]);

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
            const res = await api.post(`/public/unanswered/${token}/${selectedQuestion.id}/answer`, {
                answer: answerText,
                knowledge_base_id: parseInt(selectedKbId),
                question: editingQuestionText !== selectedQuestion.question ? editingQuestionText : null
            });
            const data = await res.json();
            if (data.success) {
                setQuestions(questions.filter(q => q.id !== selectedQuestion.id));
                setActiveModal(null);
            } else {
                alert(data.detail || "Erro ao salvar resposta.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar resposta.");
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!selectedQuestion) return;
        setSaving(true);
        try {
            const res = await api.post(`/public/unanswered/${token}/${selectedQuestion.id}/discard`);
            const data = await res.json();
            if (data.success) {
                setQuestions(questions.filter(q => q.id !== selectedQuestion.id));
                setActiveModal(null);
            } else {
                alert(data.detail || "Erro ao descartar.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao descartar.");
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return (
        <div className="loading-container">
            <div className="loader"></div>
            <p>Carregando Inbox de Dúvidas...</p>
            <style>{`
                .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #94a3b8; background: #070a13; }
                .loader { border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
    
    if (error) return (
        <div className="error-container">
            <h2>⚠️ Acesso Negado</h2>
            <p>{error}</p>
            <style>{`
                .error-container { text-align: center; padding: 100px; color: #f87171; background: #070a13; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                h2 { margin-bottom: 20px; font-size: 2rem; }
            `}</style>
        </div>
    );

    return (
        <div className="public-view-container">
             <style>{`
                /* Estilos copiados e adaptados do UnansweredQuestions.jsx para manter paridade visual */
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .question-card {
                    background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 20px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    animation: fadeSlideUp 0.4s ease forwards;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                    border-left: 4px solid #ef4444;
                }
                .question-card:hover {
                    border-color: rgba(239,68,68,0.2);
                    transform: translateY(-4px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
                }
                .question-text { font-size: 1.2rem; font-weight: 800; color: #f1f5f9; margin: 0; line-height: 1.5; }
                
                .card-actions { display: flex; gap: 12px; margin-top: 10px; align-items: center; }
                
                .btn-teach { padding: 10px 20px; border-radius: 12px; border: none; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
                .btn-discard { padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); color: #f87171; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
                .btn-explore { padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); color: #818cf8; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
                
                /* Modais */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeSlideUp 0.2s ease; }
                .modal { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 30px; width: 90%; max-width: 600px; box-shadow: 0 30px 100px rgba(0,0,0,0.8); }
                .modal-title { font-size: 1.3rem; font-weight: 800; margin-bottom: 20px; }
                .form-label { display: block; font-size: 0.75rem; font-weight: 800; color: #64748b; margin-bottom: 8px; text-transform: uppercase; }
                .input-field { width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; margin-bottom: 20px; box-sizing: border-box; }
                .text-area { min-height: 120px; resize: vertical; }
                .modal-footer { display: flex; justify-content: flex-end; gap: 12px; }
            `}</style>
            
            <header className="public-header">
                <style>{` body { background: #070a13; margin: 0; color: white; font-family: 'Inter', sans-serif; } .public-view-container { padding: 40px; max-width: 900px; margin: 0 auto; } .public-header { margin-bottom: 40px; text-align: center; } .public-header h1 { font-size: 2.5rem; margin-bottom: 10px; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; } .public-header p { color: #64748b; } `}</style>
                <h1>📥 Inbox de Dúvidas</h1>
                <p>Ajude a treinar o agente AI respondendo às perguntas que ele não conhecia.</p>
            </header>
            
            <div className="public-content">
                {questions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px', background: 'rgba(16,185,129,0.05)', borderRadius: '30px', border: '2px dashed rgba(16,185,129,0.2)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                        <h3 style={{ color: '#10b981', margin: 0 }}>Inbox Zerado!</h3>
                        <p style={{ color: '#64748b', marginTop: '10px' }}>Todas as dúvidas foram curadas.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {questions.map(q => (
                            <div key={q.id} className="question-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                    <span style={{ fontWeight: 800, color: '#ef4444' }}>🔴 PENDENTE</span>
                                    <span>{formatDate(q.created_at)}</span>
                                </div>
                                <h3 className="question-text">💬 {q.question}</h3>
                                
                                <div className="card-actions">
                                    <button className="btn-teach" onClick={() => openModal(q, 'answer')}>
                                        ✍️ Ensinar
                                    </button>
                                    <button className="btn-discard" onClick={() => openModal(q, 'discard')}>
                                        🗑️ Descartar
                                    </button>
                                    {q.session_id && (
                                        <button className="btn-explore" onClick={() => navigate(`/shared/${q.session_id}`)}>
                                            🔍 Ver Conversa
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Answer Modal */}
            {activeModal === 'answer' && (
                <div className="modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">🧠 Ensinar Resposta</h3>
                        <label className="form-label">Pergunta (Pode ajustar para clareza)</label>
                        <input className="input-field" value={editingQuestionText} onChange={e => setEditingQuestionText(e.target.value)} />
                        
                        <label className="form-label">Resposta Oficial</label>
                        <textarea className="input-field text-area" value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Digite a resposta correta..." autoFocus />
                        
                        <label className="form-label">Onde salvar?</label>
                        <select className="input-field" value={selectedKbId} onChange={e => setSelectedKbId(e.target.value)}>
                            {kbList.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                        </select>
                        
                        <div className="modal-footer">
                            <button className="btn-discard" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveModal(null)}>Cancelar</button>
                            <button className="btn-teach" onClick={handleAnswerSubmit} disabled={!answerText.trim() || saving}>
                                {saving ? 'Salvando...' : 'Salvar na IA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discard Modal */}
            {activeModal === 'discard' && (
                <div className="modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">🗑️ Descartar Pergunta?</h3>
                        <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Esta pergunta será removida do inbox e não será adicionada à IA.</p>
                        <div className="modal-footer">
                            <button className="btn-discard" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveModal(null)}>Manter</button>
                            <button className="btn-discard" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={handleDiscard} disabled={saving}>
                                {saving ? 'Descartando...' : 'Confirmar Descarte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicQuestionsView;
