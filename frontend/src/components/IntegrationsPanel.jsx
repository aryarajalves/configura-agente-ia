import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { api } from '../api/client';

const IntegrationsPanel = () => {
    const [googleConnected, setGoogleConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [provisionModal, setProvisionModal] = useState(null);
    const [errorModal, setErrorModal] = useState(null);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get(`/integrations/google/status`);
                const data = await res.json();
                setGoogleConnected(data.connected);
            } catch (err) {
                console.error("Error checking Google status:", err);
            } finally {
                setIsLoading(false);
            }
        };
        checkStatus();
    }, []);

    const handleConnectGoogle = async () => {
        try {
            const res = await api.get(`/integrations/google/auth-url`);
            const data = await res.json();

            if (data.auth_url) {
                window.location.href = data.auth_url;
            } else {
                setErrorModal({
                    title: "Atenção: Configuração Necessária",
                    message: "Não conseguimos gerar o link de autorização. Certifique-se de que o Client ID, Client Secret e a Redirect URI do Google Agenda estejam configurados no seu arquivo .env.",
                    icon: "⚠️"
                });
            }
        } catch (err) {
            setErrorModal({
                title: "Falha de Comunicação",
                message: "Não foi possível conectar ao servidor. Verifique se o backend está ativo e respondo corretamente.",
                icon: "🚫"
            });
        }
    };

    const handleProvisionTools = async () => {
        try {
            const res = await api.post(`/integrations/google/provision-tools`);
            const data = await res.json();
            setProvisionModal(data);
        } catch (err) {
            setErrorModal({
                title: "Erro de Sincronização",
                message: "Não foi possível atualizar o catálogo de ferramentas nativas no momento.",
                icon: "🔄"
            });
        }
    };

    if (isLoading) {
        return (
            <div className="config-panel">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Carregando integrações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="config-panel fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <div>
                    <h2 className="panel-title" style={{ margin: 0 }}>🔌 Integrações Globais</h2>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', marginTop: '4px' }}>
                        Configure integrações que valem para todos os seus agentes.
                    </p>
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
                    <span>📖</span><span>Guia das Integrações</span>
                </button>
            </div>

            {/* Modal Guia das Integrações */}
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
                            maxWidth: '760px', width: '100%',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>📖</span><span>Guia das Integrações Globais</span>
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                    Entenda como conectar serviços externos e disponibilizá-los para todos os seus agentes.
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
                                    icon: '🔌', title: 'O que são Integrações Globais?', accent: '#6366f1',
                                    desc: 'Integrações Globais são conexões com serviços externos (como o Google Calendar) que ficam disponíveis para todos os seus agentes. Você configura uma vez aqui e pode ativar em cada agente individualmente.',
                                    tip: 'Diferente de Habilidades (webhooks), as integrações globais usam autenticação OAuth segura com os serviços oficiais.',
                                },
                                {
                                    icon: '📅', title: 'Google Calendar', accent: '#4285f4',
                                    desc: 'Conecta a conta Google da sua empresa para que os agentes possam criar eventos, consultar disponibilidade, listar compromissos e responder perguntas sobre agenda diretamente na conversa.',
                                    code: 'Exemplos de uso:\n• "Agende uma reunião para amanhã às 14h"\n• "Quais são meus compromissos de hoje?"\n• "Cancele o evento de sexta-feira"\n• "Verifique se estou livre na próxima semana"',
                                    tip: 'O agente age em nome da conta conectada. Use uma conta de serviço/empresa, não pessoal.',
                                },
                                {
                                    icon: '🔐', title: 'Como funciona a autenticação OAuth?', accent: '#8b5cf6',
                                    desc: 'Ao clicar em "Conectar Google Agenda", você será redirecionado para a tela de login do Google. Após autorizar, o sistema recebe um token seguro que permite operar em nome da conta — sem armazenar sua senha.',
                                    tip: 'O token pode ser revogado a qualquer momento nas configurações de segurança da conta Google (myaccount.google.com → Segurança → Acesso de terceiros).',
                                },
                                {
                                    icon: '⚡', title: 'Sincronizar Ferramentas no Catálogo', accent: '#10b981',
                                    desc: 'Após conectar, use o botão "Sincronizar Ferramentas" para registrar as ações do Google Calendar como ferramentas nativas no catálogo. Isso as torna disponíveis para ativação individual em cada agente.',
                                    tip: 'Se o botão de sincronização não aparecer, verifique se a conexão foi concluída com sucesso (status "✓ CONECTADO" deve estar visível).',
                                },
                                {
                                    icon: '🤖', title: 'Ativando por Agente', accent: '#f59e0b',
                                    desc: 'Cada agente decide quais ferramentas usar. Após sincronizar, vá em Configurações do Agente → aba "Habilidades" → seção "Ferramentas" e ative as ferramentas de calendário para os agentes que precisam delas.',
                                    tip: 'Nem todo agente precisa de acesso ao calendário. Ative apenas nos agentes que precisam para manter os prompts enxutos e o desempenho melhor.',
                                },
                                {
                                    icon: '🛠️', title: 'Configuração do .env (para admins)', accent: '#ef4444',
                                    desc: 'Para que o OAuth funcione, o servidor precisa das credenciais do Google Cloud configuradas no arquivo .env do backend:',
                                    code: 'GOOGLE_CLIENT_ID=seu_client_id.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=seu_client_secret\nGOOGLE_REDIRECT_URI=https://seudominio.com/integrations/google/callback',
                                    tip: 'Crie as credenciais em console.cloud.google.com → APIs & Serviços → Credenciais → Criar ID do Cliente OAuth.',
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

            <div className="form-section">
                <span className="section-label">Produtividade & Agendas</span>

                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <div style={{
                            width: '56px', height: '56px',
                            background: 'white',
                            borderRadius: '14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.8rem',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }}>
                            📅
                        </div>
                        <div>
                            <h4 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Google Calendar</h4>
                            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                Permita que seus agentes criem e consultem eventos na sua agenda central.
                            </p>
                        </div>
                    </div>

                    <div>
                        {googleConnected ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                }}>
                                    ✓ CONECTADO
                                </span>
                                <button
                                    onClick={handleConnectGoogle}
                                    className="tab-btn"
                                    style={{ padding: '8px 16px' }}
                                >
                                    Trocar Conta
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnectGoogle}
                                style={{
                                    background: 'white',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.8rem 1.8rem',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(255,255,255,0.1)'
                                }}
                                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Conectar Google Agenda
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <p style={{ margin: 0, color: '#a5b4fc', fontSize: '0.85rem', lineHeight: '1.6' }}>
                        💡 <strong>Dica:</strong> Uma vez conectado aqui, todos os seus agentes poderão usar as ferramentas do Google Calendar, desde que você as ative individualmente em cada agente no menu de <strong>Habilidades</strong>.
                    </p>
                </div>

                {googleConnected && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <button
                            onClick={handleProvisionTools}
                            style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1))',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                padding: '1rem',
                                borderRadius: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                                transition: 'all 0.2s'
                            }}
                        >
                            ⚡ Sincronizar Ferramentas de Agendamento no Catálogo
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de Provisionamento Reusado */}
            {provisionModal && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '24px',
                        padding: '2rem',
                        maxWidth: '480px',
                        width: '90%'
                    }}>
                        <h3 style={{ color: 'white', marginBottom: '1rem' }}>🎉 Integração Pronta!</h3>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                            As ferramentas foram atualizadas no seu catálogo. Agora você pode ir em qualquer agente e ativar as ferramentas do Google Agenda.
                        </p>
                        <button
                            className="access-btn"
                            style={{ width: '100%' }}
                            onClick={() => setProvisionModal(null)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Erro Premium */}
            {errorModal && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1e1b4b, #2d0a0a)',
                        border: '1px solid rgba(220, 38, 38, 0.4)',
                        borderRadius: '28px',
                        padding: '2.5rem',
                        maxWidth: '440px',
                        width: '90%',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(220, 38, 38, 0.15)'
                    }}>
                        <div style={{
                            width: '72px', height: '72px',
                            background: 'rgba(220, 38, 38, 0.15)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            fontSize: '2.5rem',
                            border: '1px solid rgba(220, 38, 38, 0.3)'
                        }}>
                            {errorModal.icon || '⚠️'}
                        </div>
                        <h3 style={{
                            color: 'white',
                            fontSize: '1.4rem',
                            fontWeight: 800,
                            marginBottom: '1rem',
                            letterSpacing: '-0.02em'
                        }}>
                            {errorModal.title}
                        </h3>
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            marginBottom: '2rem'
                        }}>
                            {errorModal.message}
                        </p>
                        <button
                            onClick={() => setErrorModal(null)}
                            style={{
                                background: 'white',
                                color: '#7f1d1d',
                                border: 'none',
                                padding: '0.9rem 2rem',
                                borderRadius: '14px',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                width: '100%',
                                transition: 'transform 0.2s, background 0.2s',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsPanel;
