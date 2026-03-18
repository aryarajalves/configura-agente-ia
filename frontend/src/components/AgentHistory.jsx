import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';
import AnalysisModal from './AnalysisModal';

const AgentHistory = ({ agentId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSessions, setExpandedSessions] = useState({});
    const [summaries, setSummaries] = useState({});
    const [loadingSummary, setLoadingSummary] = useState({});

    useEffect(() => {
        if (!agentId || agentId === 'new') {
            setLoading(false);
            return;
        }

        api.get(`/agents/${agentId}/history`)
            .then(res => res.json())
            .then(data => {
                setHistory(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Erro ao carregar histórico:", err);
                setLoading(false);
            });
    }, [agentId]);

    const handleSummarize = async (sessionId) => {
        if (loadingSummary[sessionId]) return;

        setLoadingSummary(prev => ({ ...prev, [sessionId]: true }));
        try {
            const res = await api.get(`/sessions/${sessionId}/summarize`);
            const data = await res.json();
            setSummaries(prev => ({ ...prev, [sessionId]: data }));
        } catch (err) {
            console.error("Erro ao gerar resumo:", err);
        } finally {
            setLoadingSummary(prev => ({ ...prev, [sessionId]: false }));
        }
    };

    const toggleSession = (sessionId) => {
        setExpandedSessions(prev => ({
            ...prev,
            [sessionId]: !prev[sessionId]
        }));
    };

    // Bulk Delete Logic
    const [selectedSessions, setSelectedSessions] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [analysisData, setAnalysisData] = useState(null);

    const toggleSelection = (e, sessionId) => {
        e.stopPropagation();
        const newSet = new Set(selectedSessions);
        if (newSet.has(sessionId)) newSet.delete(sessionId);
        else newSet.add(sessionId);
        setSelectedSessions(newSet);
    };

    const handleSelectAll = (e, sessionsList) => {
        if (e.target.checked) {
            setSelectedSessions(new Set(sessionsList.map(s => s.id)));
        } else {
            setSelectedSessions(new Set());
        }
    };

    const handleConfirmDelete = async () => {
        if (selectedSessions.size === 0) return;
        setIsDeleting(true);
        try {
            const res = await api.post(`/sessions/delete`, {
                session_ids: Array.from(selectedSessions)
            });

            if (res.ok) {
                // Update local state by removing deleted logs
                setHistory(prev => prev.filter(log => !selectedSessions.has(log.session_id)));
                setSelectedSessions(new Set());
                setShowDeleteModal(false);
            } else {
                alert("Erro ao deletar sessões.");
            }
        } catch (err) {
            console.error("Erro ao deletar:", err);
            alert("Erro de conexão.");
        } finally {
            setIsDeleting(false);
        }
    };

    const extractBatchQuestions = async () => {
        if (selectedSessions.size === 0) return;
        setAnalysisData({ type: 'questions', loading: true });

        try {
            const res = await api.post(`/sessions/questions/batch`, {
                session_ids: Array.from(selectedSessions)
            });
            const data = await res.json();
            setAnalysisData({ type: 'questions', content: data.questions, loading: false });
        } catch (e) {
            console.error(e);
            setAnalysisData({ type: 'error', content: "Erro ao extrair perguntas em lote.", loading: false });
        }
    };

    if (loading) return <div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>Carregando histórico...</div>;
    if (!agentId || agentId === 'new') return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Salve o agente primeiro para começar a registrar o histórico.</div>;
    if (history.length === 0) return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Nenhuma interação registrada para este agente ainda.</div>;

    // Agrupar por Session ID (preservando ordem cronológica inversa dos logs)
    const sessions = history.reduce((acc, log) => {
        const sId = log.session_id || 'sem_sessao';
        if (!acc[sId]) {
            acc[sId] = {
                id: sId,
                startTime: log.timestamp,
                totalCost: 0,
                totalTokens: 0,
                interactions: []
            };
        }
        acc[sId].interactions.push(log);
        acc[sId].totalCost += log.cost_brl || 0;
        acc[sId].totalTokens += (log.input_tokens + log.output_tokens) || 0;

        // Atualiza startTime para o mais antigo encontrado no grupo (já que vêm ordenados por desc)
        if (new Date(log.timestamp) < new Date(acc[sId].startTime)) {
            acc[sId].startTime = log.timestamp;
        }

        return acc;
    }, {});

    // Converter para array e ordenar sessões pela data da interação mais recente
    const sortedSessions = Object.values(sessions).sort((a, b) =>
        new Date(b.interactions[0].timestamp) - new Date(a.interactions[0].timestamp)
    );

    return (
        <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e, sortedSessions)}
                        checked={selectedSessions.size === sortedSessions.length && sortedSessions.length > 0}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span className="section-label">Conversas Agrupadas por Sessão</span>
                </div>

                {selectedSessions.size > 0 && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={extractBatchQuestions}
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            💎 Extrair Perguntas ({selectedSessions.size})
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="delete-btn"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600',
                                fontSize: '0.85rem'
                            }}
                        >
                            🗑️ Deletar ({selectedSessions.size})
                        </button>
                    </div>
                )}
            </div>

            {sortedSessions.map((session) => (
                <div key={session.id} className="session-card" style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                }}>
                    {/* Cabeçalho da Sessão */}
                    <div
                        onClick={() => toggleSession(session.id)}
                        style={{
                            padding: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: expandedSessions[session.id] ? 'rgba(255,255,255,0.03)' : 'transparent',
                            borderBottom: expandedSessions[session.id] ? '1px solid var(--border-color)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedSessions.has(session.id)}
                                    onChange={(e) => toggleSelection(e, session.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', zIndex: 10 }}
                                />
                                <span style={{ fontSize: '1rem' }}>💬 {session.id.slice(0, 8)}...</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.5, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                                    {session.interactions.length} {session.interactions.length === 1 ? 'msg' : 'msgs'}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Início: {new Date(session.startTime + 'Z').toLocaleString('pt-BR')}
                            </span>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '0.9rem' }}>R$ {session.totalCost.toFixed(4)}</span>
                                <span>{session.totalTokens} tokens</span>
                            </div>
                            <span style={{ transform: expandedSessions[session.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', opacity: 0.5 }}>
                                🔽
                            </span>
                        </div>
                    </div>

                    {/* Conteúdo da Sessão (Mensagens) */}
                    {expandedSessions[session.id] && (
                        <div className="session-content" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(0,0,0,0.1)' }}>
                            {/* Inverter interações para mostrar a ordem cronológica correta (mais antiga primeiro dentro da sessão) */}
                            {[...session.interactions].reverse().map((log, idx) => (
                                <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.3, fontSize: '0.65rem' }}>
                                        {idx + 1}ª Interação • {new Date(log.timestamp + 'Z').toLocaleTimeString('pt-BR')}
                                    </div>

                                    {/* Mensagem do Usuário */}
                                    <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>VOCÊ</span>
                                        </div>
                                        <div style={{ background: 'var(--accent-color)', color: 'white', padding: '0.8rem 1.2rem', borderRadius: '18px 18px 4px 18px', fontSize: '0.9rem' }}>
                                            {log.user_message}
                                        </div>
                                    </div>

                                    {/* Mensagem do Agente */}
                                    <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold' }}>IA ({log.model_used})</span>
                                        </div>
                                        <div style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'rgba(255,255,255,0.9)',
                                            padding: '1rem',
                                            borderRadius: '18px 18px 18px 4px',
                                            fontSize: '0.9rem',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {log.agent_response}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                            <span>📦 {log.input_tokens + log.output_tokens} tok</span>
                                            <span>💰 R$ {log.cost_brl.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Botão e Caixa de Resumo */}
                            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                                {!summaries[session.id] ? (
                                    <button
                                        onClick={() => handleSummarize(session.id)}
                                        disabled={loadingSummary[session.id]}
                                        style={{
                                            background: 'rgba(255, 191, 0, 0.1)',
                                            border: '1px solid rgba(255, 191, 0, 0.3)',
                                            color: '#fbbf24',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {loadingSummary[session.id] ? '⏳ Gerando...' : '📝 Resumir Conversa'}
                                    </button>
                                ) : (
                                    <div style={{
                                        background: 'rgba(251, 191, 36, 0.08)',
                                        borderLeft: '4px solid #fbbf24',
                                        padding: '1.2rem',
                                        borderRadius: '4px 12px 12px 4px',
                                        fontSize: '0.9rem',
                                        color: '#fef3c7',
                                        lineHeight: '1.5',
                                        position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                <span>📄 Resumo da IA</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                background: summaries[session.id].is_cached ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                color: summaries[session.id].is_cached ? '#818cf8' : '#10b981',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid currentColor'
                                            }}>
                                                {summaries[session.id].is_cached ? '📦 RECUPERADO DO BANCO' : '✨ GERADO AGORA'}
                                            </span>
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                                            {summaries[session.id].summary}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            gap: '15px',
                                            fontSize: '0.7rem',
                                            color: '#fbbf24',
                                            opacity: 0.8,
                                            borderTop: '1px solid rgba(251, 191, 36, 0.15)',
                                            paddingTop: '8px'
                                        }}>
                                            <span>📊 Tokens: <strong>{summaries[session.id].usage?.total_tokens || 0}</strong></span>
                                            <span>💰 Custo: <strong>R$ {summaries[session.id].cost_brl?.toFixed(4)}</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
            {/* Modal de Confirmação de Exclusão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Excluir Sessões"
                message={`Tem certeza que deseja excluir ${selectedSessions.size} sessões selecionadas? Esta ação não pode ser desfeita.`}
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteModal(false)}
                confirmText={isDeleting ? "Excluindo..." : "Excluir"}
                cancelText="Cancelar"
                type="danger"
            />

            <AnalysisModal
                isOpen={!!analysisData}
                onClose={() => setAnalysisData(null)}
                analysisData={analysisData}
                agentId={agentId}
            />
        </div>
    );
};

export default AgentHistory;
