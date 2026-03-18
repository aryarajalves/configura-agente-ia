import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const ResetSuccessModal = ({ isOpen, onClose }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            const timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(timer);
                        return 100;
                    }
                    return prev + 2;
                });
            }, 30);
            return () => clearInterval(timer);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="reset-success-overlay">
            <div className="reset-success-card">
                <div className="success-icon-container">
                    <div className="success-pulse"></div>
                    <div className="success-icon-inner">✨</div>
                </div>

                <h2 className="success-title">Sistema Resetado!</h2>
                <p className="success-message">
                    Todos os dados (agentes, memórias e logs) foram limpos.
                    Seu ambiente agora está novo em folha.
                </p>

                <div className="status-progress-container">
                    <div className="progress-labels">
                        <span>Restaurando ambiente habitual...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                <button className="reload-action-btn" onClick={onClose}>
                    OK, CONCLUIR
                </button>
            </div>

            <style>{`
                .reset-success-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(7, 10, 19, 0.95); backdrop-filter: blur(20px);
                    z-index: 10000001; display: flex; align-items: center; justify-content: center;
                    padding: 20px; animation: resetOverlayFade 0.5s ease-out;
                }
                .reset-success-card {
                    background: linear-gradient(135deg, #161d2f 0%, #0f172a 100%);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    border-radius: 32px; width: 100%; max-width: 480px;
                    padding: 50px 40px; text-align: center;
                    box-shadow: 0 50px 100px -20px rgba(0,0,0,0.9), 0 0 40px rgba(99, 102, 241, 0.1);
                    animation: resetCardPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .success-icon-container {
                    position: relative; width: 90px; height: 90px; margin: 0 auto 30px;
                }
                .success-pulse {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(99, 102, 241, 0.2); border-radius: 30px;
                    animation: successPulse 2s infinite;
                }
                .success-icon-inner {
                    position: relative; width: 100%; height: 100%; border-radius: 30px;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 2.5rem; color: white; border: 2px solid rgba(255,255,255,0.1);
                    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
                }

                .success-title { color: white; font-size: 2rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em; }
                .success-message { color: #94a3b8; font-size: 1.1rem; line-height: 1.6; margin-bottom: 35px; }

                .status-progress-container { margin-bottom: 40px; text-align: left; }
                .progress-labels { display: flex; justify-content: space-between; color: #64748b; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; }
                .progress-track { height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
                .progress-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); border-radius: 10px; transition: width 0.1s linear; }

                .reload-action-btn {
                    width: 100%; padding: 20px; border-radius: 18px; border: none;
                    background: white; color: #0f172a; font-weight: 800; font-size: 1rem;
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }
                .reload-action-btn:hover {
                    transform: translateY(-3px); background: #f1f5f9; box-shadow: 0 15px 30px rgba(0,0,0,0.3);
                }
                .reload-action-btn:active { transform: translateY(-1px); }

                @keyframes successPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.4); opacity: 0; }
                    100% { transform: scale(1); opacity: 0.6; }
                }
                @keyframes resetOverlayFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes resetCardPop { from { opacity: 0; transform: scale(0.9) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
        </div>,
        document.body
    );
};

export default ResetSuccessModal;
