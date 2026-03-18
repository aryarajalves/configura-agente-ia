import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

const PublicSupportView = () => {
    const { token } = useParams();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRequests = async () => {
        try {
            const res = await api.get(`/public/support/${token}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Link inválido ou expirado.");
                return;
            }
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            setError("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 60000);
        return () => clearInterval(interval);
    }, [token]);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
        return d.toLocaleString('pt-BR');
    };

    if (loading) return (
        <div className="loading-container">
            <div className="loader"></div>
            <p>Carregando Painel de Suporte...</p>
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
            <header className="public-header">
                <h1>🎧 Central de Suporte Humano</h1>
                <p>Solicitações em aberto aguardando atendimento.</p>
            </header>
            
            <div className="public-content">
                {requests.length === 0 ? (
                    <div className="empty-state">✅ Nenhuma solicitação pendente no momento.</div>
                ) : (
                    <div className="requests-grid">
                        {requests.map(req => (
                            <div key={req.id} className="request-card">
                                <div className="card-header">
                                    <span className="user-name">{req.user_name || 'Anônimo'}</span>
                                    <span className="time">{formatTime(req.created_at)}</span>
                                </div>
                                <div className="card-body">
                                    <p className="reason"><strong>Motivo:</strong> {req.reason}</p>
                                    <p className="summary">{req.summary}</p>
                                    {req.user_email && <p className="contact">📧 {req.user_email}</p>}
                                    {req.extracted_data && Object.keys(req.extracted_data).length > 0 && (
                                        <div className="extracted-data-grid">
                                            {Object.entries(req.extracted_data).map(([k, v]) => (
                                                <div key={k} className="data-item">
                                                    <span className="data-key">{k}:</span>
                                                    <span className="data-val">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <style>{`
                body { background: #070a13; margin: 0; }
                .public-view-container { padding: 40px; max-width: 1200px; margin: 0 auto; color: white; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
                .public-header { margin-bottom: 40px; text-align: center; }
                .public-header h1 { font-size: 2.5rem; margin-bottom: 10px; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; }
                .public-header p { color: #94a3b8; font-size: 1.1rem; }
                
                .requests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
                .request-card { background: #161d2f; border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 25px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
                .request-card:hover { transform: translateY(-5px); border-color: rgba(99,102,241,0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
                
                .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; }
                .user-name { font-weight: 800; font-size: 1.2rem; color: #818cf8; letter-spacing: -0.5px; }
                .time { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                
                .card-body p { margin: 12px 0; line-height: 1.6; color: #cbd5e1; font-size: 0.95rem; }
                .reason { color: #f8fafc !important; font-weight: 500; }
                .contact { color: #f59e0b !important; font-size: 0.85rem; font-weight: 700; background: rgba(245,158,11,0.1); padding: 4px 10px; border-radius: 8px; width: fit-content; }
                
                .extracted-data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.05); }
                .data-item { display: flex; flex-direction: column; gap: 2px; }
                .data-key { font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }
                .data-val { font-size: 0.85rem; color: #f1f5f9; font-weight: 600; }

                .empty-state { text-align: center; padding: 100px; font-size: 1.5rem; color: #10b981; background: rgba(16,185,129,0.05); border-radius: 30px; border: 2px dashed rgba(16,185,129,0.2); font-weight: 700; }
                
                @media (max-width: 768px) {
                    .public-view-container { padding: 20px; }
                    .public-header h1 { font-size: 1.8rem; }
                    .requests-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default PublicSupportView;
