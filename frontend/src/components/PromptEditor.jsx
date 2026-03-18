// ... Add imports
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { api } from '../api/client';

const PromptEditor = ({ value, onChange, agentId, onDraftSaved }) => {
    const [loadingDrafts, setLoadingDrafts] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeSection, setActiveSection] = useState(null);
    const [showGuide, setShowGuide] = useState(false);
    const [guideVars, setGuideVars] = useState([]);
    const [validVarKeys, setValidVarKeys] = useState([]);
    const textareaRef = useRef(null);
    const backdropRef = useRef(null);

    useEffect(() => {
        api.get('/global-variables')
            .then(r => r.json())
            .then(data => {
                setValidVarKeys(data.map(v => v.key));
                setGuideVars(data);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (showGuide && guideVars.length === 0) {
            api.get('/global-variables')
                .then(r => r.json())
                .then(data => { setGuideVars(data); setValidVarKeys(data.map(v => v.key)); })
                .catch(() => {});
        }
    }, [showGuide]);

    const syncScroll = () => {
        if (backdropRef.current && textareaRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const buildHighlightedHtml = (text) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\{([^}]+)\}/g, (match, varName) => {
                const isValid = validVarKeys.includes(varName);
                const cls = isValid ? 'var-hl-valid' : 'var-hl-unknown';
                return `<mark class="${cls}">{${varName}}</mark>`;
            }) + ' ';
    };

    // Lock body scroll when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    // Parse Markdown headers and [IF:] blocks to build the Outline sidebar
    const outlineItems = [];
    const conditionalBlocks = []; // { varName, lineIndex }
    if (value) {
        const lines = value.split('\n');
        let currentCharIndex = 0;
        lines.forEach((line, index) => {
            const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
            if (headerMatch) {
                outlineItems.push({
                    type: 'header',
                    level: headerMatch[1].length,
                    text: headerMatch[2],
                    lineIndex: index,
                    charIndex: currentCharIndex,
                    lineLength: line.length
                });
            }
            const ifMatch = line.match(/\[IF:([^\]]+)\]/i);
            if (ifMatch && !/\[\/IF\]/i.test(line)) {
                const varName = ifMatch[1].replace(/:false$/i, '');
                const isNegated = /:false$/i.test(ifMatch[1]);
                outlineItems.push({
                    type: 'if',
                    varName,
                    isNegated,
                    lineIndex: index,
                    charIndex: currentCharIndex,
                    lineLength: line.length
                });
                if (!conditionalBlocks.find(b => b.varName === varName)) {
                    conditionalBlocks.push({ varName });
                }
            }
            currentCharIndex += line.length + 1;
        });
    }

    const scrollToSection = (charIndex, lineLength, lineIndex, idx) => {
        setActiveSection(idx);
        if (textareaRef.current) {
            const el = textareaRef.current;

            // 1. Calculamos a posição da linha no scroll
            // Usamos a altura da linha (line-height) multiplicada pelo índice da linha
            const style = window.getComputedStyle(el);
            const lineHeight = parseFloat(style.lineHeight) || 24; // fallback para 24px se der erro
            const paddingTop = parseFloat(style.paddingTop) || 20;

            const targetScrollTop = (lineIndex * lineHeight) + paddingTop - 20;

            // 2. Aplicamos o scroll suavemente
            el.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            });

            // 3. Selecionamos o texto do título para destaque
            el.setSelectionRange(charIndex, charIndex + lineLength);
            el.focus();
        }
    };

    const handleSaveDraft = () => {
        if (!agentId || agentId === 'new') {
            alert("Salve o agente primeiro para habilitar o gerenciamento de versões.");
            return;
        }
        setDraftName(`Versão ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        setIsSavingDraft(true);
    };

    const confirmSaveDraft = async () => {
        if (!draftName.trim()) return;
        setLoadingDrafts(true);
        try {
            await api.post(`/agents/${agentId}/drafts`, {
                prompt_text: value,
                version_name: draftName
            });
            setIsSavingDraft(false);
            if (onDraftSaved) onDraftSaved();
        } catch (e) {
            console.error("Erro ao salvar rascunho:", e);
        } finally {
            setLoadingDrafts(false);
        }
    };

    const handleRawChange = (e) => {
        onChange(e);
    };

    const tokenCount = Math.ceil((value || '').length / 4);

    const IdeEditorContent = (
        <div className={`ide-container ${isExpanded ? 'fullscreen-ide' : ''}`}>
            {isExpanded && (
                <div className="ide-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>💻</span>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>IDE de Prompt</h3>
                    </div>
                    <button className="minimize-btn" onClick={() => setIsExpanded(false)}>
                        Fechar Tela Cheia
                    </button>
                </div>
            )}

            <div className="ide-split-view">
                {/* ESQUERDA: Outline / Explorador */}
                <div className="ide-sidebar-outline custom-scrollbar">
                    <div className="outline-header">
                        ESTRUTURA DO PROMPT
                    </div>
                    {outlineItems.length === 0 ? (
                        <div className="no-outline">
                            Use <code># Título</code> para criar seções de navegação.
                        </div>
                    ) : (
                        <div className="outline-tree">
                            {outlineItems.map((item, idx) => {
                                const depth = item.type === 'if' ? 0 : item.level - 1;
                                const STEP = 14;
                                const levelIcons = ['◆', '▸', '›', '·', '·', '·'];
                                const icon = item.type !== 'if' ? levelIcons[Math.min(depth, levelIcons.length - 1)] : null;
                                return item.type === 'if' ? (
                                    <div
                                        key={idx}
                                        className={`outline-item outline-item-if ${activeSection === idx ? 'active-if' : ''}`}
                                        onClick={() => scrollToSection(item.charIndex, item.lineLength, item.lineIndex, idx)}
                                        style={{ paddingLeft: '28px', position: 'relative' }}
                                    >
                                        <span className="tree-root-dot" />
                                        <span className="if-badge">{item.isNegated ? 'IF:NOT' : 'IF'}</span>
                                        <span className="if-varname">{item.varName}</span>
                                    </div>
                                ) : (
                                    <div
                                        key={idx}
                                        className={`outline-item ${activeSection === idx ? 'active' : ''}`}
                                        onClick={() => scrollToSection(item.charIndex, item.lineLength, item.lineIndex, idx)}
                                        style={{ paddingLeft: `${depth * STEP + 28}px`, position: 'relative' }}
                                    >
                                        {/* Linhas guia verticais para cada nível pai */}
                                        {Array.from({ length: depth }).map((_, i) => (
                                            <span key={i} className="tree-guide-line" style={{ left: `${i * STEP + 16}px` }} />
                                        ))}
                                        {/* Ramo horizontal conectando ao pai */}
                                        {depth > 0 && (
                                            <span className="tree-branch-line" style={{ left: `${(depth - 1) * STEP + 16}px`, width: `${STEP - 2}px` }} />
                                        )}
                                        <span className={`outline-level-icon level-${Math.min(depth, 2)}`}>{icon}</span>
                                        {item.text}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* DIREITA: Código / Textarea */}
                <div className="ide-editor-area">
                    <div className="editor-tab-header">
                        <span className="tab-title">instrucoes.prompt</span>
                        {!isExpanded && (
                            <button className="expand-panel-btn" onClick={() => setIsExpanded(true)} title="Expandir para tela cheia">
                                ⤢ Maximizar
                            </button>
                        )}
                    </div>

                    <div className="ide-editor-wrapper">
                        <div
                            ref={backdropRef}
                            className="ide-highlight-backdrop"
                            dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(value || '') }}
                            aria-hidden="true"
                        />
                        <textarea
                            ref={textareaRef}
                            className="ide-textarea custom-scrollbar"
                            value={value}
                            onChange={handleRawChange}
                            onScroll={syncScroll}
                            placeholder="Escreva as instruções da sua IA aqui... (Dica: Use # ou ## para criar títulos e seções que aparecerão na esquerda)"
                            spellCheck="false"
                        />
                    </div>

                    {conditionalBlocks.length > 0 && (
                        <div className="conditional-vars-panel">
                            <span className="conditional-vars-label">⚡ Variáveis condicionais detectadas:</span>
                            <div className="conditional-vars-chips">
                                {conditionalBlocks.map((block, i) => (
                                    <span key={i} className="conditional-var-chip">
                                        <span className="chip-if">IF</span>
                                        {block.varName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="prompt-editor-multisection">
            {/* Modal Fullscreen usando Portal */}
            {isExpanded && createPortal(
                <div className="ide-modal-overlay">
                    {IdeEditorContent}
                </div>,
                document.body
            )}

            {/* Modal de Salvar Rascunho */}
            {isSavingDraft && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(8px)',
                    zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div className="step-card fade-in" style={{ width: '400px', padding: '2rem', border: '1px solid var(--accent-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
                            💾 Salvar Ponto de Restauração
                        </h3>
                        <div className="form-group">
                            <label>Nome desta versão</label>
                            <input
                                type="text"
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                autoFocus
                                placeholder="Dê um nome para este rascunho..."
                                onKeyDown={(e) => e.key === 'Enter' && confirmSaveDraft()}
                                style={{ width: '100%', padding: '0.8rem', background: '#020617', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                onClick={() => setIsSavingDraft(false)}
                                className="secondary-btn"
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSaveDraft}
                                className="create-agent-btn"
                                style={{ flex: 1 }}
                                disabled={loadingDrafts || !draftName.trim()}
                            >
                                {loadingDrafts ? 'Salvando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="prompt-editor-header" style={{ justifyContent: 'flex-end', gap: '10px' }}>
                <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    className="guide-btn"
                >
                    <span>📖</span>
                    <span>Guia do Prompt</span>
                </button>
                <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="save-draft-btn"
                >
                    <span className="save-draft-icon">💾</span>
                    <span>Salvar Rascunho</span>
                </button>
            </div>

            {/* Modal Guia do Prompt */}
            {showGuide && (
                <div className="guide-overlay" onClick={() => setShowGuide(false)}>
                    <div className="guide-modal" onClick={e => e.stopPropagation()}>
                        <div className="guide-modal-header">
                            <span>📖 Guia do Prompt</span>
                            <button className="guide-close-btn" onClick={() => setShowGuide(false)}>✕</button>
                        </div>
                        <div className="guide-modal-body custom-scrollbar">

                            {/* Seção 1: Títulos */}
                            <div className="guide-section">
                                <div className="guide-section-title">🗂️ Criando Títulos e Seções</div>
                                <p className="guide-desc">Use <code>#</code> no início de uma linha para criar títulos que aparecem na barra lateral. Quanto mais <code>#</code>, mais profundo na hierarquia.</p>
                                <div className="guide-code-block">
                                    <div className="guide-code-line"><span className="gc-h1"># Identidade do Agente</span><span className="gc-comment">  ← nível 1 ◆</span></div>
                                    <div className="guide-code-line"><span className="gc-h2">## Como Responder</span><span className="gc-comment">     ← nível 2 ▸</span></div>
                                    <div className="guide-code-line"><span className="gc-h3">### Tom de Voz</span><span className="gc-comment">        ← nível 3 ›</span></div>
                                    <div className="guide-code-line"><span className="gc-h2">## O Que Nunca Fazer</span><span className="gc-comment">   ← nível 2 ▸</span></div>
                                </div>
                                <div className="guide-tip">💡 Use títulos descritivos e curtos. Eles viram âncoras de navegação na estrutura ao lado.</div>
                            </div>

                            {/* Seção 2: Condicionais */}
                            <div className="guide-section">
                                <div className="guide-section-title">⚡ Blocos Condicionais</div>
                                <p className="guide-desc">Use <code>[if:variavel]</code> para exibir um trecho do prompt <strong>somente quando a variável for verdadeira</strong>. Use <code>[if:variavel:false]</code> para o caso contrário.</p>
                                <div className="guide-code-block">
                                    <div className="guide-code-line"><span className="gc-if">[if:pode-mostrar-link-curso]</span></div>
                                    <div className="guide-code-line gc-indent">Mostre o link do curso ao usuário.</div>
                                    <div className="guide-code-line"><span className="gc-endif">[/if]</span></div>
                                    <div className="guide-code-line" style={{marginTop:'6px'}}><span className="gc-ifnot">[if:pode-mostrar-link-curso:false]</span></div>
                                    <div className="guide-code-line gc-indent">Não mencione o curso ainda.</div>
                                    <div className="guide-code-line"><span className="gc-endif">[/if]</span></div>
                                </div>
                                <div className="guide-tip">💡 O bloco inteiro é removido do prompt quando a condição não é atendida. O LLM nem vê esse texto.</div>
                            </div>

                            {/* Seção 3: Variáveis disponíveis */}
                            <div className="guide-section">
                                <div className="guide-section-title">🌍 Suas Variáveis de Contexto</div>
                                <p className="guide-desc">Estas variáveis são injetadas automaticamente no prompt. Use <code>{'{nome_da_variavel}'}</code> para inserir o valor direto no texto.</p>
                                {guideVars.length === 0 ? (
                                    <div className="guide-empty">Nenhuma variável cadastrada ainda.</div>
                                ) : (
                                    <div className="guide-vars-list">
                                        {guideVars.map(v => (
                                            <div key={v.id} className="guide-var-row">
                                                <div className="guide-var-left">
                                                    <span className="guide-var-key">{'{' + v.key + '}'}</span>
                                                    <span className="guide-var-type">{v.type || 'string'}</span>
                                                </div>
                                                <div className="guide-var-examples">
                                                    <span className="guide-var-ex-label">Injetar valor:</span>
                                                    <code className="guide-var-ex-code">{'Olá, {' + v.key + '}!'}</code>
                                                    {(v.type === 'boolean' || v.value === 'true' || v.value === 'false') && (
                                                        <>
                                                            <span className="guide-var-ex-label" style={{marginLeft:'8px'}}>Condicional:</span>
                                                            <code className="guide-var-ex-code gc-if-inline">[if:{v.key}]...[/if]</code>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Removed the standalone ExpandableField */}
            {!isExpanded && (
                <div className="prompt-section-box shadow-sm" style={{ padding: 0, overflow: 'hidden' }}>
                    {IdeEditorContent}
                </div>
            )}

            <div className="prompt-footer" style={{ marginTop: '1.5rem', padding: '1.2rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <div className="token-counter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📊</span>
                        <div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uso estimado:</span>
                            <strong style={{ marginLeft: '6px', color: 'var(--success-color)', fontSize: '1rem' }}>{tokenCount} tokens</strong>
                        </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Aprox. {value.length} caracteres</span>
                </div>
            </div>

            <style>{`
                .prompt-section-box {
                    background: rgba(255, 255, 255, 0.015);
                    padding: 1.5rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .prompt-section-box:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }

                .prompt-editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    background: rgba(15, 23, 42, 0.4);
                    padding: 0.75rem 1rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }


                .guide-btn {
                    background: rgba(99, 102, 241, 0.08);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #a5b4fc;
                    padding: 0.7rem 1.4rem;
                    border-radius: 14px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .guide-btn:hover {
                    background: rgba(99, 102, 241, 0.18);
                    border-color: rgba(99, 102, 241, 0.4);
                    color: #fff;
                }

                /* Overlay e Modal do Guia */
                .guide-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(2, 6, 23, 0.75);
                    backdrop-filter: blur(6px);
                    z-index: 100001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }
                .guide-modal {
                    background: #0d1117;
                    border: 1px solid rgba(99, 102, 241, 0.25);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 620px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                }
                .guide-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.1rem 1.5rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 700;
                    font-size: 1rem;
                    color: #e2e8f0;
                    flex-shrink: 0;
                }
                .guide-close-btn {
                    background: none;
                    border: none;
                    color: #8b949e;
                    font-size: 1.1rem;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: color 0.15s, background 0.15s;
                }
                .guide-close-btn:hover { color: white; background: rgba(255,255,255,0.08); }
                .guide-modal-body {
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .guide-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                }
                .guide-section-title {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #e2e8f0;
                    padding-bottom: 0.4rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .guide-desc {
                    font-size: 0.83rem;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin: 0;
                }
                .guide-desc code {
                    background: rgba(255,255,255,0.08);
                    padding: 1px 5px;
                    border-radius: 4px;
                    font-family: 'JetBrains Mono', monospace;
                    color: #c9d1d9;
                    font-size: 0.8rem;
                }
                .guide-code-block {
                    background: #161b22;
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 10px;
                    padding: 0.9rem 1.1rem;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.82rem;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .guide-code-line { display: flex; align-items: center; gap: 8px; }
                .guide-code-line.gc-indent { padding-left: 1.2rem; color: #8b949e; }
                .gc-h1 { color: #58a6ff; font-weight: 700; }
                .gc-h2 { color: #7dd3fc; }
                .gc-h3 { color: #94a3b8; }
                .gc-comment { color: #484f58; font-size: 0.75rem; }
                .gc-if { color: #f59e0b; font-weight: 600; }
                .gc-ifnot { color: #fb923c; font-weight: 600; }
                .gc-endif { color: #6b7280; }
                .guide-tip {
                    font-size: 0.78rem;
                    color: #64748b;
                    background: rgba(99, 102, 241, 0.05);
                    border: 1px solid rgba(99, 102, 241, 0.1);
                    border-radius: 8px;
                    padding: 0.5rem 0.8rem;
                }
                .guide-empty {
                    font-size: 0.82rem;
                    color: #64748b;
                    padding: 0.5rem 0;
                }
                .guide-vars-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .guide-var-row {
                    background: #161b22;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 8px;
                    padding: 0.6rem 0.9rem;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .guide-var-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .guide-var-key {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #a5b4fc;
                }
                .guide-var-type {
                    font-size: 0.68rem;
                    color: #64748b;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px;
                    padding: 1px 5px;
                }
                .guide-var-examples {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 4px;
                    font-size: 0.75rem;
                }
                .guide-var-ex-label { color: #64748b; }
                .guide-var-ex-code {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.75rem;
                    background: rgba(255,255,255,0.06);
                    border-radius: 4px;
                    padding: 1px 6px;
                    color: #c9d1d9;
                }
                .gc-if-inline { color: #fcd34d !important; }

                .save-draft-btn {
                    background: rgba(16, 185, 129, 0.08);
                    border: 1px solid rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    padding: 0.7rem 1.4rem;
                    border-radius: 14px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    backdrop-filter: blur(10px);
                }

                .save-draft-btn:hover {
                    background: #10b981;
                    color: white;
                    border-color: #10b981;
                    transform: translateY(-1px);
                    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
                }

                /* ---------- IDE STYLES ---------- */
                
                .ide-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(2, 6, 23, 0.95);
                    backdrop-filter: blur(10px);
                    z-index: 99999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 2rem;
                }

                .ide-container {
                    background: #0d1117;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
                }

                .ide-container:not(.fullscreen-ide) {
                    min-height: 500px;
                }

                .fullscreen-ide {
                    width: 100%;
                    max-width: 1400px;
                    height: 90vh;
                    box-shadow: 0 0 50px rgba(0,0,0,0.5);
                }

                .ide-topbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #161b22;
                    padding: 15px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .minimize-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .minimize-btn:hover { background: #2563eb; }

                .ide-split-view {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    height: 100%;
                }

                /* SIDEBAR OUTLINE */
                .ide-sidebar-outline {
                    width: 280px;
                    min-width: 280px;
                    flex-shrink: 0;
                    background: #161b22;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    overflow-x: hidden;
                }

                .outline-header {
                    padding: 15px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #8b949e;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .no-outline {
                    padding: 20px;
                    font-size: 0.85rem;
                    color: #8b949e;
                    text-align: center;
                    line-height: 1.5;
                }

                .no-outline code {
                    background: rgba(255,255,255,0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .outline-tree {
                    padding: 10px 0;
                }

                .outline-item {
                    padding: 6px 12px 6px 0;
                    padding-right: 12px;
                    font-size: 0.82rem;
                    color: #c9d1d9;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: background 0.1s, color 0.1s;
                    line-height: 1.4;
                    word-break: break-word;
                    gap: 6px;
                }

                .outline-item:hover {
                    background: rgba(255,255,255,0.05);
                    color: #58a6ff;
                }

                /* Linha vertical guia (para cada nível pai) */
                .tree-guide-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(255,255,255,0.07);
                    pointer-events: none;
                }

                /* Ramo horizontal conectando ao pai */
                .tree-branch-line {
                    position: absolute;
                    top: 50%;
                    height: 1px;
                    background: rgba(255,255,255,0.13);
                    pointer-events: none;
                }

                /* Ponto raiz para IF blocks */
                .tree-root-dot {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: rgba(245,158,11,0.5);
                    pointer-events: none;
                }

                /* Ícones de nível */
                .outline-level-icon {
                    flex-shrink: 0;
                    font-size: 0.7rem;
                    line-height: 1;
                }
                .outline-level-icon.level-0 {
                    color: #58a6ff;
                    font-size: 0.65rem;
                }
                .outline-level-icon.level-1 {
                    color: #7dd3fc;
                    font-size: 0.75rem;
                }
                .outline-level-icon.level-2 {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                /* EDITOR AREA */
                .ide-editor-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #0d1117;
                    position: relative;
                }

                .ide-editor-wrapper {
                    position: relative;
                    flex: 1;
                    overflow: hidden;
                }

                .editor-tab-header {
                    display: flex;
                    justify-content: space-between;
                    background: #161b22;
                }

                .tab-title {
                    background: #0d1117;
                    padding: 10px 20px;
                    font-size: 0.85rem;
                    color: #58a6ff;
                    border-top: 2px solid #58a6ff;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    border-left: 1px solid rgba(255,255,255,0.05);
                    font-family: 'JetBrains Mono', monospace;
                }

                .expand-panel-btn {
                    background: transparent;
                    color: #8b949e;
                    border: none;
                    padding: 0 15px;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                .expand-panel-btn:hover { color: white; }

                .ide-highlight-backdrop {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    margin: 0;
                    padding: 20px;
                    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    box-sizing: border-box;
                    color: transparent;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    overflow: hidden;
                    pointer-events: none;
                    border: none;
                    z-index: 0;
                }
                .var-hl-valid {
                    background: rgba(16, 185, 129, 0.22);
                    color: transparent;
                    border-radius: 4px;
                    outline: 1px solid rgba(16, 185, 129, 0.5);
                }
                .var-hl-unknown {
                    background: rgba(239, 68, 68, 0.18);
                    color: transparent;
                    border-radius: 4px;
                    outline: 1px solid rgba(239, 68, 68, 0.4);
                }
                .ide-textarea {
                    position: relative;
                    z-index: 1;
                    width: 100%; height: 100%;
                    margin: 0;
                    padding: 20px;
                    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    box-sizing: border-box;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    color: #e6edf3 !important;
                    resize: none;
                    outline: none;
                }

                .ide-textarea::placeholder {
                    color: rgba(255,255,255,0.3) !important;
                }

                .outline-item.active {
                    background: rgba(88, 166, 255, 0.15);
                    color: #fff;
                    box-shadow: inset 3px 0 0 #58a6ff;
                    font-weight: 600;
                }

                /* [IF:] items in outline */
                .outline-item-if {
                    padding: 5px 12px 5px 0;
                    padding-right: 12px;
                    gap: 6px;
                    border-left: 2px solid transparent;
                }
                .outline-item-if:hover {
                    background: rgba(245, 158, 11, 0.08);
                    color: #fbbf24;
                    border-left-color: #f59e0b;
                }
                .active-if {
                    background: rgba(245, 158, 11, 0.12);
                    color: #fbbf24;
                    box-shadow: inset 3px 0 0 #f59e0b;
                }

                .if-badge {
                    display: inline-flex;
                    align-items: center;
                    background: rgba(245, 158, 11, 0.15);
                    color: #f59e0b;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    padding: 1px 5px;
                    letter-spacing: 0.5px;
                    flex-shrink: 0;
                }

                .if-varname {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.8rem;
                    color: #fcd34d;
                    word-break: break-all;
                }

                /* Conditional variables panel */
                .conditional-vars-panel {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 10px 16px;
                    background: rgba(245, 158, 11, 0.04);
                    border-top: 1px solid rgba(245, 158, 11, 0.15);
                }

                .conditional-vars-label {
                    font-size: 0.75rem;
                    color: #92400e;
                    color: #a16207;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .conditional-vars-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .conditional-var-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.25);
                    border-radius: 20px;
                    padding: 3px 10px 3px 6px;
                    font-size: 0.78rem;
                    color: #fbbf24;
                    font-family: 'JetBrains Mono', monospace;
                }

                .chip-if {
                    background: #f59e0b;
                    color: #1c1917;
                    font-size: 0.6rem;
                    font-weight: 800;
                    padding: 1px 4px;
                    border-radius: 3px;
                    letter-spacing: 0.5px;
                }
                
                .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 5px; border: 3px solid transparent; background-clip: content-box; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    );
};

export default PromptEditor;
