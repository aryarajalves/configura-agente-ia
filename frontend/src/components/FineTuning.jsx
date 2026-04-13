import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const STATUS_CONFIG = {
    succeeded: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '✅ Concluído', pulse: false },
    running: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: '🔄 Treinando', pulse: true },
    validating_files: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '📋 Validando', pulse: true },
    queued: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: '⏳ Na Fila', pulse: false },
    failed: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', label: '❌ Falhou', pulse: false },
    cancelled: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: '⛔ Cancelado', pulse: false },
};

function formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    return d.toLocaleString('pt-BR');
}

// ── Componente de item com edição inline ─────────────────────────────────────
const FeedbackItem = ({ item, onDelete, onUpdate, showToast }) => {
    const [expanded, setExpanded] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [draft, setDraft] = useState({
        user_message: item.user_message,
        corrected_response: item.corrected_response || '',
        correction_note: item.correction_note || '',
    });

    // Sincroniza quando o item muda externamente (ex: após salvar)
    useEffect(() => {
        setDraft({
            user_message: item.user_message,
            corrected_response: item.corrected_response || '',
            correction_note: item.correction_note || '',
        });
    }, [item]);

    const handleEdit = (e) => {
        e.stopPropagation();
        setExpanded(true);
        setEditMode(true);
    };

    const handleCancel = () => {
        setDraft({
            user_message: item.user_message,
            corrected_response: item.corrected_response || '',
            correction_note: item.correction_note || '',
        });
        setEditMode(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.patch(`/feedback/${item.id}`, {
                user_message: draft.user_message.trim(),
                corrected_response: draft.corrected_response.trim() || null,
                correction_note: draft.correction_note.trim() || null,
            });
            if (!res.ok) throw new Error('Erro ao salvar');
            onUpdate(item.id, {
                user_message: draft.user_message.trim(),
                corrected_response: draft.corrected_response.trim() || null,
                correction_note: draft.correction_note.trim() || null,
            });
            setEditMode(false);
            showToast('✅ Exemplo atualizado!');
        } catch {
            showToast('Erro ao salvar edição.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const hasCorrection = editMode ? !!draft.corrected_response.trim() : !!item.corrected_response;

    return (
        <>
            <div className={`ft-dataset-item ${item.rating} ${item.exported_to_finetune ? 'exported' : ''}`}>
                {/* Header clicável */}
                <div className="ft-item-header" onClick={() => !editMode && setExpanded(v => !v)}>
                    <div className="ft-item-left">
                        <span className={`ft-rating-badge ${item.rating}`}>
                            {item.rating === 'positive' ? '👍' : '👎'}
                        </span>
                        <div className="ft-item-info">
                            <span className="ft-item-agent">{item.agent_name}</span>
                            <span className="ft-item-date">{formatDate(item.created_at)}</span>
                        </div>
                        <p className="ft-item-question">
                            {item.user_message.slice(0, 80)}{item.user_message.length > 80 ? '...' : ''}
                        </p>
                    </div>
                    <div className="ft-item-right">
                        {item.exported_to_finetune && (
                            <span className="ft-exported-badge" title={`Job: ${item.finetune_job_id}`}>✅ Exportado</span>
                        )}
                        {item.corrected_response && !item.exported_to_finetune && (
                            <span className="ft-ready-for-train-badge">🎯 Pronto</span>
                        )}
                        {!item.corrected_response && item.rating === 'negative' && (
                            <span className="ft-needs-correction-badge">✏️ Sem correção</span>
                        )}
                        <button
                            className="ft-edit-btn"
                            onClick={handleEdit}
                            title="Editar pergunta e resposta"
                        >
                            ✏️
                        </button>
                        <span className="ft-expand-icon">{expanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {/* Corpo expandido */}
                {expanded && (
                    <div className="ft-item-body fade-in">
                        {editMode ? (
                            <div className="ft-edit-form">
                                <div className="ft-edit-hint">
                                    ✏️ Edite os campos abaixo e clique em <strong>Salvar</strong>
                                </div>
                                <div className="ft-edit-grid">
                                    <div className="ft-edit-field full">
                                        <label>💬 Pergunta do Usuário</label>
                                        <textarea
                                            rows={3}
                                            value={draft.user_message}
                                            onChange={e => setDraft(d => ({ ...d, user_message: e.target.value }))}
                                            placeholder="A pergunta feita pelo usuário..."
                                            className="ft-edit-textarea user"
                                        />
                                    </div>
                                    <div className="ft-edit-field full">
                                        <label>✅ Resposta Corrigida (usada no treino) <span style={{ color: '#f43f5e' }}>*</span></label>
                                        <textarea
                                            rows={4}
                                            value={draft.corrected_response}
                                            onChange={e => setDraft(d => ({ ...d, corrected_response: e.target.value }))}
                                            placeholder="Como o agente DEVERIA ter respondido..."
                                            className="ft-edit-textarea corrected"
                                        />
                                    </div>
                                    <div className="ft-edit-field full">
                                        <label>💡 Nota do Revisor (opcional)</label>
                                        <input
                                            type="text"
                                            value={draft.correction_note}
                                            onChange={e => setDraft(d => ({ ...d, correction_note: e.target.value }))}
                                            placeholder="Ex: Sempre mencionar o desconto anual primeiro..."
                                            className="ft-edit-input"
                                        />
                                    </div>
                                </div>
                                <div className="ft-original-preview">
                                    <div className="ft-pair-label" style={{ marginBottom: 6 }}>🤖 Resposta Original (somente leitura)</div>
                                    <div className="ft-pair-content original">{item.original_response || '—'}</div>
                                </div>
                                <div className="ft-edit-actions">
                                    <button className="cancel-btn" onClick={handleCancel} disabled={saving}>
                                        Cancelar
                                    </button>
                                    <button
                                        className="primary-action-btn"
                                        onClick={handleSave}
                                        disabled={saving || !draft.user_message.trim()}
                                    >
                                        {saving ? '⏳ Salvando...' : '💾 Salvar Edição'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="ft-pair">
                                    <div className="ft-pair-col">
                                        <div className="ft-pair-label">💬 Pergunta do Usuário</div>
                                        <div className="ft-pair-content user">{item.user_message}</div>
                                    </div>
                                    <div className="ft-pair-col">
                                        <div className="ft-pair-label">🤖 Resposta Original</div>
                                        <div className="ft-pair-content original">{item.original_response || '—'}</div>
                                    </div>
                                    {item.corrected_response && (
                                        <div className="ft-pair-col corrected">
                                            <div className="ft-pair-label">✅ Resposta Corrigida (Treino)</div>
                                            <div className="ft-pair-content corrected">{item.corrected_response}</div>
                                        </div>
                                    )}
                                </div>
                                {item.correction_note && (
                                    <div className="ft-note">
                                        💡 <strong>Nota do revisor:</strong> {item.correction_note}
                                    </div>
                                )}
                                <div className="ft-item-footer">
                                    <button className="ft-edit-full-btn" onClick={handleEdit}>
                                        ✏️ Editar este exemplo
                                    </button>
                                    <button
                                        className="ft-delete-btn"
                                        disabled={onDelete.loading}
                                        onClick={() => setConfirmDelete(true)}
                                    >
                                        {onDelete.loading ? 'Removendo...' : '🗑️ Remover do Dataset'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de confirmação de remoção */}
            {confirmDelete && (
                <div className="modal-overlay fade-in" onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
                    <div className="ft-confirm-modal">
                        <div className="ft-confirm-icon">🗑️</div>
                        <h3 className="ft-confirm-title">Remover do Dataset?</h3>
                        <p className="ft-confirm-subtitle">
                            Este exemplo será <strong>permanentemente removido</strong> do pipeline de treinamento. Esta ação não pode ser desfeita.
                        </p>
                        <div className="ft-confirm-preview">
                            <div className="ft-confirm-preview-label">💬 Pergunta sendo removida</div>
                            <div className="ft-confirm-preview-text">
                                {item.user_message.slice(0, 120)}{item.user_message.length > 120 ? '...' : ''}
                            </div>
                        </div>
                        <div className="ft-confirm-actions">
                            <button className="ft-confirm-cancel" onClick={() => setConfirmDelete(false)}>
                                Manter no Dataset
                            </button>
                            <button
                                className="ft-confirm-delete"
                                disabled={onDelete.loading}
                                onClick={() => { setConfirmDelete(false); onDelete(item.id); }}
                            >
                                {onDelete.loading ? '⏳ Removendo...' : '🗑️ Sim, remover'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};




// ── Componente principal ──────────────────────────────────────────────────────
const FineTuning = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dataset');
    const [agents, setAgents] = useState([]);
    const [agentsLoaded, setAgentsLoaded] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState(null);
    const [feedbackList, setFeedbackList] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterRating, setFilterRating] = useState('all');
    const [filterExported, setFilterExported] = useState('all');
    const [showStartModal, setShowStartModal] = useState(false);
    const [jobConfig, setJobConfig] = useState({ base_model: 'gpt-4o-mini-2024-07-18', n_epochs: 3 });
    const [startingJob, setStartingJob] = useState(false);
    const [startError, setStartError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteModel, setConfirmDeleteModel] = useState(null); // model_id a deletar
    const [deletingModel, setDeletingModel] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    // Custo real em USD e BRL baseado em trained_tokens
    const USD_BRL = 5.8; // taxa aproximada — atualizar conforme necessário
    const calcCost = (trained_tokens, model) => {
        if (!trained_tokens) return null;
        // gpt-4o-mini fine-tune: $3/1M tokens; gpt-3.5-turbo: $8/1M tokens
        const pricePerM = model?.includes('gpt-3.5') ? 8 : 3;
        const usd = (trained_tokens / 1_000_000) * pricePerM;
        const brl = usd * USD_BRL;
        return { usd: usd.toFixed(4), brl: brl.toFixed(2) };
    };

    const handleDeleteModel = async () => {
        if (!confirmDeleteModel) return;
        setDeletingModel(true);
        try {
            const res = await api.delete(`/fine-tuning/models/${encodeURIComponent(confirmDeleteModel)}`);
            if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
            showToast('🗑️ Modelo deletado da OpenAI.');
            setConfirmDeleteModel(null);
            loadJobs();
        } catch (e) {
            showToast(`Erro: ${e.message} `, 'error');
        } finally {
            setDeletingModel(false);
        }
    };

    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [cleaningCheckpoints, setCleaningCheckpoints] = useState(false);

    const handleCleanupCheckpoints = async () => {
        setCleaningCheckpoints(true);
        try {
            const res = await api.post('/fine-tuning/cleanup-checkpoints');
            const data = await res.json();
            showToast(`🧹 ${data.message}`);
            setShowCleanupModal(false);
            loadJobs();
        } catch {
            showToast('Erro ao realizar limpeza.', 'error');
        } finally {
            setCleaningCheckpoints(false);
        }
    };

    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        api.get('/agents')
            .then(r => r.json())
            .then(data => {
                setAgents(data);
                if (data.length > 0) setSelectedAgentId(data[0].id);
                setAgentsLoaded(true);
            })
            .catch(() => setAgentsLoaded(true));
    }, []);

    const loadFeedback = useCallback(async () => {
        if (!selectedAgentId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ agent_id: selectedAgentId });
            if (filterRating !== 'all') params.set('rating', filterRating);
            if (filterExported === 'pending') params.set('exported', 'false');
            if (filterExported === 'done') params.set('exported', 'true');
            const res = await api.get(`/feedback?${params}`);
            const data = await res.json();
            setFeedbackList(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedAgentId, filterRating, filterExported]);

    useEffect(() => { if (activeTab === 'dataset') loadFeedback(); }, [activeTab, loadFeedback]);

    const loadJobs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/fine-tuning/jobs');
            const data = await res.json();
            setJobs(Array.isArray(data) ? data : []);
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (activeTab === 'jobs') loadJobs(); }, [activeTab, loadJobs]);

    // Polling automático: atualiza a cada 15s enquanto houver jobs em andamento
    useEffect(() => {
        if (activeTab !== 'jobs') return;
        const PENDING_STATUSES = ['validating_files', 'queued', 'running'];
        const hasPending = (jobs || []).some(j => PENDING_STATUSES.includes(j.status));
        if (!hasPending) return;
        const interval = setInterval(() => {
            loadJobs();
        }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, jobs, loadJobs]);

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            // Busca o item para limpar o cache do localStorage no ChatPlayground
            const item = feedbackList.find(f => f.id === id);
            await api.delete(`/feedback/${id}`);
            // Limpa o estado persistido do 👍/👎 no localStorage do ChatPlayground
            if (item && window.__clearFeedbackCache) {
                window.__clearFeedbackCache(item.agent_id, item.original_response);
            }
            setFeedbackList(prev => prev.filter(f => f.id !== id));
            showToast('Exemplo removido do dataset.');
        } catch {
            showToast('Erro ao remover.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // Passa um objeto com .loading para o item saber se está deletando
    const deleteHandler = Object.assign(handleDelete, { loading: deletingId !== null });

    const handleUpdate = (id, changes) => {
        setFeedbackList(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
    };

    const handleExportJsonl = () => {
        window.open(`${api.getBaseUrl()}/feedback/export/${selectedAgentId}`, '_blank');
        showToast('Download iniciado! 📥');
    };

    const handleStartJob = async () => {
        setStartingJob(true);
        setStartError(null);
        try {
            const res = await api.post('/fine-tuning/start', { agent_id: selectedAgentId, ...jobConfig });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erro desconhecido');
            showToast(`🚀 Job ${data.job_id} iniciado com ${data.examples_count} exemplos!`);
            setShowStartModal(false);
            loadFeedback();
            setActiveTab('jobs');
            setTimeout(loadJobs, 1500);
        } catch (e) {
            setStartError(e.message);
        } finally {
            setStartingJob(false);
        }
    };

    const totalExamples = (feedbackList || []).length;
    const pendingExamples = (feedbackList || []).filter(f => !f.exported_to_finetune && f.corrected_response).length;
    const positiveCount = (feedbackList || []).filter(f => f.rating === 'positive').length;
    const negativeCount = (feedbackList || []).filter(f => f.rating === 'negative').length;
    const withCorrectionCount = (feedbackList || []).filter(f => f.corrected_response).length;

    if (agentsLoaded && agents.length === 0) {
        return (
            <div className="ft-no-agents-screen fade-in">
                <div className="ft-no-agents-card">
                    <div className="ft-no-agents-icon">🤖</div>
                    <h2 className="ft-no-agents-title">Nenhum agente encontrado</h2>
                    <p className="ft-no-agents-desc">
                        Para usar o Fine-Tuning, você precisa ter pelo menos um agente criado.<br />
                        Crie um agente e volte aqui para treinar seu modelo.
                    </p>
                    <button className="ft-no-agents-btn" onClick={() => navigate('/agent/new')}>
                        + Criar meu primeiro agente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fine-tuning-page fade-in">
            {toast && (
                <div className={`ft-toast ${toast.type || 'success'}`}>{toast.msg}</div>
            )}

            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="page-header-icon">🏭</div>
                    <div>
                        <h1 className="page-title">Pipeline de Fine-Tuning</h1>
                        <p className="page-subtitle">Treine modelos proprietários com o estilo e conhecimento da sua empresa</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        color: '#a5b4fc', borderRadius: '10px',
                        padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    <span>📖</span><span>Guia do Fine-Tuning</span>
                </button>
            </div>

            {/* Modal Guia do Fine-Tuning */}
            {showGuide && (
                <div
                    onClick={() => setShowGuide(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                        padding: '2rem 1rem', overflowY: 'auto',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '20px', padding: '2rem',
                            maxWidth: '780px', width: '100%',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>🏭</span><span>Guia do Pipeline de Fine-Tuning</span>
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                    Aprenda a treinar modelos proprietários com os dados reais das suas conversas.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowGuide(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >✕</button>
                        </div>

                        {/* Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {[
                                {
                                    icon: '🧠', title: 'O que é Fine-Tuning?', accent: '#6366f1',
                                    desc: 'Fine-Tuning é o processo de treinar um modelo de linguagem base (como o GPT-4o mini) com exemplos específicos do seu negócio. O resultado é um modelo que responde no estilo, tom e com o conhecimento da sua empresa — muito além do que o prompt consegue sozinho.',
                                    tip: 'Use fine-tuning quando o agente precisar de consistência muito alta de estilo, respostas muito específicas do setor, ou quando o prompt já está grande demais.',
                                },
                                {
                                    icon: '💬', title: 'Passo 1 — Conversar (Playground)', accent: '#8b5cf6',
                                    desc: 'Acesse o Playground e converse com o agente normalmente. Quando o agente der uma resposta ruim, clique no 👎 para marcá-la como negativa. Essas avaliações viram os dados de treinamento.',
                                    tip: 'Quanto mais conversas reais você avaliar, melhor será o dataset. Foque nas situações em que o agente mais erra.',
                                },
                                {
                                    icon: '✏️', title: 'Passo 2 — Corrigir as Respostas', accent: '#a855f7',
                                    desc: 'Para cada resposta marcada como ruim, escreva a resposta ideal no campo "Correção". Essa versão corrigida é o que o modelo vai aprender a reproduzir. Quanto mais detalhada e fiel ao seu estilo, melhor.',
                                    tip: 'Não precisa ser perfeita — o modelo aprende padrões. Mas seja consistente: sempre use o mesmo tom e formato nas correções.',
                                },
                                {
                                    icon: '✍️', title: 'Passo 3 — Refinar no Dataset', accent: '#06b6d4',
                                    desc: 'Na aba "Dataset" você vê todos os exemplos coletados. Filtre por rating ou status, expanda para revisar o par pergunta/resposta, edite diretamente se necessário, e marque os exemplos prontos para treino.',
                                    code: 'Status dos exemplos:\n👍 Positivo     → resposta já era boa\n👎 Negativo     → marcado como ruim\n✏️ Com Correção → tem resposta ideal escrita\n⏳ Pronto p/ Treinar → exportado ao menos 1x',
                                    tip: 'O mínimo recomendado é 10 exemplos para iniciar, mas 50+ gera resultados notavelmente melhores.',
                                },
                                {
                                    icon: '📦', title: 'Passo 4 — Exportar Dataset (JSONL)', accent: '#10b981',
                                    desc: 'Clique em "Exportar JSONL" para baixar o arquivo de treinamento no formato que a OpenAI exige. O arquivo contém os pares de mensagens formatados corretamente para fine-tuning.',
                                    tip: 'Só exemplos com correção escrita são incluídos na exportação. Exemplos apenas "negativos" sem correção são ignorados.',
                                },
                                {
                                    icon: '🚀', title: 'Passo 5 — Iniciar Treinamento', accent: '#f59e0b',
                                    desc: 'Na aba "Jobs de Treinamento", clique em "Iniciar Treinamento". Selecione o modelo base (gpt-4o-mini recomendado por custo-benefício) e o número de épocas. O job é enviado diretamente à API da OpenAI.',
                                    code: 'Modelos base disponíveis:\n• gpt-4o-mini-2024-07-18  → recomendado (mais barato)\n• gpt-3.5-turbo-0125      → alternativa mais antiga\n\nÉpocas: 3 (padrão) — aumente para datasets pequenos',
                                    tip: 'O custo é cobrado pela OpenAI diretamente. Aprox. $3/1M tokens treinados para gpt-4o-mini.',
                                },
                                {
                                    icon: '⏱️', title: 'Acompanhando o Job', accent: '#ef4444',
                                    desc: 'Após iniciar, o job entra em fila na OpenAI. O status atualiza automaticamente: Na Fila → Validando → Treinando → Concluído. O tempo varia de minutos a horas dependendo do volume de dados.',
                                    tip: 'A página atualiza o status periodicamente. Não feche o painel durante o treinamento — mas pode fechar e voltar depois.',
                                },
                                {
                                    icon: '🤖', title: 'Passo 6 — Usar o Modelo Treinado', accent: '#6366f1',
                                    desc: 'Quando o job concluir com sucesso, o modelo fine-tunado aparece na lista com o ID gerado pela OpenAI. Vá em Configurações do Agente → aba "Geral" → campo "Modelo" e selecione o modelo treinado na lista.',
                                    tip: 'O modelo fine-tunado substitui o base apenas para o agente selecionado. Os outros agentes não são afetados.',
                                },
                            ].map((card, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderLeft: `3px solid ${card.accent}`,
                                    borderRadius: '12px', padding: '1rem 1.2rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '1rem' }}>{card.icon}</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e2e8f0' }}>{card.title}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>{card.desc}</p>
                                    {card.code && (
                                        <pre style={{
                                            margin: '10px 0 6px',
                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '8px', padding: '0.75rem 1rem',
                                            fontSize: '0.75rem', color: '#7dd3fc', overflowX: 'auto',
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: 1.7,
                                        }}>{card.code}</pre>
                                    )}
                                    {card.tip && (
                                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                            💡 {card.tip}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Fluxo */}
            <div className="ft-pipeline-steps">
                {[
                    { icon: '💬', label: '1. Conversar', desc: 'Use o Playground' },
                    { icon: '👎', label: '2. Avaliar', desc: 'Marque respostas ruins' },
                    { icon: '✏️', label: '3. Corrigir', desc: 'Escreva a resposta ideal' },
                    { icon: '✍️', label: '4. Refinar', desc: 'Edite exemplos aqui' },
                    { icon: '📦', label: '5. Exportar', desc: 'Gera o dataset JSONL' },
                    { icon: '🚀', label: '6. Treinar', desc: 'OpenAI fine-tunes o modelo' },
                    { icon: '🤖', label: '7. Usar', desc: 'Selecione nos agentes' },
                ].map((step, i) => (
                    <React.Fragment key={i}>
                        <div className="ft-pipeline-step">
                            <div className="step-bubble">{step.icon}</div>
                            <div className="step-label">{step.label}</div>
                            <div className="step-desc">{step.desc}</div>
                        </div>
                        {i < 6 && <div className="step-arrow">→</div>}
                    </React.Fragment>
                ))}
            </div>

            {/* Filtro de agente + tabs */}
            <div className="ft-controls-bar">
                <div className="ft-agent-select-wrap">
                    <label>Agente:</label>
                    <select
                        value={selectedAgentId || ''}
                        onChange={e => setSelectedAgentId(Number(e.target.value))}
                    >
                        {(agents || []).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ft-tab-pills">
                    <button
                        className={`tab-pill ${activeTab === 'dataset' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dataset')}
                    >
                        📋 Dataset ({totalExamples})
                    </button>
                    <button
                        className={`tab-pill ${activeTab === 'jobs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('jobs')}
                    >
                        🚀 Jobs de Treinamento
                    </button>
                </div>
            </div>

            {/* ===== TAB: DATASET ===== */}
            {activeTab === 'dataset' && (
                <>
                    {/* Stats */}
                    <div className="ft-stats-row">
                        <div className="ft-stat-card">
                            <div className="ft-stat-value">{totalExamples}</div>
                            <div className="ft-stat-label">Total de Exemplos</div>
                        </div>
                        <div className="ft-stat-card positive">
                            <div className="ft-stat-value">{positiveCount}</div>
                            <div className="ft-stat-label">👍 Positivos</div>
                        </div>
                        <div className="ft-stat-card negative">
                            <div className="ft-stat-value">{negativeCount}</div>
                            <div className="ft-stat-label">👎 Negativos</div>
                        </div>
                        <div className="ft-stat-card ready">
                            <div className="ft-stat-value">{withCorrectionCount}</div>
                            <div className="ft-stat-label">✏️ Com Correção</div>
                        </div>
                        <div className="ft-stat-card pending">
                            <div className="ft-stat-value">{pendingExamples}</div>
                            <div className="ft-stat-label">⏳ Prontos p/ Treinar</div>
                        </div>
                    </div>

                    {/* Progresso */}
                    <div className="ft-progress-bar-section">
                        <div className="ft-progress-label">
                            <span>Progresso para primeiro treinamento</span>
                            <span className={totalExamples >= 10 ? 'ft-ready-badge' : 'ft-not-ready-badge'}>
                                {totalExamples >= 10 ? '✅ Pronto para treinar!' : `${totalExamples}/10 mínimo`}
                            </span>
                        </div>
                        <div className="ft-progress-track">
                            <div
                                className="ft-progress-fill"
                                style={{ width: `${Math.min(100, (totalExamples / 10) * 100)}%` }}
                            />
                        </div>
                        <div className="ft-progress-hint">
                            Recomendado: 50+ exemplos para melhor qualidade de treinamento.
                        </div>
                    </div >

                    {/* Filtros + Ações */}
                    < div className="ft-filter-bar" >
                        <div className="ft-filters">
                            <select value={filterRating} onChange={e => setFilterRating(e.target.value)}>
                                <option value="all">Todos os Ratings</option>
                                <option value="positive">👍 Positivos</option>
                                <option value="negative">👎 Negativos</option>
                            </select>
                            <select value={filterExported} onChange={e => setFilterExported(e.target.value)}>
                                <option value="all">Todos os Status</option>
                                <option value="pending">⏳ Não exportados</option>
                                <option value="done">✅ Já exportados</option>
                            </select>
                            <button className="apply-filter-btn" onClick={loadFeedback}>Filtrar</button>
                        </div>
                        <div className="ft-actions">
                            <button
                                className="export-btn"
                                onClick={handleExportJsonl}
                                disabled={totalExamples === 0}
                                title={totalExamples === 0 ? 'Adicione exemplos primeiro' : 'Baixar dataset JSONL'}
                            >
                                📥 Exportar JSONL
                            </button>
                            <button
                                className="start-job-btn"
                                onClick={() => { setShowStartModal(true); setStartError(null); }}
                                disabled={totalExamples < 10}
                                title={totalExamples < 10 ? `Mínimo 10 exemplos (${totalExamples}/10)` : 'Iniciar treinamento'}
                            >
                                🚀 Iniciar Treinamento
                            </button>
                        </div>
                    </div >

                    {/* Lista */}
                    {
                        loading ? (
                            <div className="ft-loading">
                                <div className="spinner" />
                                <p>Carregando dataset...</p>
                            </div>
                        ) : feedbackList.length === 0 ? (
                            <div className="ft-empty-state">
                                <div className="ft-empty-icon">📭</div>
                                <h3>Nenhum feedback coletado ainda</h3>
                                <p>
                                    Vá ao <strong>Playground</strong>, converse com um agente e use os botões
                                    <strong> 👍 / 👎</strong> nas respostas para começar a coletar dados de treinamento.
                                </p>
                            </div>
                        ) : (
                            <div className="ft-dataset-list">
                                {(feedbackList || []).map(item => (
                                    <FeedbackItem
                                        key={item.id}
                                        item={item}
                                        onDelete={deleteHandler}
                                        onUpdate={handleUpdate}
                                        showToast={showToast}
                                    />
                                ))}
                            </div>
                        )
                    }
                </>
            )}

            {/* ===== TAB: JOBS ===== */}
            {
                activeTab === 'jobs' && (
                    <div className="ft-jobs-section">
                        <div className="ft-jobs-header">
                            <h3>Jobs de Treinamento na OpenAI</h3>
                            <div className="ft-jobs-header-actions">
                                <button
                                    className="ft-master-cleanup-btn"
                                    onClick={() => setShowCleanupModal(true)}
                                >
                                    <span className="ft-cleanup-icon-wrap">🧹</span>
                                    <div className="ft-cleanup-text-wrap">
                                        <span className="btn-label">Limpar Fantasmas</span>
                                        <span className="btn-sublabel">Remover Checkpoints</span>
                                    </div>
                                </button>
                                <button className="refresh-btn" onClick={loadJobs} disabled={loading}>
                                    {loading ? '⏳' : '🔄'} Atualizar
                                </button>
                            </div>
                        </div>

                        {loading && !jobs.length ? (
                            <div className="ft-loading"><div className="spinner" /><p>Carregando jobs...</p></div>
                        ) : jobs.length === 0 ? (
                            <div className="ft-empty-state">
                                <div className="ft-empty-icon">🚀</div>
                                <h3>Nenhum job iniciado</h3>
                                <p>Colete pelo menos 10 exemplos corrigidos e clique em <strong>"Iniciar Treinamento"</strong> na aba Dataset.</p>
                            </div>
                        ) : (
                            <div className="ft-jobs-list">
                                {jobs.map(job => {
                                    const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
                                    return (
                                        <div key={job.id} className="ft-job-card">
                                            <div className="ft-job-header">
                                                <div className="ft-job-status" style={{ color: cfg.color, background: cfg.bg }}>
                                                    {cfg.pulse && <span className="pulse-dot" style={{ background: cfg.color }} />}
                                                    {cfg.label}
                                                </div>
                                                <div className="ft-job-id">#{job.id.slice(-12)}</div>
                                            </div>
                                            <div className="ft-job-body">
                                                <div className="ft-job-row">
                                                    <span className="ft-job-key">📦 Modelo Base</span>
                                                    <span className="ft-job-val">{job.model}</span>
                                                </div>
                                                {job.fine_tuned_model && (
                                                    <div className="ft-job-row highlight">
                                                        <span className="ft-job-key">🤖 Modelo Gerado</span>
                                                        <div className="ft-job-val model-id">
                                                            <code style={!job.is_model_available ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>
                                                                {job.fine_tuned_model}
                                                            </code>
                                                            {job.is_model_available ? (
                                                                <button
                                                                    className="copy-model-btn"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(job.fine_tuned_model);
                                                                        showToast('ID copiado! Cole na configuração do agente. 🤖');
                                                                    }}
                                                                >
                                                                    📋 Copiar ID
                                                                </button>
                                                            ) : (
                                                                <span className="ft-model-deleted-label">🗑️ Removido</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {job.trained_tokens && (() => {
                                                    const cost = calcCost(job.trained_tokens, job.model);
                                                    return cost ? (
                                                        <div className="ft-job-row ft-cost-row">
                                                            <span className="ft-job-key">💰 Custo Real</span>
                                                            <span className="ft-job-val">
                                                                <span className="ft-cost-usd">${cost.usd} USD</span>
                                                                <span className="ft-cost-brl">≈ R$ {cost.brl}</span>
                                                            </span>
                                                        </div>
                                                    ) : null;
                                                })()}
                                                <div className="ft-job-row">
                                                    <span className="ft-job-key">📅 Criado em</span>
                                                    <span className="ft-job-val">{formatDate(job.created_at)}</span>
                                                </div>
                                                {job.finished_at && (
                                                    <div className="ft-job-row">
                                                        <span className="ft-job-key">🏁 Finalizado em</span>
                                                        <span className="ft-job-val">{formatDate(job.finished_at)}</span>
                                                    </div>
                                                )}
                                                {job.error && (
                                                    <div className="ft-job-error">❌ {job.error}</div>
                                                )}
                                            </div>
                                            {job.fine_tuned_model && job.is_model_available && (
                                                <div className="ft-job-actions">
                                                    <div className="ft-job-tip">
                                                        💡 <strong>Pronto!</strong> Copie o ID e cole na configuração do agente.
                                                    </div>
                                                    <button
                                                        className="ft-delete-model-btn"
                                                        onClick={() => setConfirmDeleteModel(job.fine_tuned_model)}
                                                    >
                                                        🗑️ Deletar Modelo da OpenAI
                                                    </button>
                                                </div>
                                            )}
                                            {job.fine_tuned_model && !job.is_model_available && (
                                                <div className="ft-job-actions disabled">
                                                    <div className="ft-job-tip">
                                                        ⚪ Este modelo foi removido da sua conta OpenAI.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Modal: Confirmar deleção de modelo principal */}
            {
                confirmDeleteModel && (
                    <div className="modal-overlay fade-in" onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteModel(null); }}>
                        <div className="ft-confirm-modal">
                            <div className="ft-confirm-icon badge-red">⚠️</div>
                            <h3 className="ft-confirm-title">Deletar Modelo da OpenAI?</h3>
                            <p className="ft-confirm-subtitle">
                                Esta ação é <strong>irreversível</strong>. O modelo será permanentemente removido da sua conta OpenAI e não poderá mais ser usado em nenhuma plataforma.
                            </p>
                            <div className="ft-confirm-model-id">
                                <code>{confirmDeleteModel}</code>
                            </div>
                            <div className="ft-confirm-actions">
                                <button className="ft-confirm-cancel" onClick={() => setConfirmDeleteModel(null)} disabled={deletingModel}>
                                    Manter Modelo
                                </button>
                                <button className="ft-confirm-delete" onClick={handleDeleteModel} disabled={deletingModel}>
                                    {deletingModel ? '⏳ Deletando...' : '🗑️ Sim, deletar modelo'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal: Limpeza Mestra de Checkpoints */}
            {
                showCleanupModal && (
                    <div className="modal-overlay fade-in" onClick={e => { if (e.target === e.currentTarget) setShowCleanupModal(false); }}>
                        <div className="ft-confirm-modal cleanup">
                            <div className="ft-confirm-icon badge-purple">🧹</div>
                            <h3 className="ft-confirm-title">Limpeza de Checkpoints</h3>
                            <p className="ft-confirm-subtitle">
                                Deseja remover todos os <strong>modelos intermediários (:ckpt)</strong> da sua conta OpenAI?
                            </p>
                            <div className="ft-cleanup-warning">
                                <div className="ft-warning-item">
                                    <span className="dot"></span>
                                    <p>Limpa a lista de modelos no <strong>n8n</strong> e outras ferramentas.</p>
                                </div>
                                <div className="ft-warning-item">
                                    <span className="dot"></span>
                                    <p>Seus modelos finalizados <strong>NÃO</strong> serão apagados.</p>
                                </div>
                                <div className="ft-warning-item">
                                    <span className="dot"></span>
                                    <p>Ação definitiva: remove apenas rascunhos (:ckpt).</p>
                                </div>
                            </div>
                            <div className="ft-confirm-actions">
                                <button className="ft-confirm-cancel" onClick={() => setShowCleanupModal(false)} disabled={cleaningCheckpoints}>
                                    Agora não
                                </button>
                                <button className="ft-confirm-execute" onClick={handleCleanupCheckpoints} disabled={cleaningCheckpoints}>
                                    {cleaningCheckpoints ? '⏳ Limpando...' : '✨ Confirmar Limpeza'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal: Iniciar Treinamento */}
            {
                showStartModal && (
                    <div className="modal-overlay fade-in" onClick={e => { if (e.target === e.currentTarget) setShowStartModal(false); }}>
                        <div className="modal-content ft-start-modal">
                            <div className="modal-header">
                                <div className="ft-modal-icon">🚀</div>
                                <div>
                                    <h3>Iniciar Fine-Tuning</h3>
                                    <p className="subtitle">Configure e inicie o treinamento do seu modelo</p>
                                </div>
                                <button className="close-btn-top-right" onClick={() => setShowStartModal(false)}>✕</button>
                            </div>

                            <div className="modal-body-scroll">
                                <div className="ft-modal-info">
                                    <div className="ft-info-item">
                                        <span>📋 Exemplos no dataset</span>
                                        <strong>{totalExamples}</strong>
                                    </div>
                                    <div className="ft-info-item">
                                        <span>🤖 Agente</span>
                                        <strong>{agents.find(a => a.id === selectedAgentId)?.name}</strong>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Modelo Base</label>
                                    <select
                                        value={jobConfig.base_model}
                                        onChange={e => setJobConfig(prev => ({ ...prev, base_model: e.target.value }))}
                                    >
                                        <option value="gpt-4o-mini-2024-07-18">gpt-4o-mini-2024-07-18 (Recomendado — Custo baixo)</option>
                                        <option value="gpt-3.5-turbo-0125">gpt-3.5-turbo-0125 (Ultra econômico)</option>
                                    </select>
                                    <span className="field-hint">O modelo fine-tuned terá o prefixo ft: seguido deste modelo base.</span>
                                </div>

                                <div className="form-group">
                                    <label>Apelido do Modelo (Sufixo)</label>
                                    <input
                                        type="text"
                                        maxLength={18}
                                        placeholder="Ex: vendas-v1 (opcional)"
                                        value={jobConfig.suffix || ''}
                                        onChange={e => setJobConfig(prev => ({ ...prev, suffix: e.target.value.replace(/\s+/g, '-').toLowerCase() }))}
                                    />
                                    <span className="field-hint">Aparecerá no ID do modelo (máx 18 caracteres, sem espaços).</span>
                                </div>

                                <div className="form-group">
                                    <label>Épocas de Treinamento: <strong>{jobConfig.n_epochs}</strong></label>
                                    <input
                                        type="range" min={1} max={10} step={1}
                                        value={jobConfig.n_epochs}
                                        onChange={e => setJobConfig(prev => ({ ...prev, n_epochs: Number(e.target.value) }))}
                                    />
                                    <span className="field-hint">
                                        3–5 épocas é o ideal para a maioria dos casos. Mais épocas = mais treinamento, porém mais caro.
                                    </span>
                                </div>

                                <div className="ft-cost-estimate">
                                    <div className="ft-cost-icon">💰</div>
                                    <div>
                                        <strong>Estimativa de Custo</strong>
                                        <p>~${((totalExamples * 200 * jobConfig.n_epochs) / 1_000_000 * 3).toFixed(4)} USD para {totalExamples} exemplos × {jobConfig.n_epochs} épocas</p>
                                        <small>Baseado em ~200 tokens/exemplo × $3/1M token no gpt-4o-mini fine-tune.</small>
                                    </div>
                                </div>

                                {startError && (
                                    <div className="ft-error-msg">❌ {startError}</div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button className="ft-confirm-cancel" onClick={() => setShowStartModal(false)}>Cancelar</button>
                                <button className="ft-launch-train-btn" onClick={handleStartJob} disabled={startingJob}>
                                    {startingJob ? '⏳ Iniciando...' : '🚀 Confirmar e Iniciar Treino'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FineTuning;
