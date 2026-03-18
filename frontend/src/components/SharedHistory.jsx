import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../config';

const SharedHistory = () => {
    const { sessionId } = useParams();
    const [messages, setMessages] = useState([]);
    const [agentName, setAgentName] = useState('...');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const url = `${API_URL}/shared/session/${sessionId}`;
                const res = await fetch(url);
                if (!res.ok) {
                    if (res.status === 404) throw new Error("Sessão não encontrada ou link inválido.");
                    throw new Error("Erro ao carregar o chat público.");
                }
                const data = await res.json();
                setAgentName(data.agent_name);
                setMessages(data.messages);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="public-chat-loading" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8' }}>
                Carregando conversa...
            </div>
        );
    }

    if (error) {
        return (
            <div className="public-chat-error" style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#ef4444', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
                <h2>{error}</h2>
            </div>
        );
    }

    return (
        <div className="public-chat-container" style={{ margin: '0 auto', maxWidth: '800px', height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
            <header className="public-chat-header" style={{ padding: '1rem 1.5rem', background: 'rgba(30, 41, 59, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="agent-avatar" style={{ fontSize: '2rem', background: 'rgba(255,255,255,0.1)', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.1)' }}>🤖</div>
                <div className="agent-info">
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>{agentName}</h2>
                    <p className="status" style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></span> Histórico Público
                    </p>
                </div>
            </header>

            <main className="public-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                        <p>Histórico vazio.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`public-message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '12px' }}>
                            {msg.role === 'assistant' && (
                                <div className="public-avatar" style={{ fontSize: '1.2rem', width: '32px', height: '32px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
                            )}
                            <div className={`public-message-bubble ${msg.role}`} style={{
                                padding: '12px 16px',
                                borderRadius: '18px',
                                maxWidth: '80%',
                                fontSize: '0.95rem',
                                lineHeight: '1.5',
                                background: msg.role === 'user' ? '#6366f1' : 'rgba(30, 41, 59, 1)',
                                color: '#f1f5f9',
                                border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '18px'
                            }}>
                                <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
                                    {msg.content}
                                </div>
                                {msg.role === 'assistant' && msg.model && (
                                    <div style={{
                                        marginTop: '8px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        fontSize: '0.65rem',
                                        color: '#64748b'
                                    }}>
                                        ✨ Gerado por <strong>{msg.model}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </main>

            <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                Visualização pública gerada pelo <strong>Agent Flow App</strong> • Somente leitura
            </footer>

            <style>{`
                .public-chat-messages::-webkit-scrollbar { width: 6px; }
                .public-chat-messages::-webkit-scrollbar-track { background: transparent; }
                .public-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                @media (max-width: 600px) {
                    .public-chat-container { max-width: 100% !important; }
                    .public-message-bubble { max-width: 85% !important; }
                }
            `}</style>
        </div>
    );
};

export default SharedHistory;
