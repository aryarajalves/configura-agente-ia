import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { api } from '../../api/client';

const PromptGenerator = () => {
    const [formData, setFormData] = useState({
        identity: '',
        mission: '',
        tone: '',
        restrictions: '',
        audience: ''
    });
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Maximized State
    const [maximizedField, setMaximizedField] = useState(null);

    // Publish States
    const [agents, setAgents] = useState([]);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Chat States
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isTalkingToAI, setIsTalkingToAI] = useState(false);

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await api.get(`/agents`);
            const data = await res.json();
            setAgents(data);
        } catch (err) {
            console.error("Erro ao carregar agentes:", err);
        }
    };

    const handleSendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const newMessages = [...chatMessages, { role: 'user', content: chatInput }];
        setChatMessages(newMessages);
        setChatInput('');
        setIsTalkingToAI(true);

        try {
            const response = await api.post(`/prompt-chat`, {
                current_prompt: generatedPrompt,
                messages: newMessages
            });

            if (!response.ok) throw new Error('Falha ao conversar com IA');
            const data = await response.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        } catch (error) {
            console.error(error);
            alert('Erro no chat: ' + error.message);
        } finally {
            setIsTalkingToAI(false);
        }
    };

    const handleApplySuggestions = async () => {
        if (chatMessages.length === 0) return;

        setIsGenerating(true);
        try {
            const response = await api.post(`/apply-suggestions`, {
                current_prompt: generatedPrompt,
                messages: chatMessages
            });

            if (!response.ok) throw new Error('Falha ao aplicar melhorias');
            const data = await response.json();
            setGeneratedPrompt(data.prompt);
            setChatMessages([]); // Clear chat after applying
            alert('Prompt melhorado com sucesso! ✨');
        } catch (error) {
            console.error(error);
            alert('Erro ao aplicar melhorias: ' + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublishToAgent = async () => {
        if (!selectedAgentId) {
            alert('Por favor, selecione um agente.');
            return;
        }

        setIsPublishing(true);
        try {
            const response = await api.patch(`/agents/${selectedAgentId}/publish`, { prompt: generatedPrompt });

            if (!response.ok) throw new Error('Falha ao publicar prompt');

            const data = await response.json();
            alert(data.message);
            setShowPublishModal(false);
        } catch (error) {
            console.error(error);
            alert('Erro ao publicar: ' + error.message);
        } finally {
            setIsPublishing(false);
        }
    };

    const filteredAgents = (agents || []).filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.id.toString().includes(searchTerm)
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = async () => {
        if (!formData.identity.trim() || !formData.mission.trim()) {
            alert('Por favor, preencha pelo menos a Identidade e a Missão do agente.');
            return;
        }
        setIsGenerating(true);
        setGeneratedPrompt('');
        try {
            const response = await api.post(`/generate-prompt`, formData);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Falha ao gerar prompt');
            }

            const data = await response.json();
            setGeneratedPrompt(data.prompt);
        } catch (error) {
            console.error(error);
            alert(`Erro ao conectar com a IA: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedPrompt);
        alert('Prompt copiado!');
    };

    // Components
    const RenderField = ({ name, label, type, placeholder, rows }) => (
        <div className="form-group">
            <label>{label}</label>
            <div className="input-with-maximize">
                {type === 'textarea' ? (
                    <textarea
                        name={name}
                        placeholder={placeholder}
                        value={formData[name]}
                        onChange={handleInputChange}
                        rows={rows}
                    />
                ) : (
                    <input
                        name={name}
                        placeholder={placeholder}
                        value={formData[name]}
                        onChange={handleInputChange}
                    />
                )}
                <button
                    className="maximize-btn"
                    title="Maximizar"
                    onClick={() => setMaximizedField({ name, label })}
                >
                    ⤢
                </button>
            </div>
        </div>
    );

    return (
        <div className="generator-container">
            {isGenerating && (
                <div className="global-loading-overlay">
                    <div className="loading-content">
                        <div className="pulse-circle"></div>
                        <span>O Engenheiro de Prompts está trabalhando... ✨</span>
                        <p>Refinando sua identidade e formatando diretrizes sênior.</p>
                    </div>
                </div>
            )}

            <header className="generator-header">
                <h1>🧪 Laboratório de Prompts</h1>
                <p>Crie instruções poderosas para seus agentes em segundos.</p>
            </header>

            <div className="workspace">
                <div className="panel left-panel">
                    <h2 className="section-title">1. Defina as Bases</h2>
                    <div className="form-container">
                        <RenderField
                            name="identity"
                            label="Quem é o agente?"
                            placeholder="Ex: Consultor Sênior de Vendas..."
                        />

                        <RenderField
                            name="mission"
                            label="Qual é a missão dele?"
                            placeholder="Ex: Ajudar clientes a escolherem o melhor plano..."
                            type="textarea"
                            rows={3}
                        />

                        <RenderField
                            name="tone"
                            label="Tom de Voz"
                            placeholder="Ex: Empático, direto, divertido..."
                        />

                        <RenderField
                            name="audience"
                            label="Público Alvo"
                            placeholder="Ex: Empreendedores iniciantes..."
                        />

                        <RenderField
                            name="restrictions"
                            label="Restrições (O que NÃO fazer)"
                            placeholder="Ex: Nunca falar preços, não usar gírias..."
                            type="textarea"
                            rows={3}
                        />

                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
                            disabled={isGenerating || !formData.identity.trim() || !formData.mission.trim()}
                        >
                            {isGenerating ? 'Criando Mágica... ✨' : 'Gerar Prompt Mestre 🚀'}
                        </button>
                    </div>
                </div>

                <div className="panel right-panel">
                    <h2 className="section-title">2. Resultado (Prompt Mestre)</h2>
                    <div className="prompt-preview compact-view">
                        {generatedPrompt ? (
                            <div className="compact-scroll-area">
                                <div style={{ fontSize: '0.9rem', lineHeight: '1.5', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                    {generatedPrompt.length > 200 ? (
                                        <>
                                            {generatedPrompt.slice(0, 200)}
                                            <span className="faded-prompt-text">
                                                {generatedPrompt.slice(200, 350)}...
                                            </span>
                                            <div style={{ marginTop: '1rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                                (Conteúdo contínuo... Clique em ⤢ para ver tudo)
                                            </div>
                                        </>
                                    ) : (
                                        generatedPrompt
                                    )}
                                </div>
                                <button
                                    className="maximize-prompt-btn"
                                    title="Maximizar Prompt"
                                    onClick={() => setMaximizedField({
                                        name: 'generatedPrompt',
                                        label: 'Prompt Mestre Completo',
                                        value: generatedPrompt,
                                        isReadOnly: true
                                    })}
                                >
                                    ⤢
                                </button>
                            </div>
                        ) : !isGenerating && (
                            <div className="placeholder-params">
                                O prompt gerado aparecerá aqui...
                            </div>
                        )}
                    </div>

                    {generatedPrompt && !isGenerating && (
                        <>
                            <div className="action-buttons">
                                <button className="copy-btn" onClick={copyToClipboard}>
                                    📋 Copiar
                                </button>
                                <button className="publish-btn" onClick={() => setShowPublishModal(true)}>
                                    🚀 Aplicar no Agente
                                </button>
                            </div>

                            <div className="refinement-chat">
                                <div className="chat-header">
                                    <span>💬 Consultoria de Prompt</span>
                                </div>

                                <div className="chat-messages-container">
                                    {chatMessages.length === 0 ? (
                                        <div className="empty-chat">
                                            Converse com a IA para ajustar detalhes do seu prompt mestre.
                                        </div>
                                    ) : (
                                        chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`chat-message ${msg.role}`}>
                                                <div className="message-content">{msg.content}</div>
                                            </div>
                                        ))
                                    )}
                                    {isTalkingToAI && (
                                        <div className="chat-message assistant loading">
                                            <div className="typing-dots"><span>.</span><span>.</span><span>.</span></div>
                                        </div>
                                    )}
                                </div>

                                <div className="chat-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Tire dúvidas ou peça ajustes..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                                    />
                                    <button
                                        className="chat-maximize-btn"
                                        title="Expandir Chat"
                                        onClick={() => setMaximizedField({ name: 'chatInput', label: 'Mensagem para a IA' })}
                                    >
                                        ⤢
                                    </button>
                                    <button onClick={handleSendChatMessage} disabled={!chatInput.trim() || isTalkingToAI}>
                                        ➤
                                    </button>
                                </div>

                                {chatMessages.length > 0 && (
                                    <button
                                        className="apply-improvements-btn"
                                        onClick={handleApplySuggestions}
                                        disabled={isGenerating}
                                    >
                                        ✨ Aplicar Melhorias Sugeridas
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal Publicar */}
            {showPublishModal && (
                <div className="maximize-overlay" onClick={() => setShowPublishModal(false)}>
                    <div className="maximize-modal publish-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Publicar no Agente</h3>
                            <button className="close-modal-btn" onClick={() => setShowPublishModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-search-container">
                                <span className="search-icon">🔍</span>
                                <input
                                    className="modal-search-input"
                                    placeholder="Buscar agente pelo nome ou ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <p className="modal-subtitle">Qual agente deve receber estas instruções?</p>

                            <div className="agent-grid">
                                {filteredAgents.length > 0 ? filteredAgents.map(agent => (
                                    <div
                                        key={agent.id}
                                        className={`agent-card-select ${selectedAgentId === agent.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedAgentId(agent.id)}
                                    >
                                        <div className="agent-select-badge">
                                            {selectedAgentId === agent.id ? '✓' : ''}
                                        </div>
                                        <div className="agent-icon-small">🤖</div>
                                        <div className="agent-info-small">
                                            <strong className="agent-name-small">{agent.name}</strong>
                                            <div className="agent-meta-small">
                                                <span className="agent-id-tag">#{agent.id}</span>
                                                <span className="agent-model-tag">{agent.model}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="empty-search">Nenhum agente encontrado.</div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowPublishModal(false)}>Cancelar</button>
                            <button
                                className="btn-confirm"
                                onClick={handlePublishToAgent}
                                disabled={isPublishing || !selectedAgentId}
                            >
                                {isPublishing ? 'Publicando...' : 'Confirmar Publicação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Maximizar - Outside of workspace */}
            {maximizedField && (
                <div className="maximize-overlay" onClick={() => setMaximizedField(null)}>
                    <div className="maximize-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{maximizedField.label}</h3>
                            <button className="close-modal-btn" onClick={() => setMaximizedField(null)}>✕</button>
                        </div>
                        <textarea
                            className="maximized-textarea"
                            value={
                                maximizedField.name === 'chatInput' ? chatInput :
                                    maximizedField.value !== undefined ? maximizedField.value :
                                        formData[maximizedField.name]
                            }
                            onChange={(e) => {
                                if (maximizedField.isReadOnly) return;
                                if (maximizedField.name === 'chatInput') {
                                    setChatInput(e.target.value);
                                } else {
                                    handleInputChange({
                                        target: { name: maximizedField.name, value: e.target.value }
                                    });
                                }
                            }}
                            readOnly={maximizedField.isReadOnly}
                            autoFocus
                        />
                        <div className="modal-footer">
                            <button className="btn-confirm" onClick={() => setMaximizedField(null)}>
                                Salvar e Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .generator-container { padding: 2rem; max-width: 1400px; margin: 0 auto; color: #fff; }
                .generator-header { margin-bottom: 3rem; text-align: center; }
                .generator-header h1 {
                    font-size: 2.5rem;
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }
                .generator-header p { color: #94a3b8; font-size: 1.1rem; }
                
                .workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                @media (max-width: 1024px) { .workspace { grid-template-columns: 1fr; } }
                
                .panel {
                    background: rgba(30, 41, 59, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px; padding: 2rem;
                    display: flex; flex-direction: column;
                }
                .right-panel { background: rgba(15, 23, 42, 0.8); border-color: rgba(99, 102, 241, 0.2); }
                
                .section-title { font-size: 1.25rem; color: #e2e8f0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
                .form { display: flex; flex-direction: column; gap: 1.5rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                
                .input-with-maximize { position: relative; width: 100%; }
                .maximize-btn {
                    position: absolute; bottom: 8px; right: 8px;
                    background: rgba(255,255,255,0.05); color: #94a3b8;
                    border: none; border-radius: 4px; 
                    width: 24px; height: 24px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; transition: all 0.2s;
                }
                .maximize-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }

                label { color: #94a3b8; font-size: 0.9rem; font-weight: 500; }
                
                input, textarea {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px; padding: 1rem;
                    width: 100%; /* Important for container */
                    color: #fff; font-size: 1rem; transition: all 0.2s;
                    resize: vertical;
                    box-sizing: border-box; /* Fix sizing */
                }
                input:focus, textarea:focus {
                    outline: none; border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
                textarea { min-height: 100px; }
                
                .generate-btn {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white; border: none; padding: 1rem;
                    border-radius: 12px; font-weight: 600; font-size: 1.1rem;
                    cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; margin-top: 1rem;
                }
                .generate-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
                }
                .generate-btn:disabled { opacity: 0.7; cursor: wait; transform: none; }
                
                .prompt-preview {
                    background: #0f172a; border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 1.5rem; flex: 1; overflow-y: auto;
                    min-height: 400px;
                }
                pre {
                    white-space: pre-wrap; font-family: 'JetBrains Mono', monospace;
                    color: #e2e8f0; line-height: 1.6; font-size: 0.95rem;
                }
                .placeholder-params {
                    display: flex; align-items: center; justify-content: center;
                    height: 100%; color: #475569; font-style: italic;
                }
                
                .action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
                .copy-btn {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff; padding: 0.8rem 1.5rem;
                    border-radius: 8px; font-weight: 500; cursor: pointer;
                    transition: all 0.2s; flex: 1;
                }
                .copy-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                
                .publish-btn {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    color: #818cf8; padding: 0.8rem 1.5rem;
                    border-radius: 8px; font-weight: 600; cursor: pointer;
                    transition: all 0.2s; flex: 1.5;
                }
                .publish-btn:hover {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: #6366f1;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
                }

                .refinement-chat {
                    margin-top: 2rem; background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;
                }
                .chat-header {
                    font-size: 0.8rem; color: #64748b; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                
                .chat-messages-container {
                    max-height: 250px; overflow-y: auto; display: flex;
                    flex-direction: column; gap: 0.75rem; padding: 0.5rem;
                }
                .empty-chat {
                    text-align: center; color: #475569; font-size: 0.85rem; padding: 1rem;
                }
                .chat-message {
                    max-width: 85%; padding: 0.75rem 1rem; border-radius: 12px;
                    font-size: 0.9rem; line-height: 1.4;
                }
                .chat-message.user {
                    align-self: flex-end; background: #6366f1; color: white;
                    border-bottom-right-radius: 2px;
                }
                .chat-message.assistant {
                    align-self: flex-start; background: #1e293b; color: #cbd5e1;
                    border-bottom-left-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.05);
                }
                
                .chat-input-wrapper {
                    display: flex; gap: 0.5rem; background: #0f172a;
                    border-radius: 8px; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .chat-input-wrapper input {
                    flex: 1; background: transparent; border: none;
                    color: #fff; padding: 0.6rem 0.8rem; font-size: 0.9rem;
                }
                .chat-input-wrapper input:focus { outline: none; }
                .chat-input-wrapper button {
                    background: #6366f1; color: white; border: none;
                    width: 36px; height: 36px; border-radius: 6px;
                    cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center;
                }
                .chat-maximize-btn {
                    background: rgba(255, 255, 255, 0.05) !important;
                    color: #94a3b8 !important; margin-right: 4px;
                }
                .chat-maximize-btn:hover {
                    background: rgba(255, 255, 255, 0.1) !important;
                    color: #fff !important;
                }
                
                .apply-improvements-btn {
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    color: white; border: none; padding: 1rem; border-radius: 10px;
                    font-weight: 700; cursor: pointer; transition: all 0.3s;
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); margin-top: 0.5rem;
                }
                .apply-improvements-btn:hover:not(:disabled) {
                    transform: translateY(-2px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
                    filter: brightness(1.1);
                }
                .apply-improvements-btn:disabled {
                    opacity: 0.5; cursor: not-allowed;
                }

                .typing-dots span {
                    animation: typing 1.4s infinite; font-size: 1.5rem; line-height: 0;
                }
                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }

                /* Global Loading Overlay */
                .global-loading-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.95); display: flex;
                    align-items: center; justify-content: center; z-index: 9999;
                    backdrop-filter: blur(10px); cursor: wait;
                }

                .compact-view {
                    height: 200px !important;
                    min-height: 0 !important;
                    position: relative;
                    padding: 0 !important;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: #0f172a;
                    border-radius: 12px;
                }
                .compact-scroll-area {
                    height: 100%;
                    overflow-y: auto;
                    padding: 1.5rem;
                    /* mask-image removed to avoid hiding the grey text */
                }
                .compact-scroll-area pre {
                    margin: 0;
                    white-space: pre-wrap; font-family: 'JetBrains Mono', monospace;
                    word-wrap: break-word;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    color: #cbd5e1;
                    padding-bottom: 50px; /* Space for button */
                }
                .maximize-prompt-btn {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                    transition: all 0.2s;
                    z-index: 100;
                }
                .maximize-prompt-btn:hover {
                    transform: scale(1.1) rotate(5deg);
                    background: #4f46e5;
                }

                .loading-content { text-align: center; color: #fff; }
                .loading-content span { display: block; font-weight: 600; margin-top: 1rem; }
                .loading-content p { color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem; }
                
                .pulse-circle {
                    width: 50px; height: 50px; background: #6366f1;
                    border-radius: 50%; margin: 0 auto;
                    animation: pulse 1.5s infinite ease-in-out;
                }

                @keyframes pulse {
                    0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
                    70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 15px rgba(99, 102, 241, 0); }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }

                /* Modal Styles */
                .maximize-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.85); z-index: 1000;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(5px);
                    animation: fadeIn 0.2s ease;
                }
                .maximize-modal {
                    background: #1e293b; width: 90%; max-width: 800px; height: 80vh;
                    border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
                    display: flex; flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                    animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .publish-modal { height: auto; max-height: 85vh; }
                .modal-header {
                    padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .modal-header h3 { margin: 0; font-size: 1.2rem; color: #fff; }
                .modal-body { padding: 1.5rem; overflow-y: auto; }
                
                .modal-subtitle { 
                    color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; 
                    font-weight: 500;
                }

                .modal-search-container {
                    position: relative; margin-bottom: 2rem;
                }
                .search-icon {
                    position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
                    color: #64748b; font-size: 1rem;
                }
                .modal-search-input {
                    width: 100%; background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px; padding: 1rem 1rem 1rem 3rem;
                    color: #fff; font-size: 1rem; transition: all 0.2s;
                }
                .modal-search-input:focus {
                    outline: none; border-color: #6366f1;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
                }

                .agent-grid {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }
                .agent-card-select {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 16px; padding: 1.25rem;
                    display: flex; align-items: center; gap: 1.25rem;
                    cursor: pointer; transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                }
                .agent-card-select:hover {
                    background: rgba(99, 102, 241, 0.05);
                    border-color: rgba(99, 102, 241, 0.3);
                    transform: translateY(-2px);
                }
                .agent-card-select.selected {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
                    border-color: #6366f1;
                    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.2);
                }
                
                .agent-select-badge {
                    position: absolute; top: 12px; right: 12px;
                    width: 20px; height: 20px; border-radius: 50%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; color: #fff; transition: all 0.2s;
                }
                .agent-card-select.selected .agent-select-badge {
                    background: #6366f1; border-color: #6366f1;
                    color: white; transform: scale(1.1);
                }

                .agent-icon-small {
                    width: 50px; height: 50px; background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px; display: flex; align-items: center;
                    justify-content: center; font-size: 1.5rem;
                    transition: all 0.2s;
                }
                .agent-card-select.selected .agent-icon-small {
                    background: #6366f1; transform: scale(0.95);
                }

                .agent-info-small { display: flex; flex-direction: column; gap: 0.4rem; }
                .agent-name-small { color: #fff; font-size: 1rem; font-weight: 600; }
                
                .agent-meta-small { display: flex; gap: 0.5rem; align-items: center; }
                .agent-id-tag {
                    color: #64748b; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace;
                }
                .agent-model-tag {
                    background: rgba(99, 102, 241, 0.1); color: #818cf8;
                    padding: 2px 8px; border-radius: 4px; font-size: 0.65rem;
                    font-weight: 600; border: 1px solid rgba(99, 102, 241, 0.2);
                }
                
                .empty-search {
                    grid-column: 1 / -1; padding: 3rem; text-align: center;
                    color: #64748b; font-style: italic; border: 1px dashed rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                }

                .close-modal-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    transition: all 0.2s;
                }
                .close-modal-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ef4444; 
                    transform: rotate(90deg);
                }
                
                .maximized-textarea {
                    flex: 1; width: 100%; background: #0f172a; border: none;
                    padding: 1.5rem; color: #fff; font-size: 1.1rem; resize: none;
                    line-height: 1.6; font-family: inherit;
                }
                .maximized-textarea:focus { outline: none; background: #0b1120; }
                
                .compact-preview {
                    height: 250px !important;
                    position: relative;
                    padding: 0 !important;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: #0f172a;
                }
                .compact-scroll-area {
                    height: 100%;
                    overflow-y: auto;
                    padding: 1rem;
                    mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
                }
                .compact-scroll-area pre {
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    color: #cbd5e1;
                }
                .maximize-prompt-btn {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    transition: all 0.2s;
                    z-index: 5;
                }
                .maximize-prompt-btn:hover {
                    transform: scale(1.1);
                    background: #4f46e5;
                }

                .modal-footer {
                    padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.05);
                    display: flex; justify-content: flex-end; gap: 1rem;
                }
                .btn-cancel {
                    background: transparent; border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #94a3b8; padding: 0.8rem 1.5rem; border-radius: 8px;
                    cursor: pointer;
                }
                .btn-confirm {
                    background: #6366f1; color: white; border: none;
                    padding: 0.8rem 2rem; border-radius: 8px; font-weight: 600;
                    cursor: pointer;
                }
                .btn-confirm:hover { background: #4f46e5; }
                .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
};

export default PromptGenerator;
