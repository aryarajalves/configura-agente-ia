import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';

const SupportDashboard = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals states
    const [summaryModal, setSummaryModal] = useState(null);
    const [summarizing, setSummarizing] = useState(false);

    const [confirmResolve, setConfirmResolve] = useState(null);

    const [chatModal, setChatModal] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);

    const [configModal, setConfigModal] = useState(false);
    const [configVars, setConfigVars] = useState([
        { name: 'nome', description: '' },
        { name: 'telefone', description: '' },
        { name: 'email', description: '' },
        { name: 'problema', description: '' }
    ]);
    const [configVarId, setConfigVarId] = useState(null);
    const [savingConfig, setSavingConfig] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [expandedField, setExpandedField] = useState(null); // { varIndex, field: 'name'|'description', tempValue }
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [publicToken, setPublicToken] = useState('');
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    const navigate = useNavigate();

    const fetchRequests = async () => {
        try {
            const res = await api.get('/support-requests');

            if (!res.ok) {
                console.error("Erro na resposta da API:", res.status);
                setRequests([]);
                return;
            }

            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Erro ao buscar solicitações:", err);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 30000); // Atualiza a cada 30s

        const fetchPublicToken = async () => {
            try {
                const res = await api.get('/settings/public-tokens');
                if (res.ok) {
                    const data = await res.json();
                    setPublicToken(data.PUBLIC_ACCESS_TOKEN_SUPPORT || '');
                }
            } catch (e) {
                console.error("Erro ao buscar token público", e);
            }
        };
        fetchPublicToken();

        return () => clearInterval(interval);
    }, []);

    const handleCopyPublicLink = () => {
        if (!publicToken) return;
        const link = `${window.location.origin}/public/support/${publicToken}`;
        navigator.clipboard.writeText(link);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 3000);
    };

    const handleResolveClick = (req) => {
        setConfirmResolve(req);
    };

    const confirmResolveAction = async () => {
        if (!confirmResolve) return;
        const id = confirmResolve.id;

        try {
            const res = await api.request(`/support-requests/${id}/resolve`, { method: 'PATCH' });
            if (res.ok) {
                setRequests(prev => prev.filter(r => r.id !== id));
            } else {
                alert("Erro ao finalizar atendimento");
            }
        } catch (err) {
            alert("Erro ao finalizar atendimento");
        } finally {
            setConfirmResolve(null);
        }
    };

    const handleGetSummary = async (request) => {
        setSummarizing(true);
        setSummaryModal({ ...request, loading: true });

        try {
            const res = await api.post('/support-requests/generate-summary', {
                session_id: request.session_id,
                agent_id: request.agent_id
            });
            const data = await res.json();
            setSummaryModal({ ...request, ...data, loading: false });
        } catch (err) {
            setSummaryModal({ ...request, summary: "Erro ao gerar resumo.", reason: "Indisponível.", loading: false });
        } finally {
            setSummarizing(false);
        }
    };

    const handleOpenChat = async (request) => {
        setChatModal(request);
        setChatLoading(true);
        setChatMessages([]);
        try {
            const res = await api.get(`/sessions/${request.session_id}/messages`);
            if (res.ok) {
                const msgs = await res.json();
                setChatMessages(msgs);
            }
        } catch (e) {
            console.error("Erro ao carregar chat", e);
        } finally {
            setChatLoading(false);
        }
    };

    const handleOpenConfig = async () => {
        setConfigModal(true);
        try {
            const res = await api.get('/global-variables');
            if (res.ok) {
                const vars = await res.json();
                const target = vars.find(v => v.key === 'support_extracted_variables');
                if (target) {
                    try {
                        const parsed = JSON.parse(target.value);
                        if (Array.isArray(parsed)) {
                            setConfigVars(parsed);
                        } else {
                            setConfigVars(target.value.split(',').map(n => ({ name: n.trim(), description: '' })).filter(v => v.name));
                        }
                    } catch (e) {
                        setConfigVars(target.value.split(',').map(n => ({ name: n.trim(), description: '' })).filter(v => v.name));
                    }
                    setConfigVarId(target.id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const addVar = () => setConfigVars([...configVars, { name: '', description: '' }]);
    const removeVar = (index) => setConfigVars(configVars.filter((_, i) => i !== index));
    const updateVar = (index, field, value) => {
        const newVars = [...configVars];
        newVars[index][field] = value;
        setConfigVars(newVars);
    };

    const saveConfig = async () => {
        setSavingConfig(true);
        const payloadStr = JSON.stringify(configVars.filter(v => v.name.trim()));
        try {
            if (configVarId) {
                await api.put(`/global-variables/${configVarId}`, {
                    key: 'support_extracted_variables',
                    value: payloadStr,
                    type: 'json',
                    description: 'Variáveis configuradas para extração automática no transbordo de suporte'
                });
            } else {
                const res = await api.post('/global-variables', {
                    key: 'support_extracted_variables',
                    value: payloadStr,
                    type: 'json',
                    description: 'Variáveis configuradas para extração automática no transbordo de suporte'
                });
                if (res.ok) {
                    const data = await res.json();
                    setConfigVarId(data.id);
                }
            }
            setShowSaveSuccess(true);
            setConfigModal(false);
        } catch (e) {
            alert("Erro ao salvar configuração.");
        } finally {
            setSavingConfig(false);
        }
    };

    const formatBrasiliaTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
        return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };

    const getTimeWaiting = (dateStr) => {
        if (!dateStr) return '';
        const diff = new Date() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Agora mesmo";
        if (mins < 60) return `Há ${mins} min`;
        return `Há ${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    if (loading) return (
        <div className="support-dashboard loading-state">
            <div className="spinner"></div>
            <p>Carregando fila de suporte...</p>
        </div>
    );

    return (
        <div className="support-dashboard">
            <header className="page-header">
                <div>
                    <h1 className="page-title">🎧 Suporte Humano</h1>
                    <p className="page-subtitle">Gerencie os transbordos e ajudas solicitadas pelos usuários.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setShowGuide(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)',
                            border: '1px solid rgba(99,102,241,0.35)',
                            color: '#a5b4fc', borderRadius: '12px',
                            padding: '9px 18px', fontSize: '0.85rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <span style={{ fontSize: '1rem' }}>📖</span> Guia
                    </button>
                    <button
                        onClick={handleOpenConfig}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)',
                            border: '1px solid rgba(99,102,241,0.35)',
                            color: '#a5b4fc', borderRadius: '12px',
                            padding: '9px 18px', fontSize: '0.85rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; }}
                    >
                        <span style={{ fontSize: '1rem' }}>⚙️</span> Configurar Variáveis
                    </button>
                    <button
                        onClick={handleCopyPublicLink}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: showCopySuccess ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)',
                            border: '1px solid ' + (showCopySuccess ? '#10b981' : 'rgba(16, 185, 129, 0.35)'),
                            color: showCopySuccess ? '#4ade80' : '#10b981', borderRadius: '12px',
                            padding: '9px 18px', fontSize: '0.85rem', fontWeight: 800,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { if(!showCopySuccess) { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; e.currentTarget.style.transform = 'scale(1.03)'; } }}
                        onMouseLeave={e => { if(!showCopySuccess) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; } }}
                    >
                        <span style={{ fontSize: '1rem' }}>{showCopySuccess ? '✅' : '🔗'}</span>
                        {showCopySuccess ? 'Link Copiado!' : 'Link Público'}
                    </button>
                    <div className="badge-total">
                        {Array.isArray(requests) ? requests.length : 0} na fila
                    </div>
                </div>
            </header>

            <div className="config-tip">
                <div className="tip-icon">💡</div>
                <div className="tip-content">
                    <strong>Configuração:</strong> O suporte é acionado via Ferramenta (Webhook) que contenha no nome:
                    <code>suporte</code>, <code>atendente</code> ou <code>humano</code>.
                    A resposta do Webhook deve conter <code>"success": true</code>.
                </div>
            </div>

            <div className="support-grid">
                {!Array.isArray(requests) || requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">✅</div>
                        <h3>Tudo limpo!</h3>
                        <p>Não há solicitações de suporte pendentes no momento.</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.id} className="support-card animate-in">
                            <div className="card-header">
                                <div className="user-info">
                                    <div className="user-avatar-small">
                                        {(req.user_name || "U")[0]}
                                    </div>
                                    <div>
                                        <h3>{req.user_name || "Usuário Anônimo"}</h3>
                                        <span>{req.user_email || 'Email não informado'}</span>
                                    </div>
                                </div>
                                <div className="wait-time" title={formatBrasiliaTime(req.created_at)}>
                                    {getTimeWaiting(req.created_at)}
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <label>Agente:</label>
                                    <span>{req.agent_name}</span>
                                </div>
                                <div className="info-row">
                                    <label>Sessão:</label>
                                    <code className="session-code">{req.session_id.slice(0, 8)}...</code>
                                </div>

                                {req.extracted_data && Object.keys(req.extracted_data).length > 0 && (
                                    <div className="extracted-vars">
                                        {Object.entries(req.extracted_data).map(([key, val]) => (
                                            <div key={key} className="var-tag">
                                                <span className="var-key">{key}:</span> {String(val)}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <p className="reason-preview">
                                    <strong>Motivo:</strong> {req.reason || "Aguardando diagnóstico..."}
                                </p>
                            </div>

                            <div className="card-footer">
                                <button className="btn-secondary-sm" onClick={() => handleGetSummary(req)}>
                                    ⚡ Raio-X
                                </button>
                                <button className="btn-primary-sm" onClick={() => handleOpenChat(req)}>
                                    💬 LER CHAT
                                </button>
                                <button className="btn-success-sm" onClick={() => handleResolveClick(req)}>
                                    ✅ Finalizar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Guia Suporte Humano */}
            {showGuide && (
                <div
                    onClick={() => setShowGuide(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(2,6,23,0.85)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '20px', width: '100%', maxWidth: '700px',
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.3rem 1.8rem',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            flexShrink: 0,
                        }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                🎧 Guia do Suporte Humano
                            </span>
                            <button
                                onClick={() => setShowGuide(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                    cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                            >✕</button>
                        </div>

                        {/* Body */}
                        <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            {[
                                { icon: '🎧', title: 'O que é o Suporte Humano?', accent: '#a5b4fc',
                                  desc: <>Painel que exibe em tempo real todos os <strong style={{color:'#e2e8f0'}}>transbordos solicitados</strong> pelos agentes de IA. Quando um usuário precisa de atendimento humano, um card aparece aqui para você agir.</>,
                                  code: <><span style={{color:'#475569'}}>{'// Ciclo de vida de um transbordo:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Usuário solicita ajuda humana{'\n'}</span><span style={{color:'#a5b4fc'}}>→ Agente aciona a ferramenta de suporte{'\n'}</span><span style={{color:'#4ade80'}}>→ Card aparece nesta fila{'\n'}</span><span style={{color:'#94a3b8'}}>→ Humano atende e clica "Finalizar"</span></>,
                                  tip: 'A fila atualiza automaticamente a cada 30 segundos. Você também pode recarregar a página manualmente.' },
                                { icon: '🔗', title: 'Como acionar o transbordo', accent: '#4ade80',
                                  desc: <>O transbordo é ativado quando o agente chama uma <strong style={{color:'#e2e8f0'}}>Ferramenta (Webhook)</strong> cujo nome contenha as palavras-chave reconhecidas pelo sistema.</>,
                                  code: <><span style={{color:'#475569'}}>{'// Nomes de ferramenta reconhecidos:'}</span>{'\n'}<span style={{color:'#4ade80'}}>suporte_humano</span>{' → '}<span style={{color:'#94a3b8'}}>✅ Reconhecido{'\n'}</span><span style={{color:'#4ade80'}}>chamar_atendente</span>{' → '}<span style={{color:'#94a3b8'}}>✅ Reconhecido{'\n'}</span><span style={{color:'#4ade80'}}>falar_com_humano</span>{' → '}<span style={{color:'#94a3b8'}}>✅ Reconhecido{'\n'}</span><span style={{color:'#f87171'}}>escalar_ticket</span>{' → '}<span style={{color:'#94a3b8'}}>❌ Não reconhecido</span></>,
                                  tip: 'O webhook deve retornar {"success": true} para o sistema confirmar o transbordo. Configure o webhook em Habilidades → Ferramentas.' },
                                { icon: '📋', title: 'O que cada card mostra', accent: '#fbbf24',
                                  desc: <>Cada card na fila exibe as informações do usuário coletadas automaticamente pelo agente antes do transbordo.</>,
                                  code: <><span style={{color:'#fbbf24'}}>Nome / Email</span>{' → '}<span style={{color:'#94a3b8'}}>Identificação do usuário{'\n'}</span><span style={{color:'#fbbf24'}}>Agente</span>{' → '}<span style={{color:'#94a3b8'}}>Qual IA originou o transbordo{'\n'}</span><span style={{color:'#fbbf24'}}>Sessão</span>{' → '}<span style={{color:'#94a3b8'}}>ID único da conversa{'\n'}</span><span style={{color:'#fbbf24'}}>Tempo de espera</span>{' → '}<span style={{color:'#94a3b8'}}>Há quanto tempo aguarda{'\n'}</span><span style={{color:'#fbbf24'}}>Motivo</span>{' → '}<span style={{color:'#94a3b8'}}>Motivo detectado pelo agente{'\n'}</span><span style={{color:'#fbbf24'}}>Variáveis extraídas</span>{' → '}<span style={{color:'#94a3b8'}}>Dados coletados (nome, CPF, etc.)</span></>,
                                  tip: '' },
                                { icon: '⚡', title: 'Botão Raio-X', accent: '#38bdf8',
                                  desc: <>Gera um <strong style={{color:'#e2e8f0'}}>resumo inteligente</strong> da conversa usando IA, apontando o histórico, o problema central e o motivo do transbordo.</>,
                                  code: <><span style={{color:'#38bdf8'}}>🚀 O que aconteceu:</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Usuário perguntou sobre prazo de entrega, informou que o pedido #1234 está atrasado há 5 dias..."}{'\n\n'}</span><span style={{color:'#38bdf8'}}>💡 Motivo do Transbordo:</span>{'\n'}<span style={{color:'#94a3b8'}}>Reclamação sobre atraso que excede política de SLA.</span></>,
                                  tip: 'Use o Raio-X antes de ler o chat completo para economizar tempo e já chegar na conversa com contexto.' },
                                { icon: '⚙️', title: 'Variáveis de Coleta Automática', accent: '#c084fc',
                                  desc: <>Lista de dados que o agente deve <strong style={{color:'#e2e8f0'}}>tentar extrair da conversa</strong> antes de transferir para humano. O agente pergunta proativamente ao usuário caso os dados não estejam disponíveis.</>,
                                  code: <><span style={{color:'#475569'}}>{'// Variáveis padrão recomendadas:'}</span>{'\n'}<span style={{color:'#c084fc'}}>nome</span>{' → '}<span style={{color:'#94a3b8'}}>Nome completo do usuário{'\n'}</span><span style={{color:'#c084fc'}}>telefone</span>{' → '}<span style={{color:'#94a3b8'}}>Número para contato{'\n'}</span><span style={{color:'#c084fc'}}>email</span>{' → '}<span style={{color:'#94a3b8'}}>E-mail de retorno{'\n'}</span><span style={{color:'#c084fc'}}>problema</span>{' → '}<span style={{color:'#94a3b8'}}>Descrição do problema em aberto</span></>,
                                  tip: 'Quanto mais dados coletados antes do transbordo, menos o atendente humano precisa perguntar novamente. Acelera muito o atendimento.' },
                                { icon: '✏️', title: 'Como configurar as variáveis', accent: '#34d399',
                                  desc: <>Clique em <strong style={{color:'#e2e8f0'}}>"Configurar Variáveis"</strong> para definir quais dados coletar. Cada variável tem um nome (chave) e uma instrução opcional para guiar a IA na extração.</>,
                                  code: <><span style={{color:'#475569'}}>{'// Exemplos avançados por setor:'}</span>{'\n'}<span style={{color:'#34d399'}}>cpf</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"CPF do cliente para consulta no sistema\""}{'\n'}</span><span style={{color:'#34d399'}}>numero_pedido</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Número do pedido relacionado ao problema\""}{'\n'}</span><span style={{color:'#34d399'}}>urgencia</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Nível de urgência: baixo, médio ou alto\""}{'\n'}</span><span style={{color:'#34d399'}}>plano</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Plano ou produto contratado pelo cliente\""}</span></>,
                                  tip: 'A instrução/descrição é enviada para a IA para ela saber exatamente como perguntar e interpretar a resposta. Seja específico.' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderLeft: `3px solid ${item.accent}`,
                                    borderRadius: '12px', padding: '1.1rem 1.3rem',
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                        {item.icon} {item.title}
                                    </div>
                                    <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                    <pre style={{
                                        background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                        padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                        margin: item.tip ? '0 0 0.75rem' : '0', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                        border: '1px solid rgba(255,255,255,0.04)',
                                    }}>{item.code}</pre>
                                    {item.tip && (
                                        <div style={{
                                            background: 'rgba(99,102,241,0.07)',
                                            border: '1px solid rgba(99,102,241,0.12)',
                                            borderRadius: '8px', padding: '8px 11px',
                                            fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                        }}>
                                            <strong style={{ color: item.accent }}>Dica: </strong>{item.tip}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {configModal && (
                <div
                    onClick={() => setConfigModal(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(2,6,23,0.8)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '20px', width: '100%', maxWidth: '600px',
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.3rem 1.8rem',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            flexShrink: 0,
                        }}>
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    ⚙️ Variáveis de Coleta Automática
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#475569' }}>
                                    Dados que o agente extrai antes de transferir para humano
                                </p>
                            </div>
                            <button
                                onClick={() => setConfigModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                    cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s', flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                            >✕</button>
                        </div>

                        {/* Body */}
                        <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
                            <div style={{
                                background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)',
                                borderRadius: '10px', padding: '10px 14px',
                                fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.55, marginBottom: '0.5rem',
                            }}>
                                Defina quais dados o Agente deve <strong style={{ color: '#e2e8f0' }}>obrigatoriamente</strong> tentar extrair da conversa antes de transferir o atendimento para um humano.
                            </div>

                            {configVars.map((v, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderLeft: '3px solid rgba(99,102,241,0.5)',
                                    borderRadius: '12px', padding: '1rem 1.2rem',
                                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                                    transition: 'border-color 0.2s',
                                }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Campo Nome */}
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder="Nome da variável  (ex: cpf, email, motivo)"
                                                value={v.name}
                                                onChange={(e) => updateVar(i, 'name', e.target.value)}
                                                style={{
                                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '8px', padding: '8px 12px',
                                                    color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600,
                                                    outline: 'none', flex: 1, boxSizing: 'border-box',
                                                }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                                            />
                                            <button
                                                title="Expandir campo"
                                                onClick={() => setExpandedField({ varIndex: i, field: 'name', tempValue: v.name })}
                                                style={{
                                                    background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                                                    color: '#818cf8', borderRadius: '7px', width: '30px', height: '30px',
                                                    cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0, transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = '#a5b4fc'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.transform = 'scale(1)'; }}
                                            >↗</button>
                                        </div>
                                        {/* Campo Descrição */}
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder="Instrução ou descrição para a IA (Opcional)"
                                                value={v.description}
                                                onChange={(e) => updateVar(i, 'description', e.target.value)}
                                                style={{
                                                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '8px', padding: '7px 12px',
                                                    color: '#94a3b8', fontSize: '0.8rem',
                                                    outline: 'none', flex: 1, boxSizing: 'border-box',
                                                }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                                            />
                                            <button
                                                title="Expandir campo"
                                                onClick={() => setExpandedField({ varIndex: i, field: 'description', tempValue: v.description })}
                                                style={{
                                                    background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                                                    color: '#818cf8', borderRadius: '7px', width: '30px', height: '30px',
                                                    cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0, transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = '#a5b4fc'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.transform = 'scale(1)'; }}
                                            >↗</button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeVar(i)}
                                        title="Remover variável"
                                        style={{
                                            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                                            color: '#f87171', borderRadius: '8px', width: '34px', height: '34px',
                                            cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s', flexShrink: 0, marginTop: '1px',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.2)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                    >✕</button>
                                </div>
                            ))}

                            <button
                                onClick={addVar}
                                style={{
                                    background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.3)',
                                    borderRadius: '12px', padding: '10px', color: '#818cf8',
                                    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                    transition: 'all 0.2s', marginTop: '4px',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.14)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                            >
                                + Adicionar Parâmetro
                            </button>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', gap: '10px',
                            padding: '1.1rem 1.8rem',
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            flexShrink: 0,
                        }}>
                            <button
                                onClick={() => setConfigModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#94a3b8', borderRadius: '10px', padding: '9px 20px',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >Cancelar</button>
                            <button
                                onClick={saveConfig}
                                disabled={savingConfig}
                                style={{
                                    background: savingConfig ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    border: 'none', color: '#fff', borderRadius: '10px',
                                    padding: '9px 24px', fontSize: '0.85rem', fontWeight: 700,
                                    cursor: savingConfig ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    boxShadow: savingConfig ? 'none' : '0 4px 15px rgba(99,102,241,0.35)',
                                }}
                                onMouseEnter={e => { if (!savingConfig) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)'; } }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.35)'; }}
                            >
                                {savingConfig ? '⏳ Salvando...' : '💾 Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Expandido — Edição Focada de Campo */}
            {expandedField && (
                <div
                    onClick={() => setExpandedField(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        background: 'rgba(2,6,23,0.88)',
                        backdropFilter: 'blur(14px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '2rem',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '20px', width: '100%', maxWidth: '680px',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(99,102,241,0.08)',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.3rem 1.8rem',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>✏️</span>
                                    <span>{expandedField.field === 'name' ? 'Nome da Variável' : 'Instrução para a IA'}</span>
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: 700, color: '#6366f1',
                                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                                        borderRadius: '5px', padding: '1px 7px',
                                    }}>VARIÁVEL #{expandedField.varIndex + 1}</span>
                                </div>
                                <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#475569' }}>
                                    {expandedField.field === 'name'
                                        ? 'Chave usada pelo sistema para identificar e exibir o dado coletado.'
                                        : 'Instrução enviada à IA para saber como perguntar e interpretar este dado.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setExpandedField(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                    cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s', flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                            >✕</button>
                        </div>

                        {/* Body — Textarea grande */}
                        <div style={{ padding: '1.6rem 1.8rem' }}>
                            <textarea
                                autoFocus
                                value={expandedField.tempValue}
                                onChange={e => setExpandedField(prev => ({ ...prev, tempValue: e.target.value }))}
                                placeholder={expandedField.field === 'name'
                                    ? 'Ex: cpf, email, numero_pedido, urgencia...'
                                    : 'Ex: "Pergunte o CPF do cliente de forma educada para que possamos consultar o pedido no sistema. Caso o cliente não saiba, peça o e-mail como alternativa."'}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(99,102,241,0.3)',
                                    borderRadius: '12px', padding: '1.1rem 1.3rem',
                                    color: expandedField.field === 'name' ? '#e2e8f0' : '#94a3b8',
                                    fontSize: expandedField.field === 'name' ? '1rem' : '0.88rem',
                                    fontWeight: expandedField.field === 'name' ? 700 : 400,
                                    fontFamily: expandedField.field === 'name' ? "'JetBrains Mono', 'Fira Code', monospace" : 'inherit',
                                    lineHeight: 1.7, resize: 'vertical',
                                    minHeight: expandedField.field === 'name' ? '64px' : '180px',
                                    outline: 'none',
                                    boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.12)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                            />
                            <p style={{ marginTop: '8px', fontSize: '0.73rem', color: '#334155' }}>
                                {expandedField.field === 'name'
                                    ? 'Use letras minúsculas e underscore. Ex: numero_pedido, data_nascimento'
                                    : 'Quanto mais detalhada a instrução, mais precisa será a extração pelo agente.'}
                            </p>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', gap: '10px',
                            padding: '1rem 1.8rem',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <button
                                onClick={() => setExpandedField(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#94a3b8', borderRadius: '10px', padding: '9px 20px',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >Cancelar</button>
                            <button
                                onClick={() => {
                                    updateVar(expandedField.varIndex, expandedField.field, expandedField.tempValue);
                                    setExpandedField(null);
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    border: 'none', color: '#fff', borderRadius: '10px',
                                    padding: '9px 24px', fontSize: '0.85rem', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(99,102,241,0.5)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.35)'; }}
                            >✓ Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {summaryModal && (
                <div className="modal-overlay" onClick={() => setSummaryModal(null)}>
                    <div className="modal-content-wide" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <h2>Resumo do Atendimento</h2>
                            <button className="close-btn" onClick={() => setSummaryModal(null)}>&times;</button>
                        </header>

                        {summaryModal.loading ? (
                            <div className="modal-body text-center">
                                <div className="spinner"></div>
                                <p>IA está analisando a conversa...</p>
                            </div>
                        ) : (
                            <div className="modal-body">
                                <div className="summary-section">
                                    <h3>🚀 O que aconteceu:</h3>
                                    <div className="summary-text">
                                        {summaryModal.summary?.split('\n').map((line, i) => (
                                            <p key={i}>{line}</p>
                                        ))}
                                    </div>
                                </div>
                                <div className="reason-section">
                                    <h3>💡 Motivo do Transbordo:</h3>
                                    <p className="reason-text">{summaryModal.reason}</p>
                                </div>
                            </div>
                        )}
                        <footer className="modal-footer">
                            <button className="btn-primary" onClick={() => setSummaryModal(null)}>
                                Fechar
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {chatModal && (
                <div className="modal-overlay" onClick={() => setChatModal(null)}>
                    <div className="modal-content-wide" onClick={e => e.stopPropagation()} style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                        <header className="modal-header">
                            <h2>Histórico de Chat <span>({chatModal.user_name || 'Anônimo'})</span></h2>
                            <button className="close-btn" onClick={() => setChatModal(null)}>&times;</button>
                        </header>
                        <div className="modal-body chat-history-view" style={{ flexGrow: 1, overflowY: 'auto', background: '#0f172a', borderRadius: '8px', padding: '1.5rem', marginTop: '1rem' }}>
                            {chatLoading ? (
                                <div className="text-center" style={{ padding: '3rem' }}><div className="spinner"></div></div>
                            ) : chatMessages.length === 0 ? (
                                <p className="text-center" style={{ color: '#94a3b8', padding: '3rem' }}>Nenhuma mensagem encontrada.</p>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} className={`chat-bubble-history ${msg.type === 'user' ? 'user' : 'agent'}`}>
                                        <div className="msg-content">{msg.text}</div>
                                        <div className="msg-time">{formatBrasiliaTime(msg.timestamp)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Sucesso ao Salvar Configurações */}
            {showSaveSuccess && (
                <div 
                    className="save-success-overlay" 
                    onClick={() => setShowSaveSuccess(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100000,
                        background: 'rgba(2, 6, 23, 0.9)',
                        backdropFilter: 'blur(16px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '2rem', animation: 'fadeIn 0.4s ease'
                    }}
                >
                    <div 
                        className="save-success-card" 
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(135deg, #161d2f 0%, #0f172a 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            borderRadius: '32px', width: '100%', maxWidth: '440px',
                            padding: '40px', textAlign: 'center',
                            boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 50px rgba(99, 102, 241, 0.15)',
                            animation: 'cardPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 24px' }}>
                            <div className="success-pulse-ring" style={{
                                position: 'absolute', inset: 0, background: 'rgba(99, 102, 241, 0.2)',
                                borderRadius: '24px', animation: 'successPulse 2s infinite'
                            }}></div>
                            <div style={{
                                position: 'relative', width: '100%', height: '100%', borderRadius: '24px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2.5rem', color: 'white', border: '2px solid rgba(255,255,255,0.1)'
                            }}>✨</div>
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', marginBottom: '12px' }}>Salvo com Sucesso!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>
                            As variáveis de extração automática foram atualizadas e já estão ativas para os próximos atendimentos.
                        </p>
                        <button 
                            onClick={() => setShowSaveSuccess(false)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                                background: 'white', color: '#0f172a', fontWeight: 800, fontSize: '0.95rem',
                                cursor: 'pointer', transition: 'all 0.3s ease',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'white'; }}
                        >
                            FECHAR
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmResolve}
                onCancel={() => setConfirmResolve(null)}
                onConfirm={confirmResolveAction}
                title="Finalizar Atendimento"
                message={`Deseja marcar o atendimento de ${confirmResolve?.user_name || 'Usuário'} como concluído? Ele será limpo da sua tela de Transbordos.`}
                confirmText="Concluir Atendimento"
                cancelText="Cancelar"
                type="primary"
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .support-dashboard { padding: 2rem; color: #fff; max-width: 1400px; margin: 0 auto; }
                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .page-title { margin: 0; font-size: 1.8rem; font-weight: 700; color: #f8fafc; }
                .page-subtitle { color: #94a3b8; font-size: 0.95rem; margin-top: 0.25rem; }

                .config-tip { display: flex; gap: 1rem; align-items: center; background: rgba(99, 102, 241, 0.05); border: 1px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 1rem 1.5rem; margin-bottom: 2rem; }
                .tip-icon { font-size: 1.5rem; }
                .tip-content { font-size: 0.9rem; color: #cbd5e1; line-height: 1.5; }
                .tip-content strong { color: #818cf8; margin-right: 4px; }
                .tip-content code { background: rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 4px; margin: 0 0.2rem; color: #f8fafc; }

                .support-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
                .support-card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; backdrop-filter: blur(10px); display: flex; flex-direction: column; transition: transform 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .support-card:hover { transform: translateY(-5px); border-color: rgba(99, 102, 241, 0.5); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
                .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .user-info { display: flex; gap: 0.75rem; align-items: center; }
                .user-avatar-small { width: 40px; height: 40px; background: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; color: white; }
                .user-info h3 { margin: 0; font-size: 1rem; color: white; }
                .user-info span { font-size: 0.8rem; color: #94a3b8; }
                .wait-time { font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0.35rem 0.6rem; border-radius: 8px; font-weight: 500; font-family: monospace; }
                .card-body { flex-grow: 1; margin-bottom: 1.5rem; font-size: 0.9rem; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
                .info-row label { color: #94a3b8; }
                .session-code { background: rgba(0,0,0,0.3); padding: 0 0.4rem; border-radius: 4px; color: #cbd5e1; font-family: monospace; }
                .reason-preview { margin-top: 1.2rem; padding: 0.75rem 1rem; background: rgba(15, 23, 42, 0.6); border-left: 3px solid #6366f1; border-radius: 6px; color: #e2e8f0; }
                
                .extracted-vars { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
                .var-tag { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.8rem; color: #e2e8f0; }
                .var-key { color: #818cf8; font-weight: bold; text-transform: capitalize; margin-right: 4px; }

                .card-footer { display: flex; gap: 0.5rem; }
                .btn-primary-sm, .btn-secondary-sm, .btn-success-sm { flex: 1; padding: 0.6rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; border: none; font-weight: 600; transition: all 0.2s; }
                .btn-primary-sm { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
                .btn-secondary-sm { background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }
                .btn-success-sm { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
                .btn-primary-sm:hover { background: #6366f1; color: white; }
                .btn-secondary-sm:hover { background: rgba(255,255,255,0.1); color: white; }
                .btn-success-sm:hover { background: #10b981; color: white; }
                
                .modal-content-wide { background: #1e293b; border-radius: 16px; padding: 2rem; width: 90%; max-width: 650px; max-height: 85vh; overflow-y: auto; position: relative; border: 1px solid rgba(255,255,255,0.1);box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                .modal-content { background: #1e293b; border-radius: 16px; padding: 2rem; position: relative; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                .summary-section h3, .reason-section h3 { font-size: 1rem; color: #818cf8; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
                .summary-text, .reason-text { background: rgba(15, 23, 42, 0.6); padding: 1.2rem; border-radius: 12px; line-height: 1.6; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.05); }
                .badge-total { background: linear-gradient(135deg, #6366f1, #a855f7); padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: bold; color: white; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3); }
                .empty-state { text-align: center; padding: 5rem 2rem; grid-column: 1 / -1; background: rgba(30, 41, 59, 0.4); border-radius: 20px; border: 2px dashed rgba(255,255,255,0.1); }
                .empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.8; }
                
                .chat-bubble-history { padding: 1rem; border-radius: 12px; margin-bottom: 1rem; max-width: 85%; position: relative; white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-size: 0.95rem; }
                .chat-bubble-history.user { background: linear-gradient(135deg, #6366f1, #4f46e5); margin-left: auto; border-bottom-right-radius: 2px; color: white; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2); }
                .chat-bubble-history.agent { background: #334155; margin-right: auto; border-bottom-left-radius: 2px; color: #f8fafc; border: 1px solid rgba(255,255,255,0.05); }
                .msg-time { font-size: 0.75rem; opacity: 0.6; margin-top: 0.5rem; text-align: right; }

                .variables-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; max-height: 380px; overflow-y: auto; padding-right: 0.5rem; }
                .variables-list::-webkit-scrollbar { width: 6px; }
                .variables-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .variable-item { display: flex; gap: 0.75rem; align-items: flex-start; background: rgba(15,23,42,0.6); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); transition: border-color 0.2s; }
                .variable-item:focus-within { border-color: rgba(99, 102, 241, 0.4); }
                .var-inputs { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
                .var-inputs input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); color: white; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.9rem; transition: all 0.2s; }
                .var-inputs input:focus { border-color: #6366f1; outline: none; background: rgba(0,0,0,0.5); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
                .remove-var-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; align-self: stretch; margin-top: 2px; }
                .remove-var-btn:hover { background: #ef4444; color: white; transform: scale(1.05); }
                .add-var-btn { width: 100%; padding: 0.8rem; background: rgba(99, 102, 241, 0.1); color: #818cf8; border: 1px dashed rgba(99, 102, 241, 0.3); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: all 0.2s; }
                .add-var-btn:hover { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.5); transform: translateY(-1px); }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes cardPop { from { opacity: 0; transform: scale(0.9) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes successPulse { 
                    0% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.4); opacity: 0; }
                    100% { transform: scale(1); opacity: 0.6; }
                }
                .animate-in { animation: fadeIn 0.3s ease-out forwards; }
            ` }} />
        </div>
    );
};

export default SupportDashboard;
