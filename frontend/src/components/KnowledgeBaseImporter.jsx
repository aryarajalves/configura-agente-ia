import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../api/client';

const KnowledgeBaseImporter = ({ onCancel, onComplete, initialFile, initialUrl, initialText, kbType = 'qa', kbId: propKbId }) => {
    // Determine kbId from prop or URL (fallback)
    const getKbId = () => {
        if (propKbId) return propKbId;
        const pathParts = window.location.pathname.split('/');
        return pathParts[pathParts.length - 1];
    };
    const kbId = getKbId();
    // Stages: 'config', 'preview', 'saving', 'success'
    const [stage, setStage] = useState('config');
    const [file, setFile] = useState(initialFile || null);
    const [url, setUrl] = useState(initialUrl || '');
    const [pastedText, setPastedText] = useState(initialText || '');

    // PDF/URL Smart Config
    const [smartConfig, setSmartConfig] = useState({
        startPage: 1,
        endPage: null,
        chunkSize: 1000,
        useAI: true,
        qaCount: 2,
        mode: 'global', // 'chunk' | 'global' | 'sections'
        userSuggestions: '',
        globalQaCount: 10,
        qaPerSection: 8,
        useVision: false,
        extractionType: 'suggestions',
        model: 'gpt-4o-mini'
    });

    // CSV/Excel Mapping
    const [columns, setColumns] = useState([]);
    const [mapping, setMapping] = useState({
        question: '',
        answer: '',
        metadata_val: '',
        category: '',
    });
    const [skippedConfig, setSkippedConfig] = useState(false);
    const [primaryColumn, setPrimaryColumn] = useState('');
    const [productFields, setProductFields] = useState([
        { label: 'Nome: ', column: '' },
        { label: 'Descrição: ', column: '' },
        { label: 'Preço: ', column: '' }
    ]);
    const [qaAnswerFields, setQaAnswerFields] = useState([
        { label: '', column: '' }
    ]);
    const [csvPreview, setCsvPreview] = useState([]);
    const [categoryMode, setCategoryMode] = useState('column');
    const [manualCategory, setManualCategory] = useState('Geral');
    const [metadataMode, setMetadataMode] = useState('column');
    const [manualMetadata, setManualMetadata] = useState('');
    const [totalRows, setTotalRows] = useState(0);
    const [isTableMode, setIsTableMode] = useState(false);

    // Stats & Data
    const [loading, setLoading] = useState(!!initialFile || !!initialText || !!initialUrl);
    const [error, setError] = useState(null);
    const [previewItems, setPreviewItems] = useState([]);
    const [importStats, setImportStats] = useState({ added: 0, updated: 0 });
    const [usage, setUsage] = useState(null);
    const lastAnalyzedText = useRef('');
    const [progress, setProgress] = useState(0);
 // { total_tokens, cost_brl, models }
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const [scrollBarWidth, setScrollBarWidth] = useState(0);
    const [sourceView, setSourceView] = useState(null); // The item whose source we are viewing
    const [maximizedField, setMaximizedField] = useState(null); // { idx, field, label, value }
    const [kbLabels, setKbLabels] = useState({ question: 'Pergunta', answer: 'Resposta', metadata: 'Metadado' });

    const isPdf = file?.name?.toLowerCase().endsWith('.pdf');
    const isImage = file?.name?.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/i);
    const isUrl = !!url;
    const isText = !!pastedText;

    useEffect(() => {
        if (file) {
            analyzeFile(file);
        }
    }, [file]);

    useEffect(() => {
        if (pastedText && pastedText !== lastAnalyzedText.current && stage === 'config') {
            lastAnalyzedText.current = pastedText;
            
            // Auto-detect if it's a table/CSV/JSON
            const looksLikeTable = pastedText.includes('<tr>') || 
                                  pastedText.includes('<table') || 
                                  pastedText.trim().startsWith('[') || 
                                  pastedText.trim().startsWith('{');
            
            if (looksLikeTable) {
                analyzePastedText();
            } else if (initialText) {
                setSkippedConfig(true);
                (async () => {
                    await handleGeneratePreview();
                })();
            }
        }
    }, [pastedText, stage, initialText]);

    useEffect(() => {
        const fetchKbData = async () => {
            if (!kbId) return;
            try {
                const res = await api.get(`/knowledge-bases/${kbId}`);
                if (res.ok) {
                    const data = await res.json();
                    setKbLabels({
                        question: data.question_label || 'Pergunta',
                        answer: data.answer_label || 'Resposta',
                        metadata: data.metadata_label || 'Metadado'
                    });
                }
            } catch (e) {
                console.error("Erro ao buscar labels da KB:", e);
            }
        };
        fetchKbData();
    }, [kbId]);

    useEffect(() => {
        const handleScroll = () => {
            if (scrollRef.current) {
                const element = scrollRef.current;
                const totalScroll = element.scrollHeight - element.clientHeight;
                const currentScroll = element.scrollTop;
                if (totalScroll > 0) {
                    setScrollBarWidth((currentScroll / totalScroll) * 100);
                }
            }
        };

        const container = scrollRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) container.removeEventListener('scroll', handleScroll);
        };
    }, [stage, previewItems]);
    const analyzeFile = async (selectedFile) => {
        setLoading(true);
        setError(null);
        setProgress(0);
        let interval = setInterval(() => {
            setProgress(p => (p < 90 ? p + 5 : p));
        }, 300);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await api.post('/knowledge-bases/analyze-file', formData);
            const data = await response.json();
            clearInterval(interval);
            setProgress(100);

            if (data.error) {
                setError(data.error);
            } else if (data.is_pdf || data.is_image) {
                setSmartConfig(prev => ({
                    ...prev,
                    startPage: 1,
                    endPage: data.page_count || 1
                }));
            } else {
                setColumns(data.columns || []);
                setCsvPreview(data.preview || []);
                setTotalRows(data.total_rows || 0);
                // Auto-map logic
                const qCol = data.columns.find(c => ['pergunta', 'question', 'pergunta/chave', 'dúvida', 'title', 'produto', 'product', 'nome'].some(key => c.toLowerCase().includes(key)));
                const aCol = data.columns.find(c => ['resposta', 'answer', 'conteúdo', 'content', 'descrição', 'description'].some(key => c.toLowerCase().includes(key)));
                const mCol = data.columns.find(c => ['metadado', 'metadata', 'info', 'extra'].some(key => c.toLowerCase().includes(key)));
                const catCol = data.columns.find(c => ['categoria', 'category', 'tag'].some(key => c.toLowerCase().includes(key)));
                const priceCol = data.columns.find(c => ['preço', 'valor', 'price', 'cost'].some(key => c.toLowerCase().includes(key)));

                setMapping({
                    question: qCol || data.columns[0] || '',
                    answer: aCol || data.columns[1] || '',
                    metadata_val: mCol || '',
                    category: catCol || ''
                });

                // Auto-map up to 10 columns by default to give a full "unified" result
                setQaAnswerFields(
                    data.columns.slice(0, 10).map(c => ({ label: `${c}: `, column: c }))
                );

                setPrimaryColumn(data.columns[0] || '');
                setProductFields([
                    { label: qCol ? `${qCol}: ` : 'Nome: ', column: qCol || data.columns[0] || '' },
                    { label: aCol ? `${aCol}: ` : 'Descrição: ', column: aCol || data.columns[1] || '' },
                    { label: priceCol ? `${priceCol}: ` : 'Preço: ', column: priceCol || '' }
                ]);
            }
        } catch (err) {
            setError("Falha ao analisar arquivo.");
        } finally {
            if (interval) clearInterval(interval);
            setLoading(false);
        }
    };
    const analyzePastedText = async () => {
        setLoading(true);
        setError(null);
        setProgress(0);
        setTimeout(() => setProgress(15), 50); 
        const interval = setInterval(() => {
            setProgress(p => (p < 85 ? p + 10 : p));
        }, 200);

        const formData = new FormData();
        formData.append('text', pastedText);

        try {
            const response = await api.post('/knowledge-bases/analyze-text', formData);
            const data = await response.json();
            clearInterval(interval);

            if (data.error) {
                setIsTableMode(false);
                setProgress(100);
            } else if (data.is_structured) {
                if (data.columns && data.columns.length > 0) {
                    setColumns(data.columns);
                    setCsvPreview(data.preview || []);
                    setTotalRows(data.total_rows || 0);
                    setIsTableMode(true);
                    setProgress(100);
                } else {
                    setSkippedConfig(true);
                    await handleGeneratePreview();
                }
            } else {
                setColumns(data.columns || []);
                setCsvPreview(data.preview || []);
                const qCol = data.columns.find(c => ['pergunta', 'question', 'pergunta/chave', 'dúvida', 'title', 'produto', 'product', 'nome'].some(key => c.toLowerCase().includes(key)));
                const aCol = data.columns.find(c => ['resposta', 'answer', 'conteúdo', 'content', 'descrição', 'description'].some(key => c.toLowerCase().includes(key)));
                const mCol = data.columns.find(c => ['metadado', 'metadata', 'info', 'extra'].some(key => c.toLowerCase().includes(key)));
                const catCol = data.columns.find(c => ['categoria', 'category', 'tag'].some(key => c.toLowerCase().includes(key)));
                setMapping({ question: qCol || data.columns[0] || '', answer: aCol || data.columns[1] || '', metadata_val: mCol || '', category: catCol || '' });
                if (data.columns.length > 0) setQaAnswerFields([{ label: '', column: aCol || data.columns[1] || data.columns[0] }]);
                setIsTableMode(true);
                setProgress(100);
            }
        } catch (err) {
            clearInterval(interval);
            setError("Erro ao analisar o texto colado.");
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePreview = async () => {
        setLoading(true);
        setProgress(0);
        setTimeout(() => setProgress(5), 50);
        const interval = setInterval(() => {
            setProgress(p => (p < 95 ? p + 2 : p));
        }, 500);
        
        setError(null);

        try {
            const formData = new FormData();
            if (isUrl) {
                formData.append('url', url);
            } else if (isText) {
                formData.append('text', pastedText);
            } else {
                formData.append('file', file);
                formData.append('start_page', smartConfig.startPage);
                if (smartConfig.endPage) formData.append('end_page', smartConfig.endPage);
            }

            formData.append('chunk_size', smartConfig.chunkSize);
            formData.append('use_ai_qa', smartConfig.useAI);
            formData.append('mode', smartConfig.mode);
            formData.append('global_qa_count', smartConfig.globalQaCount);
            formData.append('qa_per_section', smartConfig.qaPerSection);
            formData.append('use_vision', smartConfig.useVision);
            if (smartConfig.userSuggestions) formData.append('user_suggestions', smartConfig.userSuggestions);
            formData.append('extraction_type', smartConfig.extractionType);
            formData.append('model', smartConfig.model);

            const endpoint = isUrl
                ? `/knowledge-bases/${kbId}/preview-url-import`
                : isText
                    ? `/knowledge-bases/${kbId}/preview-text-import`
                    : `/knowledge-bases/${kbId}/preview-smart-import`;

            const response = await api.post(endpoint, formData);
            const data = await response.json();
            clearInterval(interval);
            setProgress(100);

            if (data.error) {
                setError(data.error);
            } else {
                setPreviewItems(data.preview || []);
                setUsage(data.usage || null);
                if (data.is_structured_json) {
                    setSmartConfig(prev => ({ ...prev, useAI: false }));
                    setKbLabels(prev => ({
                        ...prev,
                        question: data.q_label || prev.question,
                        answer: data.a_label || prev.answer,
                        metadata: data.m_label || prev.metadata
                    }));
                }
                setStage('preview');
            }
        } catch (err) {
            clearInterval(interval);
            setError(`Erro ao gerar prévia ${isUrl ? 'da URL' : isText ? 'do texto' : 'inteligente'}.`);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBatch = async () => {
        setLoading(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(p => (p < 90 ? p + 5 : p));
        }, 200);
        
        const selectedItems = previewItems.filter(i => i.selected);

        try {
            // Using the new batch endpoint
            const response = await api.post(`/knowledge-bases/${kbId}/import-batch`, { items: selectedItems });
            const data = await response.json();
            clearInterval(interval);
            setProgress(100);

            if (response.ok) {
                const matches = (data.message || "").match(/\d+/g);
                setImportStats({ added: matches ? parseInt(matches[0]) : selectedItems.length, updated: 0 });
                setStage('success');
            } else {
                setError(data.detail || "Erro ao salvar itens.");
            }
        } catch (err) {
            clearInterval(interval);
            setError("Erro de conexão ao salvar.");
        } finally {
            setLoading(false);
            // Don't reset to 0 here to avoid jump if we stay on same screen, but usually setLoading(false) hides it
        }
    };

    const handleLegacyImport = async () => {
        if (kbType === 'product') {
            if (productFields.every(f => !f.column)) {
                setError("Mapeie pelo menos um campo informativo.");
                return;
            }
        } else {
            const activeQAFields = qaAnswerFields.filter(f => f.column);
            if (activeQAFields.length === 0) {
                setError("Mapeie pelo menos uma coluna do arquivo.");
                return;
            }
        }
        
        setLoading(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(p => (p < 90 ? p + 5 : p));
        }, 300);

        const formData = new FormData();
        
        let endpoint;
        if (isText && isTableMode) {
            formData.append('text', pastedText);
            endpoint = kbType === 'product' ? `/knowledge-bases/${kbId}/import-products-text` : `/knowledge-bases/${kbId}/import-mapped-text`;
        } else {
            formData.append('file', file);
            endpoint = kbType === 'product' ? `/knowledge-bases/${kbId}/import-products` : `/knowledge-bases/${kbId}/import-mapped`;
        }

        if (kbType === 'product') {
            formData.append('mapping_json', JSON.stringify(productFields.filter(f => f.column)));
            formData.append('primary_col', primaryColumn);
        } else {
            const activeQAFields = qaAnswerFields.filter(f => f.column);

            // Use the first mapped column as the unique identifier/question
            formData.append('question_col', activeQAFields[0].column);
            formData.append('answer_col', activeQAFields[0].column); // fallback
            formData.append('answer_mapping_json', JSON.stringify(activeQAFields));
        }

        if (categoryMode === 'manual') formData.append('fixed_category', manualCategory);
        else if (mapping.category) formData.append('category_col', mapping.category);

        if (metadataMode === 'manual') formData.append('fixed_metadata', manualMetadata);
        else if (mapping.metadata_val) formData.append('metadata_col', mapping.metadata_val);

        try {
            const response = await api.post(endpoint, formData);
            const data = await response.json();
            clearInterval(interval);
            setProgress(100);
            if (response.ok) {
                const matches = (data.message || "").match(/\d+/g);
                setImportStats({
                    added: matches ? parseInt(matches[0]) : 0,
                    updated: matches && matches.length > 1 ? parseInt(matches[1]) : 0
                });
                setUsage(null);
                setStage('success');
            } else {
                const rawErr = data.error || data.detail;
                const errMsg = typeof rawErr === 'string' ? rawErr :
                    Array.isArray(rawErr) ? rawErr.map(e => e.msg || JSON.stringify(e)).join(", ") :
                        (rawErr ? JSON.stringify(rawErr) : "Erro na importação");
                setError(errMsg);
            }
        } catch (err) {
            setError(err.message || "Erro na importação: Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderConfig = () => {
        if (!isPdf && !isImage && !isUrl && (!isText || isTableMode)) {
            if (kbType === 'product') {
                return (
                    <div className="import-config-grid">
                        <div className="config-controls">
                            <h4 className="config-title">🏷️ Mapeamento de Catálogo</h4>
                            <p className="config-subtitle">Sincronize os produtos da sua planilha.</p>

                            <div className="mapping-card">
                                <div className="mapping-item">
                                    <label>🏷️ {kbLabels.metadata} (Opcional)</label>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <button
                                            type="button"
                                            className={`toggle-btn-small ${metadataMode === 'column' ? 'active' : ''}`}
                                            onClick={() => setMetadataMode('column')}
                                        >Coluna</button>
                                        <button
                                            type="button"
                                            className={`toggle-btn-small ${metadataMode === 'manual' ? 'active' : ''}`}
                                            onClick={() => setMetadataMode('manual')}
                                        >Fixo</button>
                                    </div>
                                    {metadataMode === 'column' ? (
                                        <select value={mapping.metadata_val} onChange={e => setMapping({ ...mapping, metadata_val: e.target.value })}>
                                            <option value="">Vazio / Opcional</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder={`Ex: Modulo 1, Tag...`}
                                            value={manualMetadata}
                                            onChange={e => setManualMetadata(e.target.value)}
                                            className="csv-manual-input"
                                        />
                                    )}
                                </div>

                                <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800 }}>CAMPOS INFORMATIVOS</label>
                                </div>

                                {productFields.map((field, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
                                        <div className="mapping-item" style={{ marginBottom: 0 }}>
                                            <input
                                                type="text"
                                                value={field.label}
                                                placeholder="Prefixo (ex: Preço: )"
                                                onChange={e => {
                                                    const newFields = [...productFields];
                                                    newFields[idx].label = e.target.value;
                                                    setProductFields(newFields);
                                                }}
                                                style={{ height: '42px', width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                            />
                                        </div>
                                        <div className="mapping-item" style={{ marginBottom: 0 }}>
                                            <select
                                                value={field.column}
                                                onChange={e => {
                                                    const selectedCol = e.target.value;
                                                    const newFields = [...productFields];
                                                    newFields[idx].column = selectedCol;
                                                    // Auto-fill label if it's empty or was the previous column name
                                                    if (selectedCol && (!newFields[idx].label || newFields[idx].label.trim() === '')) {
                                                        newFields[idx].label = `${selectedCol}: `;
                                                    }
                                                    setProductFields(newFields);
                                                }}
                                                style={{ height: '42px', width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                            >
                                                <option value="">Nenhum</option>
                                                {columns.map(c => <option key={c} value={c} disabled={productFields.some((f, i) => i !== idx && f.column === c)}>{c}</option>)}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => setProductFields(productFields.filter((_, i) => i !== idx))}
                                            style={{ height: '42px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer' }}
                                        >✕</button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setProductFields([...productFields, { label: '', column: '' }])}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '10px' }}
                                >+ Adicionar Novo Campo</button>

                                <div className="mapping-item" style={{ marginTop: '1.5rem' }}>
                                    <label>📂 Categoria (Opcional)</label>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <button
                                            type="button"
                                            className={`toggle-btn-small ${categoryMode === 'column' ? 'active' : ''}`}
                                            onClick={() => setCategoryMode('column')}
                                        >Coluna</button>
                                        <button
                                            type="button"
                                            className={`toggle-btn-small ${categoryMode === 'manual' ? 'active' : ''}`}
                                            onClick={() => setCategoryMode('manual')}
                                        >Fixo</button>
                                    </div>
                                    {categoryMode === 'column' ? (
                                        <select value={mapping.category} onChange={e => setMapping({ ...mapping, category: e.target.value })}>
                                            <option value="">Nenhuma (Mesma p/ Todos)</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Ex: Geral, Produtos..."
                                            value={manualCategory}
                                            onChange={e => setManualCategory(e.target.value)}
                                            className="csv-manual-input"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="preview-area">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 className="config-title" style={{ margin: 0 }}>👀 Prévia da Planilha</h4>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {totalRows > 0 ? `Exibindo primeiros 5 de ${totalRows} itens detectados` : 'Exibindo primeiras 5 linhas'}
                                </span>
                            </div>
                            <div className="preview-scroll">
                                <table className="mini-preview-table">
                                    <thead>
                                        <tr>
                                            {columns.slice(0, 4).map(col => <th key={col}>{col}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvPreview.slice(0, 5).map((row, i) => (
                                            <tr key={i}>
                                                {columns.slice(0, 4).map(col => <td key={col}>{row[col] || '-'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            }

            // Standard CSV View (Unified Mapping)
            return (
                <div className="import-config-grid">
                    <div className="config-controls">
                        <h4 className="config-title">🛠️ Seleção de Informações do {isText ? 'Texto' : 'Arquivo'}</h4>
                        <p className="config-subtitle">Escolha quais colunas quer unir para criar o conhecimento. O Agent vai formatá-las automaticamente.</p>

                        <div className="mapping-card">
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800 }}>📌 DADOS DO {isText ? 'TEXTO' : 'ARQUIVO'}</label>
                            </div>

                            {qaAnswerFields.map((field, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
                                    <div className="mapping-item" style={{ marginBottom: 0 }}>
                                        <input
                                            type="text"
                                            value={field.label}
                                            placeholder="Nome na resposta (ex: Preço: )"
                                            onChange={e => {
                                                const newFields = [...qaAnswerFields];
                                                newFields[idx].label = e.target.value;
                                                setQaAnswerFields(newFields);
                                            }}
                                            style={{ height: '42px', width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                        />
                                    </div>
                                    <div className="mapping-item" style={{ marginBottom: 0 }}>
                                        <select
                                            value={field.column}
                                            onChange={e => {
                                                const selectedCol = e.target.value;
                                                const newFields = [...qaAnswerFields];
                                                newFields[idx].column = selectedCol;
                                                if (selectedCol && (!newFields[idx].label || newFields[idx].label.trim() === '')) {
                                                    newFields[idx].label = `${selectedCol}: `;
                                                }
                                                setQaAnswerFields(newFields);
                                            }}
                                            style={{ height: '42px', width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                        >
                                            <option value="">Selecione Coluna</option>
                                            {columns.map(c => <option key={c} value={c} disabled={qaAnswerFields.some((f, i) => i !== idx && f.column === c)}>{c}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => setQaAnswerFields(qaAnswerFields.filter((_, i) => i !== idx))}
                                        style={{ height: '42px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer' }}
                                        disabled={qaAnswerFields.length === 1}
                                    >✕</button>
                                </div>
                            ))}

                            <div className="mapping-item">
                                <label>🏷️ {kbLabels.metadata} (Opcional)</label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <button
                                        type="button"
                                        className={`toggle-btn-small ${metadataMode === 'column' ? 'active' : ''}`}
                                        onClick={() => setMetadataMode('column')}
                                    >Coluna</button>
                                    <button
                                        type="button"
                                        className={`toggle-btn-small ${metadataMode === 'manual' ? 'active' : ''}`}
                                        onClick={() => setMetadataMode('manual')}
                                    >Fixo</button>
                                </div>
                                {metadataMode === 'column' ? (
                                    <select value={mapping.metadata_val} onChange={e => setMapping({ ...mapping, metadata_val: e.target.value })}>
                                        <option value="">Vazio / Opcional</option>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={`Ex: Modulo 1, Tag...`}
                                        value={manualMetadata}
                                        onChange={e => setManualMetadata(e.target.value)}
                                        className="csv-manual-input"
                                    />
                                )}
                            </div>

                            <div className="mapping-item">
                                <label>📂 Categoria (Opcional)</label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <button
                                        type="button"
                                        className={`toggle-btn-small ${categoryMode === 'column' ? 'active' : ''}`}
                                        onClick={() => setCategoryMode('column')}
                                    >Coluna</button>
                                    <button
                                        type="button"
                                        className={`toggle-btn-small ${categoryMode === 'manual' ? 'active' : ''}`}
                                        onClick={() => setCategoryMode('manual')}
                                    >Fixo</button>
                                </div>
                                {categoryMode === 'column' ? (
                                    <select value={mapping.category} onChange={e => setMapping({ ...mapping, category: e.target.value })}>
                                        <option value="">Nenhuma (Geral)</option>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Ex: Geral, Suporte..."
                                        value={manualCategory}
                                        onChange={e => setManualCategory(e.target.value)}
                                        className="csv-manual-input"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="preview-area">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="config-title" style={{ margin: 0 }}>👀 Prévia do {isText ? 'Texto' : 'Arquivo'}</h4>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {totalRows > 0 ? `Exibindo primeiros 5 de ${totalRows} itens detectados` : 'Exibindo primeiras 5 linhas'}
                            </span>
                        </div>
                        <div className="preview-scroll">
                            <table className="mini-preview-table">
                                <thead>
                                    <tr>
                                        {columns.slice(0, 4).map(col => (
                                            <th key={col}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvPreview.slice(0, 5).map((row, i) => (
                                        <tr key={i}>
                                            {columns.slice(0, 4).map(col => (
                                                <td key={col} title={row[col]}>{row[col] || '-'}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        // PDF / Image / URL / Text Smart Config
        return (
            <div className="smart-config-container">
                {/* 1. Escopo (Only for PDF) */}
                {isPdf && (
                    <div className="smart-option-card">
                        <div className="option-icon">📄</div>
                        <div className="option-content">
                            <h4>Escopo do Documento</h4>
                            <p>Defina quais páginas do PDF devem ser processadas.</p>
                            <div className="range-inputs">
                                <div className="input-group">
                                    <label>Página Inicial</label>
                                    <input
                                        type="number" min="1"
                                        value={smartConfig.startPage}
                                        onChange={e => setSmartConfig({ ...smartConfig, startPage: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Página Final (Opcional)</label>
                                    <input
                                        type="number" min="1" placeholder="Fim"
                                        value={smartConfig.endPage || ''}
                                        onChange={e => setSmartConfig({ ...smartConfig, endPage: e.target.value ? parseInt(e.target.value) : null })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* URL Display if in URL Mode */}
                {isUrl && (
                    <div className="smart-option-card">
                        <div className="option-icon">🌐</div>
                        <div className="option-content">
                            <h4>Extraindo de Site</h4>
                            <p>O conteúdo será lido diretamente do endereço abaixo.</p>
                            <div className="url-badge" style={{
                                background: '#0f172a',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: '#818cf8',
                                fontSize: '0.85rem',
                                wordBreak: 'break-all',
                                fontWeight: '600'
                            }}>
                                {url}
                            </div>
                        </div>
                    </div>
                )}

                {/* Text Display if in Text Mode */}
                {isText && (
                    <div className="smart-option-card" style={{ gridColumn: 'span 2' }}>
                        <div className="option-icon">📋</div>
                        <div className="option-content" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4>Processar Texto Colado</h4>
                                    <p>O Agent analisará os {pastedText.length} caracteres colados.</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>O conteúdo é uma Tabela/CSV?</span>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={isTableMode}
                                            onChange={e => {
                                                if (e.target.checked) analyzePastedText();
                                                else setIsTableMode(false);
                                            }}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="url-badge" style={{
                                background: '#0f172a',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: '#818cf8',
                                fontSize: '0.85rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                                marginTop: '10px'
                            }}>
                                {pastedText.substring(0, 200)}...
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Estratégia de IA */}
                <div className="smart-option-card" style={{ gridColumn: isUrl || isPdf || isImage || isText ? 'span 2' : 'span 1' }}>
                    <div className="option-icon">🧠</div>
                    <div className="option-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h4>Estratégia de Importação</h4>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={smartConfig.useAI}
                                    onChange={e => setSmartConfig({ ...smartConfig, useAI: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        {!smartConfig.useAI ? (
                            <p style={{ opacity: 0.7 }}>Ative a IA para gerar perguntas e respostas automaticamente.</p>
                        ) : (
                            <div className="fade-in">
                                <div className="global-mode-config fade-in">

                                    {/* Processing Mode Selector */}
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>Modo de Processamento</label>
                                        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSmartConfig({ ...smartConfig, mode: 'global' })}
                                                className={`extraction-type-btn ${smartConfig.mode !== 'sections' ? 'active' : ''}`}
                                            >
                                                🌐 Documento Completo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSmartConfig({ ...smartConfig, mode: 'sections' })}
                                                className={`extraction-type-btn ${smartConfig.mode === 'sections' ? 'active' : ''}`}
                                            >
                                                {'\uD83D\uDCDA'} Por Seção
                                            </button>
                                        </div>
                                        {smartConfig.mode === 'sections' ? (
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', lineHeight: '1.5' }}>
                                                Detecta automaticamente as seções do documento e gera Q&amp;As focadas para cada uma. Ideal para manuais e documentos longos.
                                            </p>
                                        ) : (
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', lineHeight: '1.5' }}>
                                                A IA analisará o conteúdo completo para criar uma base de conhecimento estratégica e conectada.
                                            </p>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setSmartConfig({ ...smartConfig, extractionType: 'suggestions' })}
                                            className={`extraction-type-btn ${smartConfig.extractionType !== 'specific' ? 'active' : ''}`}
                                        >
                                            🧠 Sugestões da IA
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSmartConfig({ ...smartConfig, extractionType: 'specific' })}
                                            className={`extraction-type-btn ${smartConfig.extractionType === 'specific' ? 'active' : ''}`}
                                        >
                                            🎯 Perguntas Específicas
                                        </button>
                                    </div>

                                    <div className="input-group" style={{ marginBottom: '15px' }}>
                                        <label>
                                            {smartConfig.extractionType === 'specific'
                                                ? 'Quais perguntas o agente deve responder?'
                                                : 'Foco / Sugestões para a IA (Opcional)'}
                                        </label>
                                        <textarea
                                            placeholder={smartConfig.extractionType === 'specific'
                                                ? "Digite uma pergunta por linha...\nEx: Qual a garantia do produto?\nComo funciona a entrega?"
                                                : "Ex: Foque em prazos de entrega e garantias. Crie perguntas curtas."}
                                            value={smartConfig.userSuggestions}
                                            onChange={e => setSmartConfig({ ...smartConfig, userSuggestions: e.target.value })}
                                            rows={4}
                                            className="smart-textarea"
                                        />
                                        {smartConfig.extractionType === 'specific' && (
                                            <p style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '5px', fontWeight: '600' }}>
                                                ✨ O agente buscará as respostas no {isUrl ? 'site' : isText ? 'texto colado' : 'PDF'} para cada pergunta acima.
                                            </p>
                                        )}
                                    </div>

                                    <div className="input-group" style={{ marginBottom: '15px' }}>
                                        <label>🤖 Modelo de Inteligência</label>
                                        <select
                                            value={smartConfig.model}
                                            onChange={e => setSmartConfig({ ...smartConfig, model: e.target.value })}
                                            className="smart-select"
                                            style={{
                                                width: '100%',
                                                background: '#0f172a',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                                padding: '10px',
                                                borderRadius: '10px',
                                                marginTop: '5px',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="gpt-5.2">GPT-5.2 (Estado da Arte - Máxima Inteligência)</option>
                                            <option value="gpt-5.1">GPT-5.1 (Raciocínio Avançado)</option>
                                            <option value="gpt-5">GPT-5 (Versátil)</option>
                                            <option value="gpt-5-mini">GPT-5 Mini (Eficiência de Próxima Geração)</option>
                                            <option value="gpt-5-nano">GPT-5 Nano (Ultra-Rápido)</option>
                                            <option value="gpt-4o">GPT-4o (Confiável para Manuais Técnicos)</option>
                                            <option value="gpt-4o-mini">GPT-4o Mini (Rápido e Barato)</option>
                                        </select>
                                    </div>

                                    {smartConfig.mode === 'sections' ? (
                                        <div className="input-group" style={{ marginBottom: '15px' }}>
                                            <label>Q&amp;As por Seção</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <input
                                                    type="range" min="3" max="20" step="1"
                                                    value={smartConfig.qaPerSection}
                                                    onChange={e => setSmartConfig({ ...smartConfig, qaPerSection: parseInt(e.target.value) })}
                                                    style={{ flex: 1 }}
                                                />
                                                <span style={{
                                                    minWidth: '40px',
                                                    textAlign: 'center',
                                                    background: '#1e293b',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '800',
                                                    color: '#818cf8'
                                                }}>{smartConfig.qaPerSection}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="input-group" style={{ marginBottom: '15px' }}>
                                            <label>Quantidade Total de Perguntas</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <input
                                                    type="range" min="5" max="50" step="5"
                                                    value={smartConfig.globalQaCount}
                                                    onChange={e => setSmartConfig({ ...smartConfig, globalQaCount: parseInt(e.target.value) })}
                                                    style={{ flex: 1 }}
                                                />
                                                <span style={{
                                                    minWidth: '40px',
                                                    textAlign: 'center',
                                                    background: '#1e293b',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '800',
                                                    color: '#818cf8'
                                                }}>{smartConfig.globalQaCount}</span>
                                            </div>
                                        </div>
                                    )}

                                    {smartConfig.mode === 'sections' && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                            <div>
                                                <strong style={{ fontSize: '0.85rem' }}>🔍 Processar Gráficos com Visão IA</strong>
                                                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0', lineHeight: '1.4' }}>
                                                    GPT-4o analisa imagens e gráficos das páginas. Aumenta o custo e o tempo.
                                                </p>
                                            </div>
                                            <label className="switch" style={{ flexShrink: 0, marginLeft: '12px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={smartConfig.useVision}
                                                    onChange={e => setSmartConfig({ ...smartConfig, useVision: e.target.checked })}
                                                />
                                                <span className="slider round"></span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Technical (Optional for URL) */}
                <div className="smart-option-card">
                    <div className="option-icon">✂️</div>
                    <div className="option-content">
                        <h4>Configuração Técnica</h4>
                        <p>Fragmentação de texto (Chunk Size)</p>
                        <input
                            type="range" min="500" max="3000" step="100"
                            value={smartConfig.chunkSize}
                            onChange={e => setSmartConfig({ ...smartConfig, chunkSize: parseInt(e.target.value) })}
                        />
                        <span style={{ fontSize: '0.8rem', float: 'right' }}>{smartConfig.chunkSize} chars</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderMaximizedModal = () => {
        if (!maximizedField) return null;
        const { idx, field, label, value } = maximizedField;
        
        return (
            <div className="max-modal-overlay" onClick={() => setMaximizedField(null)}>
                <div className="max-modal-content" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{label}</h3>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setMaximizedField(null)}
                            className="btn-modal-done"
                        >
                            Pronto
                        </button>
                    </div>
                    
                    <textarea
                        autoFocus
                        style={{
                            flex: 1,
                            width: '100%',
                            background: '#020617',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '16px',
                            color: '#fff',
                            padding: '20px',
                            fontSize: '1.1rem',
                            lineHeight: '1.6',
                            resize: 'none',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                        }}
                        value={value}
                        onChange={(e) => {
                            const newValue = e.target.value;
                            const newItems = [...previewItems];
                            newItems[idx][field] = newValue;
                            setPreviewItems(newItems);
                            setMaximizedField({ ...maximizedField, value: newValue });
                        }}
                    />
                </div>
            </div>
        );
    };

    const renderPreview = () => (
        <div className="smart-preview-container">
            {/* O Modal foi movido para o portal principal para evitar conflitos */}
            <div className="preview-header-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <span>Total Gerado: <strong>{previewItems.length}</strong></span>
                <span>Selecionados: <strong>{previewItems.filter(i => i.selected).length}</strong></span>

                {usage && (
                    <div className="usage-ribbon" style={{
                        display: 'flex', gap: '10px', marginLeft: 'auto',
                        background: 'rgba(99, 102, 241, 0.1)', padding: '5px 15px',
                        borderRadius: '30px', border: '1px solid rgba(99, 102, 241, 0.2)',
                        fontSize: '0.85rem'
                    }}>
                        <span title="Tokens Utilizados">🪙 {usage.total_tokens?.toLocaleString()} tokens</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>💰 R$ {usage.cost_brl?.toFixed(2)}</span>
                        <span title="Modelos Utilizados" style={{ opacity: 0.7 }}>🤖 {usage.models?.join(', ')}</span>
                    </div>
                )}
            </div>

            {/* Scroll Progress Bar */}
            <div className="preview-progress-track">
                <div className="preview-progress-bar" style={{ width: `${scrollBarWidth}%` }}></div>
            </div>

            <div className="preview-layout-container">
                <div className="smart-preview-list" style={{ flex: sourceView ? '1' : '1' }}>
                    {previewItems.map((item, idx) => (
                        <div 
                            key={item.id} 
                            className={`preview-item-card ${!item.selected ? 'item-unchecked' : ''} ${sourceView?.id === item.id ? 'active-source' : ''}`}
                            onClick={() => setSourceView(sourceView?.id === item.id ? null : item)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="item-check" onClick={e => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={(e) => {
                                        const newItems = [...previewItems];
                                        newItems[idx].selected = e.target.checked;
                                        setPreviewItems(newItems);
                                    }}
                                />
                            </div>
                            <div className="item-content-edit">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`type-badge ${item.type === 'ai_qa' ? 'ai' : 'raw'}`}>
                                            {item.type === 'ai_qa' ? '🧠 IA Gerada' : '📄 Trecho Original'}
                                        </span>
                                        {item.metadata?.page && (
                                            <span className="page-badge-premium">
                                                Pág. {item.metadata.page}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{kbLabels.question}</div>
                                <div className="input-wrapper-premium">
                                    <input
                                        className="edit-input title"
                                        value={item.question}
                                        onClick={e => e.stopPropagation()}
                                        onChange={(e) => {
                                            const newItems = [...previewItems];
                                            newItems[idx].question = e.target.value;
                                            setPreviewItems(newItems);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        className="maximize-btn-premium"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMaximizedField({ idx, field: 'question', label: kbLabels.question, value: item.question });
                                        }}
                                        title="Maximizar campo"
                                    >⤢</button>
                                </div>

                                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', marginTop: '8px' }}>{kbLabels.metadata}</div>
                                <div className="input-wrapper-premium">
                                    <input
                                        className="edit-input"
                                        style={{ marginBottom: '8px', fontSize: '0.85rem' }}
                                        value={item.metadata_val || ''}
                                        placeholder="Metadado (opcional)..."
                                        onClick={e => e.stopPropagation()}
                                        onChange={(e) => {
                                            const newItems = [...previewItems];
                                            newItems[idx].metadata_val = e.target.value;
                                            setPreviewItems(newItems);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        className="maximize-btn-premium"
                                        style={{ bottom: '16px' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMaximizedField({ idx, field: 'metadata_val', label: kbLabels.metadata, value: item.metadata_val || '' });
                                        }}
                                        title="Maximizar campo"
                                    >⤢</button>
                                </div>

                                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', marginTop: '8px' }}>{kbLabels.answer}</div>
                                <div className="input-wrapper-premium">
                                    <textarea
                                        className="edit-input body"
                                        value={item.answer}
                                        rows={3}
                                        placeholder="Digite a resposta..."
                                        style={{ resize: 'none' }}
                                        onClick={e => e.stopPropagation()}
                                        onChange={(e) => {
                                            const newItems = [...previewItems];
                                            newItems[idx].answer = e.target.value;
                                            setPreviewItems(newItems);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        className="maximize-btn-premium"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMaximizedField({ idx, field: 'answer', label: kbLabels.answer, value: item.answer });
                                        }}
                                        title="Maximizar campo"
                                    >⤢</button>
                                </div>
                                <div className="edit-indicator-premium">
                                    <div className="stats-indicator">
                                        <span className="char-stat">📏 {(item.question?.length || 0) + (item.answer?.length || 0) + (item.metadata_val?.length || 0)} CHARS</span>
                                        <span className="token-stat">🪙 ~{Math.ceil(((item.question?.length || 0) + (item.answer?.length || 0) + (item.metadata_val?.length || 0)) / 4)} TOKENS</span>
                                    </div>
                                    <div className="editable-label">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                        <span>Editável</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {sourceView && (
                    <div className="source-viewer-sidebar fade-in-right">
                        <div className="sidebar-header">
                            <h4>🔍 Fonte do Documento</h4>
                            <button onClick={() => setSourceView(null)}>✕</button>
                        </div>
                        <div className="sidebar-content">
                            <div className="source-meta-info">
                                <span>Origem: <strong>{sourceView.type === 'ai_qa' ? 'IA - Análise' : 'Extração Direta'}</strong></span>
                                {sourceView.metadata?.page && <span>Página: <strong>{sourceView.metadata.page}</strong></span>}
                            </div>
                            <div className="source-text-blob">
                                {sourceView.source_text || "O conteúdo completo deste trecho foi utilizado para gerar este item. No modo 'Global', a IA correlaciona informações de várias partes do documento."}
                            </div>
                            <div className="source-hint">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                Este é o conteúdo bruto antes da curadoria da IA.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="success-content">
            <div className="success-icon-wrapper"><span className="success-emoji">✅</span></div>
            <h2>Importação Concluída! 🎉</h2>

            <div className="stats-row">
                <div className="stat-item">
                    <span className="stat-value">{importStats.added}</span>
                    <span className="stat-label">Itens Adicionados</span>
                </div>
                {usage && (
                    <>
                        <div className="stat-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '40px' }}></div>
                        <div className="stat-item">
                            <span className="stat-value">R$ {usage.cost_brl?.toFixed(3)}</span>
                            <span className="stat-label">Investimento IA</span>
                        </div>
                        <div className="stat-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '40px' }}></div>
                        <div className="stat-item">
                            <span className="stat-value">{usage.total_tokens?.toLocaleString()}</span>
                            <span className="stat-label">Tokens Totais</span>
                        </div>
                    </>
                )}
            </div>

            {usage && (
                <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px' }}>
                    Processado com tecnologia <strong>{usage.models?.join(' e ')}</strong>
                </p>
            )}

            <button onClick={onComplete} className="btn-success-action">Visualizar Base Atualizada 🚀</button>
        </div>
    );

    // --- MAIN RENDER ---
    return ReactDOM.createPortal(
        <div className="importer-overlay fade-in">
            {maximizedField && renderMaximizedModal()}
            <div className="importer-card" onClick={e => e.stopPropagation()}>
                {stage !== 'success' && (
                    <header className="importer-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                background: stage === 'config' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${stage === 'config' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`,
                                color: stage === 'config' ? '#818cf8' : '#c084fc',
                                fontSize: '1.3rem'
                            }}>
                                {stage === 'config' ? '⚙️' : '👁️'}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>
                                    {stage === 'config' ?
                                        (isUrl ? 'Extrair de URL' : (isText && isTableMode) ? 'Mapear Colunas do Texto' : isText ? 'Processar Texto Colado' : 'Configurar Importação') :
                                        'Revisar Prévia'}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '2px 10px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        color: '#94a3b8',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        fontWeight: 600
                                    }}>
                                        {isUrl ? '🌐 URL' : isText ? '📋 TEXTO' : '📄 ARQUIVO'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                        {isUrl ? url : isText ? 'Conteúdo Colado' : (file?.name || 'Arquivo')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onCancel} className="close-btn">✕</button>
                    </header>
                )}

                <div className="importer-body">
                    {loading ? (
                        <div className="importer-loading-overlay">
                            <div className="loader-premium"></div>
                            <div className="loading-content">
                                <p>{(isText && stage === 'config') ? 'Analisando dados...' : 'Gerando Base de Conhecimento...'}</p>
                                <div className="progress-container-loader">
                                    <div 
                                        className="progress-bar-loader" 
                                        style={{ 
                                            width: `${progress}%`,
                                            transition: progress === 0 ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    ></div>
                                </div>
                                <span className="progress-text-loader-main">{Math.round(progress)}%</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="importer-error-state">
                            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f87171' }}>
                                {typeof error === 'string' ? error : JSON.stringify(error)}
                            </p>
                            <button onClick={() => { setError(null); setStage('config'); }} className="retry-btn">Voltar</button>
                        </div>
                    ) : (
                        <div className="scroll-container-premium" ref={scrollRef}>
                            {stage === 'config' && renderConfig()}
                            {stage === 'preview' && renderPreview()}
                            {stage === 'success' && renderSuccess()}
                        </div>
                    )}
                </div>

                {stage !== 'success' && !loading && !error && (
                    <footer className="importer-footer">
                        {stage === 'preview' && (
                            <button
                                onClick={() => {
                                    if (skippedConfig) {
                                        onCancel({ backToText: true, text: pastedText });
                                    } else {
                                        setStage('config');
                                    }
                                }}
                                className="btn-cancel"
                            >
                                Voltar
                            </button>
                        )}
                        <button onClick={onCancel} className="btn-cancel">Cancelar</button>

                        {stage === 'config' ? (
                            <button
                                onClick={(isPdf || isImage || isUrl || (isText && !isTableMode)) ? handleGeneratePreview : handleLegacyImport}
                                className="btn-import-confirm"
                            >
                                {(isPdf || isImage || isUrl || (isText && !isTableMode)) ? 'Processar Texto ➡️' : 'Importar Agora 🚀'}
                            </button>
                        ) : (
                            <button onClick={handleSaveBatch} className="btn-import-confirm">
                                Salvar {previewItems.filter(i => i.selected).length} Itens ✅
                            </button>
                        )}
                    </footer>
                )}
            </div>

            <style>{`
                /* Keep previous overlay styles + Add new ones */
                .importer-overlay {
                    position: fixed; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: rgba(7, 10, 19, 0.95); backdrop-filter: blur(15px);
                    z-index: 99999999; display: flex !important; align-items: center !important; justify-content: center !important;
                    padding: 20px; margin: 0 !important;
                }
                .importer-card {
                    background: #161d2f; border-radius: 28px; width: 95%; max-width: 1000px; max-height: 90vh;
                    display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8);
                    animation: modalCenterPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative; overflow: hidden; margin: auto !important;
                }
                @keyframes modalCenterPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .importer-body { padding: 30px; overflow-y: auto; flex: 1; }
                .importer-header { padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; color: white; }
                .importer-footer { padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 15px; }

                .btn-cancel { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 25px; border-radius: 12px; cursor: pointer; font-weight: 600; }
                .btn-import-confirm { background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; border: none; padding: 12px 30px; border-radius: 12px; cursor: pointer; font-weight: 800; }
                .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; }

                /* CSV Specific Styles */
                .import-config-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px; animation: fadeIn 0.4s ease-out; }
                .config-title { color: white; font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; }
                .config-subtitle { color: #94a3b8; font-size: 0.85rem; margin-bottom: 2rem; }

                .mapping-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 1.5rem;
                }
                .mapping-item label { display: block; color: #cbd5e1; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .mapping-item select, .csv-manual-input {
                    width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1);
                    color: white; padding: 12px 15px; border-radius: 12px; font-size: 0.9rem;
                    outline: none; transition: all 0.2s; cursor: pointer;
                }
                .mapping-item select:focus, .csv-manual-input:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }

                .toggle-btn-small {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8; padding: 4px 12px; border-radius: 8px; font-size: 0.7rem;
                    font-weight: 700; cursor: pointer; transition: all 0.2s;
                }
                .toggle-btn-small.active { background: #6366f1; color: white; border-color: #6366f1; }

                .preview-area { background: rgba(0,0,0,0.2); border-radius: 24px; padding: 25px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; }
                .preview-scroll { overflow: auto; border-radius: 16px; background: #0f172a; border: 1px solid rgba(255,255,255,0.05); max-height: 400px; }

                .mini-preview-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; color: #94a3b8; }
                .mini-preview-table th {
                    background: rgba(255,255,255,0.03); color: #fff; text-align: left;
                    padding: 12px 15px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08);
                    position: sticky; top: 0; white-space: nowrap;
                }
                .mini-preview-table td {
                    padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.03);
                    max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .mini-preview-table tr:hover td { background: rgba(255,255,255,0.02); color: #fff; }
                .importer-loading-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(15, 23, 42, 0.9);
                    backdrop-filter: blur(8px);
                    z-index: 1000;
                }
                .loading-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-top: 20px;
                }
                .loading-content p {
                    color: white;
                    font-weight: 700;
                    margin: 0;
                }
                .progress-container-loader {
                    width: 300px;
                    height: 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                    margin-top: 15px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .progress-bar-loader {
                    height: 100%;
                    background: linear-gradient(to right, #6366f1, #a855f7);
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
                }
                .progress-text-loader-main {
                    font-size: 0.8rem;
                    color: #818cf8;
                    margin-top: 10px;
                    font-weight: 800;
                }
                .preview-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
                .preview-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .preview-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .preview-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

                /* Smart Config Styles */
                .smart-config-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .smart-option-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 16px; padding: 20px; display: flex; gap: 15px;
                }
                .smart-option-card:last-child { grid-column: span 2; }
                .option-icon { font-size: 2rem; background: rgba(99, 102, 241, 0.1); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
                .option-content h4 { margin: 0 0 5px 0; color: white; }
                .option-content p { margin: 0 0 15px 0; color: #94a3b8; font-size: 0.9rem; }

                .range-inputs { display: flex; gap: 15px; }
                .input-group label { display: block; font-size: 0.75rem; color: #64748b; margin-bottom: 5px; }
                .input-group input { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px; border-radius: 6px; width: 100%; }

                /* Switch Toggle */
                .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .4s; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
                input:checked + .slider { background-color: #6366f1; }
                input:checked + .slider:before { transform: translateX(26px); }
                .slider.round { border-radius: 34px; }
                .slider.round:before { border-radius: 50%; }

                /* Preview Styles */
                .smart-preview-list { display: grid; gap: 15px; }
                .preview-item-card {
                    background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                    display: flex; gap: 15px; align-items: flex-start;
                }
                .preview-item-card.disabled { opacity: 0.5; }
                .item-content-edit { flex: 1; display: flex; flex-direction: column; gap: 8px; }
                .type-badge { align-self: flex-start; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
                .type-badge.ai { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
                .type-badge.raw { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }

                .edit-input { 
                    background: rgba(255,255,255,0.02); 
                    border: 1px solid rgba(255,255,255,0.05); 
                    color: #cbd5e1; 
                    padding: 8px 12px; 
                    border-radius: 8px; 
                    width: 100%; 
                    transition: all 0.2s; 
                    font-family: inherit;
                }
                .edit-input:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
                .edit-input:focus { background: #0f172a; border-color: #6366f1; color: white; outline: none; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                .edit-input.title { font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; }
                .edit-input.body { font-size: 0.92rem; line-height: 1.6; resize: vertical; }

                .edit-indicator {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.65rem;
                    color: #64748b;
                    margin-top: 4px;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                .preview-item-card:hover .edit-indicator { opacity: 1; color: #6366f1; }

                /* Success Screen Styles */
                .success-card { max-width: 500px !important; text-align: center; }
                .success-content { padding: 40px; display: flex; flex-direction: column; align-items: center; }
                .success-icon-wrapper { width: 80px; height: 80px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; border: 2px solid rgba(16, 185, 129, 0.2); }
                .success-emoji { font-size: 2.5rem; }
                .success-content h2 { color: #fff; }
                .stats-row { display: flex; gap: 20px; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 20px; margin: 30px 0; width: 100%; justify-content: center; }
                .stat-value { font-size: 1.5rem; font-weight: 800; color: #fff; display: block; }
                .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
                .btn-success-action { width: 100%; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 18px; border-radius: 16px; font-weight: 800; cursor: pointer; }

                .importer-loading-state { text-align: center; padding: 60px 0; color:white; }
                .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .extraction-type-btn {
                    flex: 1; padding: 10px; border-radius: 10px; border: none; cursor: pointer;
                    font-size: 0.8rem; font-weight: 700; transition: all 0.2s;
                    background: transparent; color: #94a3b8;
                }
                .extraction-type-btn.active {
                    background: #1e293b; color: #818cf8; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .extraction-type-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.02); }

                .smart-textarea:focus {
                    border-color: #6366f1 !important;
                    background: rgba(15, 23, 42, 0.9) !important;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1) !important;
                }

                /* PREMIUM REFINEMENTS */
                .usage-ribbon {
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
                    animation: usageGlow 4s infinite alternate;
                }
                @keyframes usageGlow {
                    from { box-shadow: 0 0 10px rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2); }
                    to { box-shadow: 0 0 25px rgba(99, 102, 241, 0.3); border-color: rgba(99, 102, 241, 0.5); }
                }

                .scroll-container-premium {
                    height: 100%;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    animation: fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeInScale {
                    from { opacity: 0; transform: translateY(10px) scale(0.99); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .preview-progress-track {
                    position: sticky; top: -30px; left: -30px; right: -30px;
                    height: 4px; background: rgba(255,255,255,0.03);
                    z-index: 100; margin-bottom: 20px;
                }
                .preview-progress-bar {
                    height: 100%; background: linear-gradient(to right, #6366f1, #a855f7);
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
                    transition: width 0.1s ease-out;
                }

                .preview-item-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .preview-item-card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }
                .item-unchecked {
                    opacity: 0.4;
                    transform: scale(0.98);
                    filter: grayscale(0.5);
                }
                .active-source {
                    border-color: #6366f1 !important;
                    background: rgba(99, 102, 241, 0.05) !important;
                    box-shadow: 0 0 0 2px #6366f1, 0 15px 45px -10px rgba(99, 102, 241, 0.4) !important;
                }

                .preview-layout-container {
                    display: flex; gap: 25px; align-items: flex-start;
                }

                .btn-view-source {
                    background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #818cf8; padding: 5px 12px; border-radius: 8px; font-size: 0.72rem;
                    font-weight: 700; display: flex; align-items: center; gap: 6px;
                    cursor: pointer; transition: all 0.2s;
                }
                .btn-view-source:hover { background: rgba(99, 102, 241, 0.2); color: white; }
                .btn-view-source.active { background: #6366f1; color: white; border-color: #6366f1; }

                .source-viewer-sidebar {
                    width: 420px; background: #0f172a; border: 1px solid rgba(99, 102, 241, 0.4);
                    border-radius: 24px; position: sticky; top: 100px;
                    display: flex; flex-direction: column; height: fit-content;
                    max-height: calc(100vh - 150px);
                    box-shadow: 0 25px 70px rgba(0,0,0,0.8), 0 0 20px rgba(99, 102, 241, 0.1);
                    z-index: 100; align-self: flex-start;
                    animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    margin-bottom: 20px;
                }
                .sidebar-header {
                    padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .sidebar-header h4 { margin: 0; font-size: 0.9rem; color: #fff; }
                .sidebar-header button { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.1rem; }
                .sidebar-content { padding: 20px; overflow-y: auto; }
                .source-meta-info {
                    font-size: 0.75rem; color: #94a3b8; margin-bottom: 15px;
                    display: flex; flex-direction: column; gap: 4px;
                }
                .source-text-blob {
                    background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px;
                    font-size: 0.85rem; line-height: 1.6; color: #cbd5e1;
                    font-style: italic; border-left: 3px solid #6366f1;
                }
                .source-hint {
                    margin-top: 20px; display: flex; gap: 8px; font-size: 0.7rem;
                    color: #6366f1; font-weight: 600; opacity: 0.8;
                }

                @keyframes fadeInRight { 
                    from { opacity: 0; transform: translateX(40px) scale(0.98); } 
                    to { opacity: 1; transform: translateX(0) scale(1); } 
                }
                .fade-in-right { animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                
                .source-viewer-sidebar::before {
                    content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px;
                    background: linear-gradient(45deg, #6366f1, transparent, #a855f7);
                    z-index: -1; border-radius: 26px; opacity: 0.3; filter: blur(10px);
                }

                .page-badge-premium {
                    font-size: 0.7rem; background: rgba(99, 102, 241, 0.15); color: #818cf8;
                    padding: 3px 10px; border-radius: 6px; font-weight: 800; border: 1px solid rgba(99, 102, 241, 0.2);
                }

                .edit-indicator-premium {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.03);
                }
                .stats-indicator { display: flex; gap: 12px; }
                .char-stat { font-size: 0.65rem; color: #64748b; font-weight: 700; }
                .token-stat { font-size: 0.65rem; color: #818cf8; font-weight: 800; }
                .editable-label { display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: #64748b; opacity: 0.5; }
                .preview-item-card:hover .editable-label { color: #6366f1; opacity: 1; }

                .input-wrapper-premium {
                    position: relative;
                    width: 100%;
                }

                .maximize-btn-premium {
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    width: 28px;
                    height: 28px;
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #818cf8;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 5;
                    font-size: 0.9rem;
                }

                .maximize-btn-premium:hover {
                    background: #6366f1;
                    color: white;
                    transform: scale(1.1);
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
                }

                .max-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(2, 6, 23, 0.95);
                    backdrop-filter: blur(10px);
                    z-index: 200000000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeInFlex 0.3s ease;
                }

                .max-modal-content {
                    width: 100%;
                    max-width: 900px;
                    height: 80vh;
                    background: #0f172a;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    border-radius: 24px;
                    padding: 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    box-shadow: 0 50px 100px -20px rgba(0,0,0,0.8);
                    animation: scaleUpFlex 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes fadeInFlex { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUpFlex { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

                .btn-modal-done {
                    background: rgba(99, 102, 241, 0.2); 
                    border: 1px solid rgba(99, 102, 241, 0.3); 
                    color: #fff; 
                    padding: 10px 25px; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    font-weight: 700;
                    transition: all 0.2s;
                }
                .btn-modal-done:hover {
                    background: #6366f1;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
                }
            `}</style>
        </div>,
        document.body
    );
};

export default KnowledgeBaseImporter;
