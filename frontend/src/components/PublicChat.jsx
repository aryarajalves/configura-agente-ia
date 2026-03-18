import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../config';
import { api } from '../api/client';

function PublicChat() {
    const { agentId } = useParams();
    const [agent, setAgent] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId] = useState(Math.random().toString(36).substring(7));
    const [error, setError] = useState('');
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        // Fetch agent details
        api.get(`/agents/${agentId}`)
            .then(res => {
                if (!res.ok) throw new Error('Agente não encontrado ou inativo.');
                return res.json();
            })
            .then(data => {
                if (!data.is_active) {
                    throw new Error('Este agente está inativo no momento.');
                }
                setAgent(data);
                // Removed the initial welcome message as requested
            })
            .catch(err => setError(err.message));
    }, [agentId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading || !agent) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setLoading(true);

        try {
            const response = await api.post(`/execute`, {
                message: text,
                agent_id: agentId,
                session_id: sessionId
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response,
                model: data.model,
                tool_calls: data.tool_calls
            }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erro de conexão ao enviar a mensagem.' }]);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="public-chat-error">
                <h2>Ops!</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (!agent) {
        return <div className="public-chat-loading">Carregando Chat...</div>;
    }

    const primaryColor = agent.ui_primary_color || '#6366f1';
    const headerColor = agent.ui_header_color || 'rgba(30, 41, 59, 0.9)';

    return (
        <div className="public-chat-container">
            <header className="public-chat-header" style={{ backgroundColor: headerColor }}>
                <div className="agent-avatar">🤖</div>
                <div className="agent-info">
                    <div className="agent-name-row">
                        <h2>{agent.name}</h2>
                        {agent.ui_chat_title && <span className="agent-role-badge">{agent.ui_chat_title}</span>}
                    </div>
                    <p className="status">
                        <span className="online-dot"></span> Online agora
                    </p>
                </div>
            </header>

            <main className="public-chat-messages" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="empty-chat-placeholder">
                        <div className="avatar-large">🤖</div>
                        <h3>{agent.name}</h3>
                        {agent.ui_chat_title && <p className="subtitle">{agent.ui_chat_title}</p>}
                        <p>Envie uma mensagem para iniciar a conversa.</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`public-message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}>
                        {msg.role === 'assistant' && <div className="public-avatar">🤖</div>}
                        <div className={`public-message-bubble ${msg.role}`} style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}>
                            {msg.content.split('\n').map((line, j) => (
                                <React.Fragment key={j}>
                                    {line}
                                    <br />
                                </React.Fragment>
                            ))}

                            {msg.role === 'assistant' && msg.model && (
                                <div className="message-meta-info" style={{
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.65rem',
                                    color: '#64748b'
                                }}>
                                    <span className="model-tag" style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        ✨ Gerado por <strong>{msg.model}</strong>
                                    </span>
                                    {msg.tool_calls && (
                                        <span className="tool-tag" title="Executou ferramentas">🛠️</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="public-message-row assistant-row">
                        <div className="public-avatar">🤖</div>
                        <div className="public-message-bubble typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
            </main>

            <footer className="public-chat-footer">
                <form onSubmit={handleSendMessage} className={`public-chat-form ${isInputExpanded ? 'expanded' : ''}`}>
                    <textarea
                        value={loading ? "A IA está processando sua resposta..." : input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        disabled={loading}
                        className={loading ? "input-processing custom-scrollbar" : "custom-scrollbar"}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (!e.ctrlKey && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                } else if (e.ctrlKey) {
                                    e.preventDefault();
                                    const target = e.target;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const newVal = input.substring(0, start) + '\n' + input.substring(end);
                                    setInput(newVal);
                                    setTimeout(() => {
                                        target.selectionStart = target.selectionEnd = start + 1;
                                    }, 0);
                                }
                            }
                        }}
                        style={{
                            resize: 'none',
                            height: isInputExpanded ? '150px' : '44px',
                            minHeight: '44px',
                            fontFamily: 'inherit',
                            paddingTop: '12px'
                        }}
                    />
                    <div className="public-chat-actions" style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setIsInputExpanded(!isInputExpanded)}
                            disabled={loading}
                            style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}
                            title={isInputExpanded ? "Minimizar Chat" : "Maximizar Chat"}
                        >
                            {isInputExpanded ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                </svg>
                            )}
                        </button>
                        <button type="submit" disabled={loading || !input.trim()} style={{ backgroundColor: primaryColor }}>
                            {loading ? '⏳' : '➤'}
                        </button>
                    </div>
                </form>
            </footer>

            <style>{`
                /* CSS isolado para que a interface antiga não o sobrescreva totalmente, mas usando o fundo padrão do projeto */
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    background-color: #0f172a;
                    font-family: 'Inter', system-ui, sans-serif;
                    color: white;
                }
                .public-chat-error, .public-chat-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                    color: #94a3b8;
                    background: #0f172a;
                }
                .public-chat-error h2 {
                    color: #ef4444;
                    margin-bottom: 10px;
                }
                .public-chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-width: 600px; /* Layout estilo mobile centralizado */
                    margin: 0 auto;
                    background: #1e293b;
                    box-shadow: 0 0 40px rgba(0,0,0,0.5);
                    position: relative;
                }
                .public-chat-header {
                    display: flex;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    z-index: 10;
                }
                .agent-avatar {
                    font-size: 2.5rem;
                    margin-right: 15px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                    width: 55px;
                    height: 55px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid rgba(255,255,255,0.2);
                }
                .agent-info h2 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    letter-spacing: -0.01em;
                }
                .agent-name-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 2px;
                }
                .agent-role-badge {
                    background: rgba(99, 102, 241, 0.15);
                    color: #818cf8;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    font-weight: 700;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    letter-spacing: 0.05em;
                }
                .agent-info .status {
                    margin: 0;
                    font-size: 0.8rem;
                    color: #10b981;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 500;
                }
                .online-dot {
                    width: 8px;
                    height: 8px;
                    background-color: #10b981;
                    border-radius: 50%;
                    box-shadow: 0 0 8px #10b981;
                    animation: pulseOnline 2s infinite;
                }
                @keyframes pulseOnline {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .public-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.2rem;
                    scroll-behavior: smooth;
                    background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 20px 20px;
                }
                .empty-chat-placeholder {
                    margin: auto;
                    text-align: center;
                    color: #64748b;
                    opacity: 0.8;
                }
                .empty-chat-placeholder .avatar-large {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                .empty-chat-placeholder h3 {
                    margin: 0 0 5px 0;
                    color: #cbd5e1;
                }
                .public-message-row {
                    display: flex;
                    align-items: flex-end;
                    gap: 12px;
                    animation: fadeIn 0.3s ease-out forwards;
                }
                .user-row {
                    justify-content: flex-end;
                }
                .assistant-row {
                    justify-content: flex-start;
                }
                .public-avatar {
                    font-size: 1.2rem;
                    width: 32px;
                    height: 32px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-bottom: 2px;
                }
                .public-message-bubble {
                    padding: 12px 16px;
                    border-radius: 18px;
                    max-width: 80%;
                    line-height: 1.5;
                    font-size: 0.95rem;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .public-message-bubble.user {
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .public-message-bubble.assistant {
                    background-color: rgba(30, 41, 59, 1);
                    color: #f1f5f9;
                    border-bottom-left-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .public-chat-footer {
                    padding: 1rem 1.5rem;
                    background: #1e293b;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    z-index: 10;
                }
                .public-chat-form {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                    background: rgba(15, 23, 42, 0.4);
                    padding: 6px;
                    border-radius: 30px;
                    border: 1px solid rgba(255,255,255,0.1);
                    transition: all 0.3s;
                }
                .public-chat-form.expanded {
                    border-radius: 20px;
                }
                .public-chat-form:focus-within {
                    border-color: rgba(99, 102, 241, 0.5);
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
                }
                .public-chat-form textarea {
                    flex: 1;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: white;
                    outline: none;
                    font-size: 1rem;
                    transition: all 0.3s;
                }
                .public-chat-form textarea.input-processing {
                    color: #64748b;
                    font-style: italic;
                    animation: pulseText 1.5s infinite;
                }
                @keyframes pulseText {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                .public-chat-form button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: none;
                    color: white;
                    font-size: 1.1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                .public-chat-form button:hover:not(:disabled) {
                    transform: scale(1.05);
                }
                .public-chat-form button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .typing-indicator span {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    background-color: #94a3b8;
                    border-radius: 50%;
                    margin: 0 2px;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Premium Meta Pills for Model and Tools */
                .meta-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 3px 8px;
                    border-radius: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-top: 8px;
                    margin-right: 6px;
                }
                .model-name {
                    background: rgba(99, 102, 241, 0.15);
                    color: #818cf8;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }
                .tool-icon {
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                @media (max-width: 600px) {
                    .public-chat-container {
                        max-width: 100%;
                        border-radius: 0;
                    }
                    .public-message-bubble {
                        max-width: 90%;
                    }
                }
            `}</style>
        </div>
    );
}

export default PublicChat;
