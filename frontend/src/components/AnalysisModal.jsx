import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { api } from '../api/client';

const AnalysisModal = ({
    isOpen,
    onClose,
    analysisData,
    agentId,
    initialAgentConfig = null
}) => {
    if (!isOpen || !analysisData) return null;

    // States
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [copiedAll, setCopiedAll] = useState(false);
    const [coverageResults, setCoverageResults] = useState(null);
    const [checkingCoverage, setCheckingCoverage] = useState(false);

    // New Knowledge Item State
    const [newItemData, setNewItemData] = useState(null);
    const [isSavingItem, setIsSavingItem] = useState(false);

    // Knowledge Bases Check
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [agentConfig, setAgentConfig] = useState(initialAgentConfig);

    useEffect(() => {
        setCoverageResults(null);

        // Fetch Agent Config if needed
        if (!agentConfig && agentId) {
            api.get(`/agents/${agentId}`)
                .then(res => res.json())
                .then(setAgentConfig)
                .catch(err => console.error("Erro ao carregar agente:", err));
        }

        // Fetch KBs
        api.get(`/knowledge-bases`)
            .then(res => res.json())
            .then(setKnowledgeBases)
            .catch(err => console.error("Erro ao carregar bases:", err));

    }, [analysisData, agentId]);

    // Helpers
    const copyToClipboard = async (text, index = null) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (index !== null) {
                setCopiedIndex(index);
                setTimeout(() => setCopiedIndex(null), 1500);
            } else {
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 2000);
            }
        } catch (err) { console.error('Failed to copy', err); }
    };

    const handleCopyAll = () => {
        let text = "";
        if (analysisData.type === 'questions' && Array.isArray(analysisData.content)) {
            text = analysisData.content.join('\n');
        } else if (analysisData.type === 'summary') {
            text = analysisData.content;
        }
        copyToClipboard(text);
    };

    const checkCoverage = async () => {
        if (!agentConfig) return alert("Dados do agente não carregados.");
        const kbId = agentConfig.knowledge_base_ids?.[0] || agentConfig.knowledge_base_id;
        if (!kbId) return alert("Este agente não tem Base de Conhecimento vinculada.");

        setCheckingCoverage(true);
        try {
            const res = await api.post(`/knowledge-bases/${kbId}/coverage`, {
                questions: analysisData.content
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const map = {};
            data.results.forEach(r => map[r.question] = r);
            setCoverageResults(map);
        } catch (e) {
            alert("Erro ao verificar: " + e.message);
        } finally {
            setCheckingCoverage(false);
        }
    };

    // New Item Logic
    const handleAddItem = (question) => {
        const defaultKbId = agentConfig?.knowledge_base_ids?.[0] || agentConfig?.knowledge_base_id;
        setNewItemData({
            question,
            answer: "",
            category: "Descoberta",
            target_kb_id: defaultKbId || (knowledgeBases[0]?.id)
        });
    };

    const saveNewItem = async () => {
        if (!newItemData?.answer) return alert("Digite uma resposta.");
        setIsSavingItem(true);
        try {
            await api.post(`/knowledge-bases/${newItemData.target_kb_id}/items`, {
                question: newItemData.question,
                answer: newItemData.answer,
                category: newItemData.category
            });

            // Mark as covered locally
            setCoverageResults(prev => ({
                ...prev,
                [newItemData.question]: { status: 'green', best_match: { answer: newItemData.answer } }
            }));
            setNewItemData(null);
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setIsSavingItem(false);
        }
    };

    return (
        <div className="modal-backdrop fade-in">
            <div className="modal-container">
                {/* Header */}
                <div className="modal-header">
                    <div className="header-icon">
                        {analysisData.type === 'summary' ? '📝' :
                            analysisData.type === 'questions' ? '💎' : '⚠️'}
                    </div>
                    <div className="header-info">
                        <h3>
                            {analysisData.type === 'summary' && 'Resumo Inteligente'}
                            {analysisData.type === 'questions' && 'Perguntas Detectadas'}
                            {analysisData.type === 'error' && 'Erro na Análise'}
                        </h3>
                        <p>
                            {analysisData.type === 'summary' && 'Síntese gerada por IA da conversa atual'}
                            {analysisData.type === 'questions' && `${analysisData.content?.length || 0} perguntas extraídas do contexto`}
                            {analysisData.type === 'error' && 'Falha ao processar solicitação'}
                        </p>
                    </div>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    {newItemData && (
                        <div className="overlay-editor fade-in">
                            <div className="editor-card">
                                <h4>✨ Adicionar à Base</h4>
                                <div className="field">
                                    <label>Pergunta</label>
                                    <input
                                        value={newItemData.question}
                                        onChange={e => setNewItemData({ ...newItemData, question: e.target.value })}
                                    />
                                </div>
                                <div className="field">
                                    <label>Resposta Ideal</label>
                                    <textarea
                                        autoFocus
                                        value={newItemData.answer}
                                        onChange={e => setNewItemData({ ...newItemData, answer: e.target.value })}
                                        placeholder="Escreva a resposta correta..."
                                    />
                                </div>
                                <div className="field">
                                    <label>Base de Destino</label>
                                    <select
                                        value={newItemData.target_kb_id}
                                        onChange={e => setNewItemData({ ...newItemData, target_kb_id: e.target.value })}
                                    >
                                        {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                                    </select>
                                </div>
                                <div className="actions">
                                    <button className="btn-cancel" onClick={() => setNewItemData(null)}>Cancelar</button>
                                    <button className="btn-save" onClick={saveNewItem} disabled={isSavingItem}>
                                        {isSavingItem ? 'Salvando...' : 'Salvar Conhecimento'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {analysisData.loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <span>Processando conversas com IA...</span>
                        </div>
                    ) : (
                        <>
                            {analysisData.type === 'questions' && (
                                <div className="questions-list">
                                    {analysisData.content.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon">🔍</div>
                                            <h3>Nenhuma pergunta encontrada</h3>
                                            <p>A IA analisou o contexto mas não identificou perguntas claras nestas conversas.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {!coverageResults && (
                                                <div className="toolbar">
                                                    <button className="btn-check-coverage" onClick={checkCoverage} disabled={checkingCoverage}>
                                                        {checkingCoverage ? 'Verificando...' : '🔍 Verificar Cobertura na Base'}
                                                    </button>
                                                </div>
                                            )}

                                            <div className="scroll-area">
                                                {analysisData.content.map((q, i) => {
                                                    const status = coverageResults?.[q]?.status;
                                                    const match = coverageResults?.[q]?.best_match;

                                                    return (
                                                        <div key={i} className={`question-item ${status || ''}`}>
                                                            <div className="q-main">
                                                                <span className="q-text">{q}</span>
                                                                {status === 'green' && <span className="badge green">Coberto</span>}
                                                                {status === 'yellow' && <span className="badge yellow">Parcial</span>}
                                                                {status === 'red' && <span className="badge red">Sem Resposta</span>}
                                                            </div>

                                                            {match && (
                                                                <div className="match-info">
                                                                    <strong>Na Base:</strong> {match.answer}
                                                                </div>
                                                            )}

                                                            <div className="q-actions">
                                                                {status === 'red' && (
                                                                    <button className="btn-learn" onClick={() => handleAddItem(q)}>+ Aprender</button>
                                                                )}
                                                                <button
                                                                    className="btn-copy"
                                                                    onClick={() => copyToClipboard(q, i)}
                                                                >
                                                                    {copiedIndex === i ? 'Copiado!' : 'Copiar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {analysisData.type === 'summary' && (
                                <div className="summary-text">
                                    {analysisData.content}
                                </div>
                            )}

                            {analysisData.type === 'error' && (
                                <div className="error-msg">{analysisData.content}</div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    {!analysisData.loading && analysisData.content?.length > 0 && (
                        <button className={`btn-copy-all ${copiedAll ? 'success' : ''}`} onClick={handleCopyAll}>
                            {copiedAll ? 'Copiado para Transferência!' : 'Copiar Tudo'}
                        </button>
                    )}
                    <button className="btn-close" onClick={onClose}>Fechar</button>
                </div>
            </div>

            <style>{`
                .modal-backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                }
                .modal-container {
                    background: #0f172a; width: 650px; max-width: 95vw; max-height: 90vh;
                    border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);
                    display: flex; flex-direction: column; overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .modal-header {
                    padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex; gap: 16px; align-items: center;
                }
                .header-icon {
                    width: 48px; height: 48px; background: rgba(59, 130, 246, 0.1); color: #60a5fa;
                    border-radius: 12px; display: flex; align-items: center; justify-content: center;
                    font-size: 24px;
                }
                .header-info h3 { margin: 0; color: white; font-size: 18px; font-weight: 600; }
                .header-info p { margin: 4px 0 0; color: #94a3b8; font-size: 14px; }
                .close-btn { 
                    margin-left: auto; background: transparent; border: none; color: #64748b; 
                    font-size: 20px; cursor: pointer; padding: 8px;
                }
                .close-btn:hover { color: white; }

                .modal-body { flex: 1; overflow-y: auto; padding: 0; position: relative; }
                .scroll-area { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
                
                .loading-state { padding: 60px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 16px; }
                .spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #60a5fa; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .empty-state { padding: 40px; text-align: center; color: #64748b; }
                .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
                .empty-state h3 { color: #e2e8f0; margin-bottom: 8px; }

                .question-item {
                    background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px; padding: 16px; transition: all 0.2s;
                }
                .question-item:hover { background: rgba(30, 41, 59, 0.8); transform: translateY(-1px); }
                
                .question-item.green { border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05); }
                .question-item.red { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); }

                .q-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
                .q-text { color: #e2e8f0; font-size: 15px; line-height: 1.5; }
                
                .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
                .badge.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
                .badge.yellow { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
                .badge.red { background: rgba(239, 68, 68, 0.2); color: #f87171; }

                .match-info { 
                    margin-top: 12px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;
                    color: #94a3b8; font-size: 13px; border-left: 2px solid #334155;
                }
                
                .q-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
                .btn-learn { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
                .btn-copy { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
                .btn-copy:hover { border-color: #64748b; color: white; }

                .toolbar { padding: 16px 24px 0; display: flex; justify-content: flex-end; }
                .btn-check-coverage {
                    background: #6366f1; color: white; border: none; padding: 8px 16px; 
                    border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                }
                .btn-check-coverage:hover { background: #4f46e5; }

                .modal-footer {
                    padding: 20px 24px; border-top: 1px solid rgba(255,255,255,0.05);
                    display: flex; justify-content: space-between; align-items: center;
                    background: #0f172a;
                }
                .btn-close {
                    background: transparent; color: #94a3b8; border: none; font-weight: 600; cursor: pointer;
                }
                .btn-copy-all {
                    background: #ffffff; color: #0f172a; border: none; padding: 10px 20px;
                    border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;
                }
                .btn-copy-all.success { background: #10b981; color: white; }

                /* Overlay Editor */
                .overlay-editor {
                    position: absolute; inset: 0; background: rgba(15,23,42,0.95);
                    z-index: 10; display: flex; align-items: center; justify-content: center; padding: 30px;
                }
                .editor-card { width: 100%; max-width: 450px; display: flex; flex-direction: column; gap: 16px; }
                .editor-card h4 { color: white; font-size: 18px; margin: 0 0 8px 0; }
                .field label { display: block; color: #94a3b8; font-size: 13px; margin-bottom: 6px; }
                .field input, .field textarea, .field select {
                    width: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,0.1);
                    color: white; padding: 10px; border-radius: 8px; font-family: inherit; font-size: 14px;
                }
                .field textarea { min-height: 100px; resize: vertical; }
                .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
                .btn-cancel { background: transparent; color: #fff; border: none; cursor: pointer; }
                .btn-save { background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
                
                .summary-text { padding: 24px; color: #e2e8f0; line-height: 1.7; font-size: 15px; white-space: pre-wrap; }
                .error-msg { padding: 24px; color: #f87171; text-align: center; }

                .fade-in { animation: fadeIn 0.25s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
};

export default AnalysisModal;
