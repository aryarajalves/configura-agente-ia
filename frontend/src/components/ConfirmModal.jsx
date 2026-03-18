import React from 'react';
import ReactDOM from 'react-dom';

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "danger", isLoading = false }) {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="confirm-modal-overlay fade-in" onClick={isLoading ? null : onCancel}>
            <div className={`confirm-modal-card ${isLoading ? 'is-loading' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="confirm-modal-content">
                    {isLoading ? (
                        <div className="modal-loading-state">
                            <div className="premium-spinner"></div>
                            <h2 className="modal-title" style={{ marginTop: '20px' }}>Apagando...</h2>
                            <p className="modal-message">Aguarde um momento enquanto processamos sua solicitação.</p>
                        </div>
                    ) : (
                        <>
                            <div className={`modal-icon-wrapper ${type}`}>
                                {type === 'danger' ? '🗑️' : '✨'}
                            </div>

                            <h2 className="modal-title">{title}</h2>
                            <p className="modal-message">{message}</p>
                        </>
                    )}
                </div>

                {!isLoading && (
                    <div className="modal-actions-grid">
                        <button className="modal-btn cancel" onClick={onCancel}>
                            {cancelText}
                        </button>
                        <button className={`modal-btn confirm ${type}`} onClick={onConfirm}>
                            {confirmText}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .confirm-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(7, 10, 19, 0.9); backdrop-filter: blur(12px);
                    z-index: 10000000; display: flex; align-items: center; justify-content: center;
                    padding: 20px; animation: modalFadeIn 0.3s ease-out;
                }
                .confirm-modal-card {
                    background: #161d2f; border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 28px; width: 100%; max-width: 440px;
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8);
                    overflow: hidden; animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .confirm-modal-content { padding: 40px 30px 30px; text-align: center; }
                
                .modal-icon-wrapper {
                    width: 70px; height: 70px; border-radius: 22px;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 24px; font-size: 2rem;
                }
                .modal-icon-wrapper.danger {
                    background: rgba(239, 68, 68, 0.1); border: 2px solid rgba(239, 68, 68, 0.15); color: #ef4444;
                }
                .modal-icon-wrapper.info {
                    background: rgba(99, 102, 241, 0.1); border: 2px solid rgba(99, 102, 241, 0.15); color: #818cf8;
                }

                .modal-title { color: white; font-size: 1.5rem; font-weight: 800; margin-bottom: 12px; }
                .modal-message { color: #94a3b8; font-size: 1rem; line-height: 1.6; }

                .modal-actions-grid {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
                    background: rgba(255,255,255,0.05); border-top: 1px solid rgba(255,255,255,0.05);
                }
                .modal-btn {
                    border: none; padding: 22px; font-size: 0.95rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s; background: #161d2f;
                }
                .modal-btn.cancel { color: #64748b; }
                .modal-btn.cancel:hover { background: rgba(255,255,255,0.02); color: white; }
                
                .modal-btn.confirm.danger { color: #ef4444; }
                .modal-btn.confirm.danger:hover { background: #ef4444; color: white; }
                
                .modal-btn.confirm.info { color: #818cf8; }
                .modal-btn.confirm.info:hover { background: #6366f1; color: white; }

                @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                
                .premium-spinner {
                    width: 60px; height: 60px;
                    border: 4px solid rgba(99, 102, 241, 0.1);
                    border-top: 4px solid #6366f1;
                    border-radius: 50%;
                    margin: 0 auto;
                    animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .modal-loading-state {
                    animation: fadeIn 0.4s ease-out;
                    padding: 20px 0;
                }

                .confirm-modal-card.is-loading {
                    border-color: rgba(99, 102, 241, 0.3);
                }
            `}</style>
        </div>,
        document.body
    );
}

export default ConfirmModal;
