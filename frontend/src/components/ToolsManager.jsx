import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ExpandableField from './ExpandableField';
import ConfirmModal from './ConfirmModal';
import { API_URL } from '../config';
import { api } from '../api/client';

const ToolsManager = ({ activeModelSupportsTools = true, standalone = false }) => {
    const navigate = useNavigate();
    const [tools, setTools] = useState([]);
    const [activeTab, setActiveTab] = useState('webhooks');
    const [currentPage, setCurrentPage] = useState(1);
    const [newTool, setNewTool] = useState({
        name: '',
        description: '',
        webhook_url: ''
    });
    const [parameters, setParameters] = useState([]); // [{ name, type, description }]
    const [status, setStatus] = useState('');
    const [editingTool, setEditingTool] = useState(null);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, toolId: null, toolName: '', type: 'tool', paramIndex: null });
    const [maximizedField, setMaximizedField] = useState(null);
    const [globalVariables, setGlobalVariables] = useState([]);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        fetchTools();
        fetchGlobalVariables();
    }, []);

    const fetchGlobalVariables = async () => {
        try {
            const res = await api.get(`/global-variables`);
            const data = await res.json();
            setGlobalVariables(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Erro ao buscar variáveis globais p/ ferramentas", e);
        }
    };

    const fetchTools = () => {
        api.get(`/tools`)
            .then(res => res.json())
            .then(data => {
                setTools(Array.isArray(data) ? data : []);
            })
            .catch(err => {
                console.error("Error fetching tools:", err);
                setTools([]);
            });
    };

    const handleAddParameter = () => {
        setParameters([...parameters, { name: '', type: 'string', description: '', required: false, binding: '' }]);
    };

    const handleRemoveParameter = (index) => {
        setModalConfig({
            isOpen: true,
            type: 'parameter',
            paramIndex: index,
            toolName: parameters[index].name || 'Sem nome'
        });
    };

    const confirmRemoveParameter = () => {
        const { paramIndex } = modalConfig;
        setParameters(parameters.filter((_, i) => i !== paramIndex));
        setModalConfig({ isOpen: false, toolId: null, toolName: '', type: 'tool', paramIndex: null });
    };

    const handleParameterChange = (index, field, value) => {
        const updatedParams = [...parameters];
        updatedParams[index][field] = value;
        setParameters(updatedParams);
    };

    const generateSchema = () => {
        const properties = {};
        const required = [];

        // Custom property to store bindings (not standard JSON Schema, but we'll filter it before sending to LLM if needed, 
        // or just keep it as metadata. Ideally, we store "tool_config" separately, but packing it into schema is easier for now)
        // Actually, let's keep it in the schema for storage, and the backend logic that sends tools to LLM should filter out bound parameters.
        const bindings = {};

        parameters.forEach(p => {
            if (p.name.trim()) {
                // Only add to properties if NO binding is set (so LLM sees it only if it's NOT auto-filled)
                // OR we can send it but say it's auto-filled.
                // The cleanest way for "Context Injection" is to HIDE it from the LLM.
                if (!p.binding) {
                    properties[p.name.trim()] = {
                        type: p.type,
                        description: p.description
                    };
                    if (p.required) {
                        required.push(p.name.trim());
                    }
                } else {
                    bindings[p.name.trim()] = p.binding;
                }
            }
        });

        return JSON.stringify({
            type: "object",
            properties: properties,
            required: required,
            _bindings: bindings // We'll use this custom field in backend
        });
    };

    const handleDuplicate = (tool) => {
        setEditingTool(null);
        setNewTool({
            name: tool.name + '_copy',
            description: tool.description,
            webhook_url: tool.webhook_url
        });

        try {
            const schema = JSON.parse(tool.parameters_schema);
            const requiredParams = schema.required || [];
            const bindings = schema._bindings || {};

            // Reconstruct parameters from both properties (LLM) and bindings (Hidden)
            const llmParams = Object.entries(schema.properties || {}).map(([name, def]) => ({
                name,
                type: def.type || 'string',
                description: def.description || '',
                required: requiredParams.includes(name),
                binding: ''
            }));

            const boundParams = Object.entries(bindings).map(([name, binding]) => ({
                name,
                type: 'string', // bindings are usually strings
                description: 'Auto-preenchido pelo sistema',
                required: false,
                binding: binding
            }));

            setParameters([...llmParams, ...boundParams]);
        } catch (e) {
            setParameters([]);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStatus('📝 Cópia iniciada. Edite e salve.');
        setTimeout(() => setStatus(''), 3000);
    };

    const handleTestWebhook = () => {
        if (!newTool.webhook_url) {
            setStatus('⚠️ Digite uma URL para testar.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }
        setStatus('⏳ Enviando ping de teste...');
        fetch(newTool.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'ping',
                message: 'Verificação de conexão do Agente IA',
                timestamp: new Date().toISOString()
            })
        })
            .then(res => {
                if (res.ok) setStatus('✅ Webhook recebeu o teste com sucesso!');
                else setStatus('⚠️ Webhook retornou erro: ' + res.status);
            })
            .catch(err => setStatus('❌ Falha na conexão: ' + err.message))
            .finally(() => setTimeout(() => setStatus(''), 4000));
    };

    const handleCopyUrl = (url) => {
        navigator.clipboard.writeText(url);
        setStatus('📋 URL copiada!');
        setTimeout(() => setStatus(''), 2000);
    };

    const handleSave = () => {
        if (!newTool.name || !newTool.description || !newTool.webhook_url) {
            setStatus('Erro: Preencha todos os campos obrigatórios.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        const schema = generateSchema();
        const toolData = { ...newTool, parameters_schema: schema };
        const isEditing = editingTool !== null;
        const url = isEditing ? `/tools/${editingTool.id}` : `/tools`;

        setStatus('Salvando ferramenta...');

        const request = isEditing
            ? api.put(url, toolData)
            : api.post(url, toolData);

        request
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Falha ao salvar');
            })
            .then(tool => {
                if (isEditing) {
                    setTools(tools.map(t => t.id === tool.id ? tool : t));
                    setStatus('✅ Ferramenta atualizada!');
                } else {
                    setTools([...tools, tool]);
                    setStatus('✨ Ferramenta criada com sucesso!');
                }

                setNewTool({ name: '', description: '', webhook_url: '' });
                setParameters([]);
                setEditingTool(null);
                setTimeout(() => setStatus(''), 3000);
            })
            .catch(err => setStatus(`❌ Erro ao ${isEditing ? 'atualizar' : 'criar'} ferramenta.`));
    };

    const handleDeleteClick = (id, toolName) => {
        setModalConfig({ isOpen: true, toolId: id, toolName: toolName, type: 'tool' });
    };

    const handleConfirmDelete = () => {
        if (modalConfig.type === 'parameter') {
            confirmRemoveParameter();
            return;
        }

        const { toolId } = modalConfig;
        api.delete(`/tools/${toolId}`)
            .then(() => {
                setTools(tools.filter(t => t.id !== toolId));
                setStatus('🗑️ Ferramenta deletada.');
                setTimeout(() => setStatus(''), 3000);
            })
            .catch(() => setStatus('❌ Erro ao deletar ferramenta.'))
            .finally(() => setModalConfig({ isOpen: false, toolId: null, toolName: '', type: 'tool' }));
    };

    const handleEdit = (tool) => {
        setEditingTool(tool);
        setNewTool({
            name: tool.name,
            description: tool.description,
            webhook_url: tool.webhook_url
        });

        try {
            const schema = JSON.parse(tool.parameters_schema);
            const requiredParams = schema.required || [];
            const params = Object.entries(schema.properties || {}).map(([name, def]) => ({
                name,
                type: def.type || 'string',
                description: def.description || '',
                required: requiredParams.includes(name)
            }));
            setParameters(params);
        } catch (e) {
            setParameters([]);
        }

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderToolCard = (tool) => (
        <div key={tool.id} className="agent-card" style={{ minHeight: 'auto', padding: '1rem', marginBottom: '0.5rem' }}>
            <div className="agent-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '0.2rem', fontFamily: 'monospace', background: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'inline-block', WebkitTextFillColor: 'initial', backgroundClip: 'border-box' }}>
                        {tool.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0' }}>
                        <span className="agent-model-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.2)', fontSize: '0.65rem', padding: '2px 6px' }}>
                            API
                        </span>
                        {JSON.parse(tool.parameters_schema || '{}').properties && (
                            <span className="agent-model-badge" style={{ background: Object.keys(JSON.parse(tool.parameters_schema).properties).length > 2 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)', color: Object.keys(JSON.parse(tool.parameters_schema).properties).length > 2 ? '#fbbf24' : '#a5b4fc', borderColor: Object.keys(JSON.parse(tool.parameters_schema).properties).length > 2 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)', fontSize: '0.65rem', padding: '2px 6px' }}>
                                {Object.keys(JSON.parse(tool.parameters_schema).properties).length} Params
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleDuplicate(tool)} className="access-btn" style={{ padding: '0.4rem', width: '32px', height: '32px', fontSize: '0.8rem' }} title="Duplicar">📄</button>
                    {!tool.webhook_url ? (
                        <button onClick={() => handleDeleteClick(tool.id, tool.name)} className="delete-btn" style={{ padding: '0.4rem', width: '32px', height: '32px', fontSize: '0.8rem' }} title="Deletar Nativa (Poderá ser restaurada reabrindo o painel ou em Configurações Globais)">🗑️</button>
                    ) : (
                        <>
                            <button onClick={() => handleEdit(tool)} className="access-btn" style={{ padding: '0.4rem 0.8rem', width: 'auto', fontSize: '0.8rem' }} title="Editar">Editar</button>
                            <button onClick={() => handleDeleteClick(tool.id, tool.name)} className="delete-btn" style={{ padding: '0.4rem', width: '32px', height: '32px', fontSize: '0.8rem' }} title="Deletar">🗑️</button>
                        </>
                    )}
                </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                {tool.description}
            </p>
            {tool.webhook_url && (
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{ color: 'var(--accent-color)', opacity: 0.8 }}>🔗</span>
                        <span style={{ fontFamily: 'monospace', color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tool.webhook_url}
                        </span>
                    </div>
                    <button onClick={() => handleCopyUrl(tool.webhook_url)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '1rem', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.2s' }} title="Copiar URL" onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋</button>
                </div>
            )}
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="panel-title" style={{ margin: 0 }}>
                    {standalone ? 'Gerenciador de Habilidades (API)' : 'Configurar Habilidades'}
                </h2>
                <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        color: '#a5b4fc', borderRadius: '10px',
                        padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    <span>📖</span><span>Guia das Ferramentas</span>
                </button>
            </div>

            {/* Modal Guia das Ferramentas */}
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
                                    <span>📖</span><span>Guia das Ferramentas (Habilidades)</span>
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                    Entenda cada campo e como conectar a IA a sistemas externos via webhook.
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
                                    icon: '🚀', title: 'O que é uma Habilidade?', accent: '#6366f1',
                                    desc: 'Uma Habilidade (Tool) é uma ação que a IA pode executar chamando um endpoint externo (webhook). Quando o agente detecta que precisa de dados ou precisa executar algo, ele aciona a ferramenta certa automaticamente.',
                                    tip: 'Use habilidades para consultar estoque, criar pedidos, buscar dados em CRMs, acionar automações no n8n/Make, etc.',
                                },
                                {
                                    icon: '🏷️', title: 'Nome Técnico (snake_case)', accent: '#8b5cf6',
                                    desc: 'Identificador único da ferramenta enviado ao modelo de IA. Deve ser em minúsculas com underscores (snake_case). O modelo usa esse nome para decidir qual ferramenta chamar.',
                                    code: 'buscar_estoque\nverificar_pedido\nconsultar_cliente\nenviarcupom_desconto',
                                    tip: 'Seja descritivo. "buscar_status_pedido" é melhor que "pedido".',
                                },
                                {
                                    icon: '📝', title: 'Descrição para a IA (Prompt)', accent: '#a855f7',
                                    desc: 'Instrução enviada ao modelo explicando QUANDO e COMO usar esta ferramenta. Quanto mais detalhada, mais precisa será a decisão da IA. Use o botão "Expandir" para escrever textos longos com conforto.',
                                    code: 'Use esta ferramenta quando o usuário perguntar sobre\no status de um pedido. Chame com o número do pedido\nque o usuário informar na conversa.',
                                    tip: 'Inclua exemplos de situações: "Use quando o cliente pedir rastreio", "Acione se o usuário mencionar cancelamento".',
                                },
                                {
                                    icon: '🔗', title: 'Webhook URL', accent: '#06b6d4',
                                    desc: 'Endereço HTTP que receberá uma requisição POST quando a IA acionar esta ferramenta. Compatible com n8n, Make (Integromat), Zapier, ou qualquer servidor próprio.',
                                    code: 'https://n8n.seu-servidor.com/webhook/buscar-pedido\nhttps://hook.eu1.make.com/abc123xyz\nhttps://api.seusite.com/tools/estoque',
                                    tip: 'Use o botão "⚡ Testar" ao lado da URL para verificar a conexão antes de salvar.',
                                },
                                {
                                    icon: '📦', title: 'Parâmetros de Entrada', accent: '#10b981',
                                    desc: 'Dados que a IA coleta da conversa e envia ao webhook. Cada parâmetro tem nome, tipo (texto/número/booleano) e uma descrição que orienta a IA sobre como extrair esse valor.',
                                    code: 'nome: numero_pedido\ntipo: string\ndescrição: "Número do pedido mencionado\npelo cliente, ex: #12345"',
                                    tip: 'Marque como "Obrigatório" os campos sem os quais a ferramenta não funciona — a IA pedirá ao usuário antes de chamar.',
                                },
                                {
                                    icon: '🔒', title: 'Vinculação Automática (Binding)', accent: '#f59e0b',
                                    desc: 'Alguns parâmetros podem ser preenchidos automaticamente pelo sistema sem precisar perguntar ao usuário. Selecione uma variável do sistema no dropdown e o campo será enviado automaticamente.',
                                    code: '{{contact.phone}}  → Telefone WhatsApp\n{{contact.name}}   → Nome do cliente\n{{conversation.id}} → ID da sessão\n{{current_date}}   → Data e hora atual\n{{memory.id}}      → ID de memória',
                                    tip: 'Variáveis Globais criadas no painel também aparecem aqui para binding.',
                                },
                                {
                                    icon: '⚡', title: 'Testando o Webhook', accent: '#ef4444',
                                    desc: 'O botão "⚡ Testar" envia uma requisição de teste ao webhook preenchido para verificar se a URL está acessível e respondendo. Útil para validar antes de publicar a ferramenta.',
                                    tip: 'O webhook deve responder com status 200 para o teste passar. Certifique-se de que a URL esteja pública ou acessível pela rede do servidor.',
                                },
                                {
                                    icon: '🤝', title: 'Vinculando ao Agente', accent: '#6366f1',
                                    desc: 'Após criar a ferramenta aqui, vá até as Configurações do Agente → aba "Habilidades" → seção "Ferramentas" e ative as habilidades desejadas. O agente só usará ferramentas explicitamente habilitadas.',
                                    tip: 'Uma mesma ferramenta pode ser vinculada a múltiplos agentes diferentes.',
                                },
                            ].map((card, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid rgba(255,255,255,0.07)`,
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

            <div className="editor-layout" style={{ gridTemplateColumns: 'minmax(380px, 420px) 1fr', gap: '1.5rem' }}>
                {/* Lado Esquerdo: Formulário */}
                <div className="step-card" style={{ padding: '1.25rem' }}>
                    <span className="section-label" style={{ marginBottom: '1rem' }}>{editingTool ? '📝 Editando Habilidade' : '🚀 Nova Habilidade'}</span>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Nome Técnico <span className="label-value">snake_case</span></label>
                        <input
                            value={newTool.name}
                            onChange={e => setNewTool({ ...newTool, name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                            placeholder="ex: buscar_estoque"
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                color: '#fff',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '10px',
                                width: '100%',
                                outline: 'none',
                                transition: 'all 0.3s',
                                fontSize: '0.9rem'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(99, 102, 241, 0.2)'}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Descrição para a IA <span className="label-value">Prompt</span></label>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={newTool.description}
                                onChange={e => setNewTool({ ...newTool, description: e.target.value })}
                                placeholder="Descreva exatamente quando a IA deve usar esta ferramenta..."
                                style={{
                                    minHeight: '80px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    color: '#fff',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    padding: '0.6rem 0.8rem',
                                    paddingBottom: '2.5rem', // Space for button
                                    borderRadius: '10px',
                                    width: '100%',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    fontSize: '0.85rem',
                                    resize: 'vertical'
                                }}
                            />
                            <button
                                onClick={() => setMaximizedField('description')}
                                style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#818cf8',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    backdropFilter: 'blur(4px)'
                                }}
                                title="Maximizar editor"
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <span style={{ fontSize: '1.1em' }}>⤢</span> Expandir
                            </button>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Webhook URL</label>
                        <input
                            value={newTool.webhook_url}
                            onChange={e => setNewTool({ ...newTool, webhook_url: e.target.value })}
                            placeholder="https://n8n.seu-servidor.com/webhook/..."
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                color: '#fff',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                padding: '0.6rem 0.8rem',
                                paddingRight: '80px', // Space for button
                                borderRadius: '10px',
                                width: '100%',
                                outline: 'none',
                                fontSize: '0.85rem'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(99, 102, 241, 0.2)'}
                        />
                        <button
                            onClick={handleTestWebhook}
                            style={{
                                position: 'absolute',
                                right: '5px',
                                top: '28px', // Adjusted for label height
                                background: 'rgba(99, 102, 241, 0.2)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                color: '#a5b4fc',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                            title="Enviar teste para o Webhook"
                        >
                            ⚡ Testar
                        </button>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <span className="section-label" style={{ fontSize: '0.65rem', marginBottom: '0.75rem' }}>Parâmetros de Entrada</span>
                        {parameters.map((param, index) => (
                            <div key={index} style={{
                                background: 'rgba(255,255,255,0.03)',
                                padding: '1rem',
                                borderRadius: '0.75rem',
                                marginBottom: '0.75rem',
                                border: '1px solid var(--border-color)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}>
                                <button
                                    onClick={() => handleRemoveParameter(index)}
                                    style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '-8px',
                                        background: '#ef4444',
                                        border: '2px solid #0f172a',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.7rem',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 10,
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                    }}
                                    title="Remover parâmetro"
                                >
                                    ✕
                                </button>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                                            <input
                                                type="checkbox"
                                                checked={param.required || false}
                                                onChange={(e) => handleParameterChange(index, 'required', e.target.checked)}
                                                style={{ accentColor: '#ef4444' }}
                                            />
                                            Obrigatório
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                                        <select
                                            value={param.binding || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleParameterChange(index, 'binding', val);
                                                // If binding is set, type is usually string or matches the var.
                                                // If binding is cleared, user might want to set type manually.
                                            }}
                                            style={{
                                                width: '155px',
                                                padding: '0.5rem',
                                                background: param.binding ? '#10b981' : '#1e293b',
                                                color: param.binding ? '#000' : '#e2e8f0',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: param.binding ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                colorScheme: 'dark'
                                            }}
                                        >
                                            <option value="" style={{ background: '#1e293b', color: '#e2e8f0' }}>Entrada Manual (IA)</option>
                                            <optgroup label="Dados do Sistema" style={{ background: '#1e293b', color: '#94a3b8' }}>
                                                <option value="{{contact.phone}}" style={{ background: '#1e293b', color: '#e2e8f0' }}>📱 Telefone (WhatsApp)</option>
                                                <option value="{{contact.name}}" style={{ background: '#1e293b', color: '#e2e8f0' }}>👤 Nome do Cliente</option>
                                                <option value="{{conversation.id}}" style={{ background: '#1e293b', color: '#e2e8f0' }}>🆔 ID da Sessão</option>
                                                <option value="{{current_date}}" style={{ background: '#1e293b', color: '#e2e8f0' }}>📅 Data/Hora Atual</option>
                                                <option value="{{memory.id}}" style={{ background: '#1e293b', color: '#e2e8f0' }}>🧠 Memória (WhatsApp + ID)</option>
                                            </optgroup>
                                            {globalVariables.length > 0 && (
                                                <optgroup label="Variáveis Globais" style={{ background: '#1e293b', color: '#94a3b8' }}>
                                                    {globalVariables.filter(v => !['contact_name', 'contact_phone'].includes(v.key)).map(v => (
                                                        <option key={v.id} value={`{{${v.key}}}`} style={{ background: '#1e293b', color: '#e2e8f0' }}>
                                                            🌍 {v.key}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>

                                        {!param.binding && (
                                            <select
                                                value={param.type}
                                                onChange={(e) => handleParameterChange(index, 'type', e.target.value)}
                                                style={{ width: '100px', padding: '0.6rem', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', marginTop: '4px' }}
                                            >
                                                <option value="string">Texto</option>
                                                <option value="number">Número</option>
                                                <option value="boolean">Booleano</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                                <input
                                    placeholder="Nome do Parâmetro (ex: telefone)"
                                    value={param.name}
                                    onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                                    style={{ flex: 1, padding: '0.6rem', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                />
                                {!param.binding && (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            placeholder="Descrição para a IA (ex: O ID do pedido do cliente)"
                                            value={param.description}
                                            onChange={(e) => handleParameterChange(index, 'description', e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem', paddingRight: '2rem', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        />
                                        <button
                                            onClick={() => setMaximizedField(`param_desc_${index}`)}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                padding: '4px'
                                            }}
                                            title="Maximizar descrição"
                                        >
                                            ⤢
                                        </button>
                                    </div>
                                )}
                                {param.binding && (
                                    <div style={{
                                        padding: '0.6rem',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        color: '#34d399',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span>🔒 Este campo será preenchido automaticamente com: <b>{param.binding}</b></span>
                                    </div>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={handleAddParameter}
                            style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: '#fff',
                                padding: '0.75rem',
                                borderRadius: '0.75rem',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                marginBottom: '2rem',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(99, 102, 241, 0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                            }}
                        >
                            <span style={{ fontSize: '1.2rem', fontWeight: 300 }}>+</span> Adicionar Parâmetro
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handleSave} className="save-button" style={{ flex: 2 }}>
                            {editingTool ? '💾 Atualizar' : '✨ Criar Habilidade'}
                        </button>
                        {editingTool && (
                            <button
                                onClick={() => {
                                    setEditingTool(null);
                                    setNewTool({ name: '', description: '', webhook_url: '' });
                                    setParameters([]);
                                }}
                                className="access-btn"
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                        )}
                    </div>

                    {status && (
                        <div className={`status-message ${status.includes('Erro') || status.includes('❌') ? 'error' : 'success'}`} style={{ marginTop: '1.5rem' }}>
                            {status}
                        </div>
                    )}
                </div>

                {/* Lado Direito: Lista de Ferramentas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Suas Habilidades</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estas ações podem ser vinculadas a qualquer agente.</p>
                    </div>

                    {tools.length === 0 && (
                        <div style={{
                            padding: '3rem',
                            textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '1.5rem',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)'
                        }}>
                            Nenhuma habilidade criada ainda.
                        </div>
                    )}

                    {tools.length > 0 && (
                        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                            <button
                                onClick={() => { setActiveTab('webhooks'); setCurrentPage(1); }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: activeTab === 'webhooks' ? '#34d399' : 'var(--text-secondary)',
                                    fontSize: '1rem',
                                    fontWeight: activeTab === 'webhooks' ? '600' : '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    position: 'relative',
                                    paddingBottom: '0.5rem'
                                }}
                            >
                                <span>🔗</span> Suas Integrações
                                {activeTab === 'webhooks' && <div style={{ position: 'absolute', bottom: '-0.5rem', left: 0, right: 0, height: '2px', background: '#34d399', borderRadius: '2px' }} />}
                            </button>
                            <button
                                onClick={() => { setActiveTab('nativas'); setCurrentPage(1); }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: activeTab === 'nativas' ? '#a5b4fc' : 'var(--text-secondary)',
                                    fontSize: '1rem',
                                    fontWeight: activeTab === 'nativas' ? '600' : '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    position: 'relative',
                                    paddingBottom: '0.5rem'
                                }}
                            >
                                <span>⚡</span> Nativas do Sistema
                                {activeTab === 'nativas' && <div style={{ position: 'absolute', bottom: '-0.5rem', left: 0, right: 0, height: '2px', background: '#a5b4fc', borderRadius: '2px' }} />}
                            </button>
                        </div>
                    )}

                    {(() => {
                        const filteredTools = tools.filter(t => activeTab === 'webhooks' ? t.webhook_url : !t.webhook_url);
                        if (filteredTools.length === 0) {
                            return (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                                    {activeTab === 'webhooks' ? 'Nenhuma integração via webhook criada.' : 'Nenhuma ferramenta nativa disponível.'}
                                </div>
                            );
                        }

                        const itemsPerPage = 5;
                        const totalPages = Math.ceil(filteredTools.length / itemsPerPage);
                        const paginatedTools = filteredTools.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                        return (
                            <>
                                {paginatedTools.map(renderToolCard)}

                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                                                border: '1px solid var(--border-color)',
                                                color: currentPage === 1 ? 'var(--text-secondary)' : 'white',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.5rem',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            Anterior
                                        </button>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', userSelect: 'none' }}>
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                                                border: '1px solid var(--border-color)',
                                                color: currentPage === totalPages ? 'var(--text-secondary)' : 'white',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.5rem',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>

            <ConfirmModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.type === 'parameter' ? "Remover Parâmetro" : "Deletar Habilidade"}
                message={modalConfig.type === 'parameter'
                    ? `Tem certeza que deseja remover o parâmetro "${modalConfig.toolName}"?`
                    : `Tem certeza que deseja deletar a ferramenta "${modalConfig.toolName}"? Isso pode quebrar agentes que a utilizam.`
                }
                onConfirm={handleConfirmDelete}
                onCancel={() => setModalConfig({ isOpen: false, toolId: null, toolName: '', type: 'tool', paramIndex: null })}
                confirmText={modalConfig.type === 'parameter' ? "Remover" : "Deletar"}
                cancelText="Cancelar"
                type="danger"
            />

            {/* Maximized Editor Modal */}
            {
                maximizedField && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        animation: 'fadeIn 0.2s ease-out'
                    }} onClick={() => setMaximizedField(null)}>
                        <div
                            className="fade-in"
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0f172a',
                                width: '90%',
                                maxWidth: '900px',
                                height: '85vh',
                                borderRadius: '24px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)'
                            }}
                        >
                            <div style={{
                                padding: '1.5rem 2rem',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📝</span>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>
                                            {maximizedField === 'description' ? 'Editor de Prompt' : 'Descrição do Parâmetro'}
                                        </h3>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {maximizedField === 'description' ? 'Edite a descrição da habilidade com mais conforto' : 'Detalhe o propósito deste parâmetro'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMaximizedField(null)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: 'none',
                                        color: 'white',
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s',
                                        fontSize: '1.2rem'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', background: '#0b1120' }}>
                                <textarea
                                    value={
                                        maximizedField === 'description'
                                            ? newTool.description
                                            : (parameters[parseInt(maximizedField.split('_')[2])]?.description || '')
                                    }
                                    onChange={e => {
                                        if (maximizedField === 'description') {
                                            setNewTool({ ...newTool, description: e.target.value });
                                        } else {
                                            const index = parseInt(maximizedField.split('_')[2]);
                                            handleParameterChange(index, 'description', e.target.value);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        fontSize: '1.1rem',
                                        lineHeight: '1.7',
                                        resize: 'none',
                                        outline: 'none',
                                        fontFamily: '"Fira Code", monospace',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                    placeholder={maximizedField === 'description' ? "Descreva exatamente quando a IA deve usar esta ferramenta..." : "Descreva este parâmetro..."}
                                    autoFocus
                                    spellCheck="false"
                                />
                            </div>
                            <div style={{
                                padding: '1.5rem 2rem',
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <button
                                    onClick={() => setMaximizedField(null)}
                                    className="save-button"
                                    style={{ padding: '0.8rem 2.5rem', fontSize: '1rem' }}
                                >
                                    ✅ Concluir Edição
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ToolsManager;
