import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { API_URL } from '../config';
import ExpandableField from './ExpandableField';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import ToolsManager from './ToolsManager';
import PromptEditor from './PromptEditor';
import AgentHistory from './AgentHistory';
import PromptVersions from './PromptVersions';

const ConfigPanel = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'prompts';

    const getModelForRole = (role) => {
        switch (role) {
            case 'fallback': return fallbackModel;
            case 'router_simple': return routerSimpleModel;
            case 'router_simple_fallback': return routerSimpleFallbackModel;
            case 'router_complex': return routerComplexModel;
            case 'router_complex_fallback': return routerComplexFallbackModel;
            default: return selectedModel;
        }
    };

    const isNew = id === 'new' || !id;

    const [googleConnected, setGoogleConnected] = useState(false);
    const [models, setModels] = useState([]);

    // Form States
    const [name, setName] = useState(isNew ? 'Novo Agente' : '');
    const [description, setDescription] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [fallbackModel, setFallbackModel] = useState(null);
    const [temperature, setTemperature] = useState(1.0);
    const [topP, setTopP] = useState(1.0);
    const [dateAwareness, setDateAwareness] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState('Você é um assistente útil e inteligente.');
    const [contextWindow, setContextWindow] = useState(5);
    const [knowledgeBase, setKnowledgeBase] = useState([]);
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState([]); // Multi-KB
    const [knowledgeBaseId, setKnowledgeBaseId] = useState(null); // Legacy
    const [kbList, setKbList] = useState([]);
    const [ragRetrievalCount, setRagRetrievalCount] = useState(5); // RAG Top-K
    const [ragTranslationEnabled, setRagTranslationEnabled] = useState(false);
    const [inboxCaptureEnabled, setInboxCaptureEnabled] = useState(true);
    const [ragMultiQueryEnabled, setRagMultiQueryEnabled] = useState(false);
    const [ragRerankEnabled, setRagRerankEnabled] = useState(true);
    const [ragAgenticEvalEnabled, setRagAgenticEvalEnabled] = useState(true);
    const [ragParentExpansionEnabled, setRagParentExpansionEnabled] = useState(true);
    const [toolsList, setToolsList] = useState([]);
    const [selectedTools, setSelectedTools] = useState([]); // Array of IDs
    const [status, setStatus] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [simulatedTime, setSimulatedTime] = useState(''); // HH:MM
    const [securityBlacklist, setSecurityBlacklist] = useState('');
    const [securityForbidden, setSecurityForbidden] = useState('');
    const [securityDiscount, setSecurityDiscount] = useState('');
    const [securityComplexity, setSecurityComplexity] = useState('standard');
    const [securityPii, setSecurityPii] = useState(false);
    const [securityValidatorIa, setSecurityValidatorIa] = useState(false);
    const [securityBotProtection, setSecurityBotProtection] = useState(false);
    const [securityMaxMessages, setSecurityMaxMessages] = useState(20);
    const [securitySemanticThreshold, setSecuritySemanticThreshold] = useState(0.85);
    const [securityLoopCount, setSecurityLoopCount] = useState(3);
    const [uiPrimaryColor, setUiPrimaryColor] = useState('#6366f1');
    const [uiHeaderColor, setUiHeaderColor] = useState('#0f172a');
    const [uiChatTitle, setUiChatTitle] = useState('Suporte Inteligente');
    const [uiWelcomeMessage, setUiWelcomeMessage] = useState('Olá! Como posso te ajudar hoje?');
    const [topK, setTopK] = useState(40);
    const [presencePenalty, setPresencePenalty] = useState(0.0);
    const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);
    const [reasoningEffort, setReasoningEffort] = useState('medium');
    const [safetySettings, setSafetySettings] = useState('standard');
    const [routerEnabled, setRouterEnabled] = useState(false);
    const [routerSimpleModel, setRouterSimpleModel] = useState('gpt-4o-mini');
    const [routerSimpleFallbackModel, setRouterSimpleFallbackModel] = useState('');
    const [routerComplexModel, setRouterComplexModel] = useState('gpt-4o');
    const [routerComplexFallbackModel, setRouterComplexFallbackModel] = useState('');
    const [handoffEnabled, setHandoffEnabled] = useState(false);
    const [responseTranslationEnabled, setResponseTranslationEnabled] = useState(false);
    const [responseTranslationFallbackLang, setResponseTranslationFallbackLang] = useState('pt-br');
    const [langSearch, setLangSearch] = useState('');
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);
    const [showSecurityGuide, setShowSecurityGuide] = useState(false);
    const [showGeralGuide, setShowGeralGuide] = useState(false);
    const [showTemporalGuide, setShowTemporalGuide] = useState(false);
    const [showHabilidadesGuide, setShowHabilidadesGuide] = useState(false);
    const [showWhitelabelGuide, setShowWhitelabelGuide] = useState(false);
    const [modelSettings, setModelSettings] = useState({});
    const [configRole, setConfigRole] = useState('main');
    const [isLoadingData, setIsLoadingData] = useState(!isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [openaiConnected, setOpenaiConnected] = useState(true);
    const [geminiConnected, setGeminiConnected] = useState(true);

    useEffect(() => {
        // Safety: If router roles are selected but router gets disabled, reset to 'main'
        if (configRole.startsWith('router') && !routerEnabled) {
            setConfigRole('main');
        }
        // If router is enabled and a non-router role is selected, reset to router_simple
        if (routerEnabled && !configRole.startsWith('router')) {
            setConfigRole('router_simple');
        }
    }, [routerEnabled]);

    const renderModelOptions = () => {
        const geminiModels = models.filter(m => m.id.toLowerCase().includes('gemini'));
        const openaiModels = models.filter(m => !m.id.toLowerCase().includes('gemini') && !m.is_finetuned);
        const tunedModels = models.filter(m => m.is_finetuned);

        return (
            <>
                {geminiModels.length > 0 && (
                    <optgroup label={`GOOGLE GEMINI ♊ (Até 2M de Contexto) ${!geminiConnected ? '⚠️ NÃO CONECTADO' : ''}`}>
                        {geminiModels.filter(m => geminiConnected || m.is_finetuned).map(m => (
                            <option key={m.id} value={m.id} title={`API: ${m.real_id || m.id}`}>
                                ♊ {m.id} [{m.context_window || '1M'}] {m.supports_tools ? '🛠️' : ''} {m.supports_temperature ? '🔥' : ''}
                            </option>
                        ))}
                        {!geminiConnected && <option disabled>⚠️ Configure GEMINI_API_KEY no .env</option>}
                    </optgroup>
                )}
                {openaiModels.length > 0 && (
                    <optgroup label={`OPENAI GPT 🌐 (128k Contexto) ${!openaiConnected ? '⚠️ NÃO CONECTADO' : ''}`}>
                        {openaiModels.filter(m => openaiConnected || m.is_finetuned).map(m => (
                            <option key={m.id} value={m.id} title={`API: ${m.real_id || m.id}`}>
                                🌐 {m.id} [{m.context_window || '128k'}] {m.supports_tools ? '🛠️' : ''} {m.supports_temperature ? '🔥' : ''}
                            </option>
                        ))}
                        {!openaiConnected && <option disabled>⚠️ Configure OPENAI_API_KEY no .env</option>}
                    </optgroup>
                )}
                {tunedModels.length > 0 && (
                    <optgroup label="CUSTOM MODELS (Fine-Tuning) 🧠">
                        {tunedModels.map(m => (
                            <option key={m.id} value={m.id}>
                                🧠 {m.name || m.id}
                            </option>
                        ))}
                    </optgroup>
                )}
                {!openaiConnected && openaiModels.length > 0 && (
                    <optgroup label="⚠️ OPENAI NÃO CONECTADO">
                        <option disabled>Configure OPENAI_API_KEY no .env para usar estes modelos</option>
                    </optgroup>
                )}
                {!geminiConnected && geminiModels.length > 0 && (
                    <optgroup label="⚠️ GEMINI NÃO CONECTADO">
                        <option disabled>Configure GEMINI_API_KEY no .env para usar estes modelos</option>
                    </optgroup>
                )}
            </>
        );
    };

    const renderPriceDisplay = (modelId) => {
        const info = models.find(m => m.id === modelId);
        if (!info || info.input === undefined) return null;

        const inputPrice = (info.input * 1000000).toFixed(2);
        const outputPrice = (info.output * 1000000).toFixed(2);

        return (
            <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📥 Input: <b style={{ color: '#34d399' }}>${inputPrice}</b>/1M tokens
                    </span>
                    <span style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📤 Output: <b style={{ color: '#34d399' }}>${outputPrice}</b>/1M tokens
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#818cf8',
                    paddingLeft: '12px',
                    borderLeft: '2px solid rgba(129, 140, 248, 0.3)',
                    marginTop: '8px'
                }}>
                    <span>🧠 Memória: <b style={{ color: '#6366f1' }}>{info.context_window || '128k'}</b> tokens</span>
                </div>
                {info.real_id && info.real_id !== info.id && (
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#94a3b8', opacity: 0.6 }}>
                        🔗 Versão API: <b>{info.real_id}</b>
                    </div>
                )}
            </div>
        );
    };


    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // Models (Critical)
                try {
                    const modelsRes = await api.get('/models');
                    const modelsData = await modelsRes.json();

                    // Fine-tuning models são opcionais - não devem bloquear o fluxo
                    let ftModelsData = [];
                    try {
                        const ftModelsRes = await api.get('/fine-tuning/models');
                        if (ftModelsRes.ok) {
                            ftModelsData = await ftModelsRes.json();
                        }
                    } catch (ftErr) {
                        console.warn("Fine-tuning models unavailable:", ftErr);
                    }

                    const baseModels = modelsData?.models || [];
                    // Converte modelos fine-tuned para o formato esperado pelo seletor
                    const ftModels = (Array.isArray(ftModelsData) ? ftModelsData : []).map(m => ({
                        id: m.id,
                        name: `Fine-Tuning: ${m.id.split(':').slice(-1)[0]}`,
                        supports_tools: true, // Fine-tuned versions of 4o-mini support tools
                        supports_temperature: true,
                        is_finetuned: true
                    }));

                    const allModels = [...baseModels, ...ftModels];

                    if (allModels.length > 0) {
                        setModels(allModels);
                        if (modelsData.openai_connected !== undefined) setOpenaiConnected(modelsData.openai_connected);
                        if (modelsData.gemini_connected !== undefined) setGeminiConnected(modelsData.gemini_connected);
                    } else {
                        throw new Error("Empty models list");
                    }
                } catch (err) {
                    console.error("Error fetching models, using fallback:", err);
                    // Fallback list
                    setModels([
                        { id: "gpt-5.4", supports_tools: true, supports_temperature: true, input: 0.0000025, output: 0.000015, context_window: "1.05M", provider: "openai" },
                        { id: "gpt-5.2", supports_tools: true, supports_temperature: true, input: 0.00000175, output: 0.000014, context_window: "128k", provider: "openai" },
                        { id: "gpt-5-mini", supports_tools: true, supports_temperature: true, input: 0.0000003, output: 0.0000021, context_window: "128k", provider: "openai" },
                        { id: "gpt-5", supports_tools: true, supports_temperature: true, input: 0.0000015, output: 0.000012, context_window: "128k", provider: "openai" },
                        { id: "gpt-4.1", supports_tools: true, supports_temperature: true, input: 0.000001, output: 0.000008, context_window: "128k", provider: "openai" },
                        { id: "gpt-4o-mini", supports_tools: true, supports_temperature: true, input: 0.00000015, output: 0.0000006, context_window: "128k", provider: "openai" },
                        { id: "gpt-4o", supports_tools: true, supports_temperature: true, input: 0.0000025, output: 0.00001, context_window: "128k", provider: "openai" },
                        { id: "gemini-3.1-pro", supports_tools: true, supports_temperature: true, input: 0.000002, output: 0.000012, context_window: "2M", provider: "gemini" },
                        { id: "gemini-3.1-flash", supports_tools: true, supports_temperature: true, input: 0.0000005, output: 0.000003, context_window: "1M", provider: "gemini" },
                        { id: "gemini-2.5-pro", supports_tools: true, supports_temperature: true, input: 0.00000125, output: 0.00001, context_window: "2M", provider: "gemini" },
                        { id: "gemini-2.5-flash", supports_tools: true, supports_temperature: true, input: 0.0000003, output: 0.0000025, context_window: "1M", provider: "gemini" },
                    ]);
                }

                // Knowledge Bases
                try {
                    const kbsRes = await api.get('/knowledge-bases');
                    const kbsData = await kbsRes.json();
                    setKbList(kbsData || []);
                } catch (err) {
                    console.error("Error fetching KBs:", err);
                    setKbList([]);
                }

                // Tools
                try {
                    const toolsRes = await api.get('/tools');
                    const toolsData = await toolsRes.json();
                    setToolsList(Array.isArray(toolsData) ? toolsData : []);
                } catch (err) {
                    console.error("Error fetching Tools:", err);
                    setToolsList([]);
                }

                // App Integrations status
                try {
                    const googleRes = await api.get('/integrations/google/status');
                    if (googleRes.ok) {
                        const googleData = await googleRes.json();
                        setGoogleConnected(googleData.connected);
                    }
                } catch (err) {
                    console.error("Error fetching Google status:", err);
                }

                // Agent Config
                if (!isNew && id) {
                    try {
                        const agentRes = await api.get(`/agents/${id}`);
                        const configData = await agentRes.json();

                        if (!configData || configData.detail) throw new Error("Agent data missing");

                        setName(configData.name || '');
                        setDescription(configData.description || '');

                        // Set model with fallback safety
                        const modelToSet = configData.model || "gpt-4o-mini";
                        setSelectedModel(modelToSet);

                        setFallbackModel(configData.fallback_model);
                        if (configData.temperature !== undefined) setTemperature(configData.temperature);
                        if (configData.top_p !== undefined) setTopP(configData.top_p);
                        if (configData.date_awareness !== undefined) setDateAwareness(configData.date_awareness);
                        setSystemPrompt(configData.system_prompt || '');
                        setContextWindow(configData.context_window || 5);
                        setKnowledgeBase(configData.knowledge_base || []);

                        // Multi-KB Support & RAG
                        setKnowledgeBaseIds(configData.knowledge_base_ids || (configData.knowledge_base_id ? [configData.knowledge_base_id] : []));
                        setRagRetrievalCount(configData.rag_retrieval_count ?? 5);
                        setRagTranslationEnabled(configData.rag_translation_enabled ?? false);
                        setRagMultiQueryEnabled(configData.rag_multi_query_enabled ?? false);
                        setRagRerankEnabled(configData.rag_rerank_enabled ?? true);
                        setRagAgenticEvalEnabled(configData.rag_agentic_eval_enabled ?? true);
                        setRagParentExpansionEnabled(configData.rag_parent_expansion_enabled ?? true);
                        setInboxCaptureEnabled(configData.inbox_capture_enabled ?? true);
                        setSelectedTools(configData.tool_ids || []);
                        setSimulatedTime(configData.simulated_time || '');

                        // Security
                        setSecurityBlacklist(configData.security_competitor_blacklist || '');
                        setSecurityForbidden(configData.security_forbidden_topics || '');
                        setSecurityDiscount(configData.security_discount_policy || '');
                        setSecurityComplexity(configData.security_language_complexity || 'standard');
                        setSecurityPii(configData.security_pii_filter || false);
                        setSecurityValidatorIa(configData.security_validator_ia || false);
                        setSecurityBotProtection(configData.security_bot_protection || false);
                        setSecurityMaxMessages(configData.security_max_messages_per_session || 20);
                        setSecuritySemanticThreshold(configData.security_semantic_threshold || 0.85);
                        setSecurityLoopCount(configData.security_loop_count || 3);
                        setUiPrimaryColor(configData.ui_primary_color || '#6366f1');
                        setUiHeaderColor(configData.ui_header_color || '#0f172a');
                        setUiChatTitle(configData.ui_chat_title || 'Suporte Inteligente');
                        setUiWelcomeMessage(configData.ui_welcome_message || 'Olá! Como posso te ajudar hoje?');
                        setRouterEnabled(configData.router_enabled || false);
                        setRouterSimpleModel(configData.router_simple_model || 'gpt-4o-mini');
                        setRouterSimpleFallbackModel(configData.router_simple_fallback_model || '');
                        setRouterComplexModel(configData.router_complex_model || 'gpt-4o');
                        setRouterComplexFallbackModel(configData.router_complex_fallback_model || '');
                        setHandoffEnabled(configData.handoff_enabled || false);
                        setResponseTranslationEnabled(configData.response_translation_enabled || false);
                        setResponseTranslationFallbackLang(configData.response_translation_fallback_lang || 'portuguese');
                        setModelSettings(configData.model_settings || {});

                        // Advanced Params
                        if (configData.top_k !== undefined) setTopK(configData.top_k);
                        if (configData.presence_penalty !== undefined) setPresencePenalty(configData.presence_penalty);
                        if (configData.frequency_penalty !== undefined) setFrequencyPenalty(configData.frequency_penalty);
                        if (configData.safety_settings !== undefined) setSafetySettings(configData.safety_settings);
                        if (configData.reasoning_effort !== undefined) setReasoningEffort(configData.reasoning_effort);

                    } catch (err) {
                        console.error("Error loading agent:", err);
                        setStatus('Erro ao carregar agente');
                    }
                } else if (isNew) {
                    // Default for new agent
                    setSelectedModel("gpt-4o-mini");
                }
            } catch (err) {
                console.error("Global load error:", err);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
    }, [id, isNew]);

    // Auto-reset temperature if model doesn't support it
    useEffect(() => {
        if (!selectedModel || models.length === 0) return;

        const currentModelInfo = models.find(m => m.id === selectedModel);
        if (currentModelInfo && currentModelInfo.supports_temperature === false) {
            setTemperature(1.0); // Reset to standard default
        }
    }, [selectedModel, models]);

    const handleSave = async () => {
        const errors = [];
        if (!name.trim()) errors.push('nome');
        const needsModel = !routerEnabled;
        const hasMainModel = needsModel ? !!selectedModel : (!!routerSimpleModel && !!routerComplexModel);
        if (!hasMainModel) errors.push('modelo');
        if (errors.length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors([]);

        try {
            setIsSaving(true);
            setStatus('Iniciando salvamento...');
            console.log("💾 Preparando payload para salvamento...");

            const payload = {
                name,
                description,
                model: selectedModel,
                fallback_model: fallbackModel || null,
                temperature: parseFloat(temperature) || 1.0,
                top_p: parseFloat(topP) || 1.0,
                date_awareness: !!dateAwareness,
                system_prompt: systemPrompt || "",
                context_window: parseInt(contextWindow) || 5,
                knowledge_base_ids: Array.isArray(knowledgeBaseIds) ? knowledgeBaseIds.map(id => parseInt(id)).filter(id => !isNaN(id)) : [],
                rag_retrieval_count: parseInt(ragRetrievalCount) || 5,
                rag_translation_enabled: !!ragTranslationEnabled,
                rag_multi_query_enabled: !!ragMultiQueryEnabled,
                rag_rerank_enabled: !!ragRerankEnabled,
                rag_agentic_eval_enabled: !!ragAgenticEvalEnabled,
                rag_parent_expansion_enabled: !!ragParentExpansionEnabled,
                inbox_capture_enabled: !!inboxCaptureEnabled,
                tool_ids: Array.isArray(selectedTools) ? selectedTools.map(id => parseInt(id)).filter(id => !isNaN(id)) : [],
                simulated_time: dateAwareness ? (simulatedTime || null) : null,
                security_competitor_blacklist: securityBlacklist || null,
                security_forbidden_topics: securityForbidden || null,
                security_discount_policy: securityDiscount || null,
                security_language_complexity: securityComplexity || 'standard',
                security_pii_filter: !!securityPii,
                security_validator_ia: !!securityValidatorIa,
                security_bot_protection: !!securityBotProtection,
                security_max_messages_per_session: parseInt(securityMaxMessages) || 20,
                security_semantic_threshold: parseFloat(securitySemanticThreshold) || 0.85,
                security_loop_count: parseInt(securityLoopCount) || 3,
                ui_primary_color: uiPrimaryColor || '#6366f1',
                ui_header_color: uiHeaderColor || '#0f172a',
                ui_chat_title: uiChatTitle || 'Suporte Inteligente',
                ui_welcome_message: uiWelcomeMessage || 'Olá! Como posso te ajudar hoje?',
                router_enabled: !!routerEnabled,
                router_simple_model: routerSimpleModel,
                router_simple_fallback_model: routerSimpleFallbackModel || null,
                router_complex_model: routerComplexModel,
                handoff_enabled: !!handoffEnabled,
                response_translation_enabled: !!responseTranslationEnabled,
                response_translation_fallback_lang: responseTranslationFallbackLang || 'portuguese',
                top_k: parseInt(topK) || 40,
                presence_penalty: parseFloat(presencePenalty) || 0.0,
                frequency_penalty: parseFloat(frequencyPenalty) || 0.0,
                safety_settings: safetySettings || 'standard',
                reasoning_effort: reasoningEffort || 'medium',
                model_settings: {
                    ...(modelSettings || {}),
                    [(configRole || 'main')]: {
                        temperature: parseFloat(temperature) || 1.0,
                        top_p: parseFloat(topP) || 1.0,
                        top_k: parseInt(topK) || 40,
                        presence_penalty: parseFloat(presencePenalty) || 0.0,
                        frequency_penalty: parseFloat(frequencyPenalty) || 0.0,
                        safety_settings: safetySettings || 'standard',
                        context_window: parseInt(contextWindow) || 5,
                        reasoning_effort: reasoningEffort || 'medium'
                    }
                }
            };

            setStatus('Enviando dados ao servidor...');
            console.log("🚀 Enviando POST/PUT para agent server...");

            const res = isNew
                ? await api.post('/agents', payload)
                : await api.put(`/agents/${id}`, payload);

            setStatus('Processando resposta...');
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
                throw new Error(Array.isArray(errorData.detail)
                    ? errorData.detail.map(e => e.msg).join(', ')
                    : errorData.detail || "Erro ao salvar agente");
            }

            const data = await res.json();
            setStatus('Sucesso! Redirecionando...');
            setIsSaving(false);
            console.log("✅ Agente salvo com sucesso!");

            setTimeout(() => {
                setStatus('');
                navigate('/'); // Back to dashboard
            }, 1000);

        } catch (err) {
            console.error("❌ Erro fatal ao salvar:", err);
            setStatus(`Erro: ${err?.message || err}`);
            setIsSaving(false);
        }
    };

    // Calculate active model tool support
    const currentModelInfo = models.find(m => m.id === selectedModel);
    const activeModelSupportsTools = currentModelInfo?.supports_tools || false;
    const activeModelSupportsTemperature = currentModelInfo?.supports_temperature ?? true;

    return (
        <div className="config-panel">
            {isLoadingData && (
                <div className="saving-overlay fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)' }}>
                    <div className="saving-card" style={{ border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <div className="saving-spinner-wrapper">
                            <div className="saving-spinner" style={{ borderTopColor: '#34d399' }}></div>
                            <div className="saving-icon">🔄</div>
                        </div>
                        <h3 style={{ color: 'white' }}>Sincronizando Dados</h3>
                        <p style={{ color: '#94a3b8' }}>Aguarde enquanto carregamos as configurações mais recentes do seu agente direto do servidor.</p>
                        <div className="saving-progress-bar">
                            <div className="saving-progress-fill" style={{ width: '100%', backgroundColor: '#10b981', animation: 'shimmer 2s infinite linear' }}></div>
                        </div>
                    </div>
                </div>
            )}
            {isSaving && (
                <div className="saving-overlay fade-in">
                    <div className="saving-card">
                        <div className="saving-spinner-wrapper">
                            <div className="saving-spinner"></div>
                            <div className="saving-icon">💾</div>
                        </div>
                        <h3>Salvando Alterações</h3>
                        <p>Aguarde enquanto as configurações do seu agente são enviadas e processadas pelo servidor.</p>
                        <div className="saving-progress-bar">
                            <div className="saving-progress-fill"></div>
                        </div>
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 className="panel-title" style={{ margin: 0 }}>
                        {isNew ? 'Criar Novo Agente' : 'Editar Agente'}
                    </h2>
                    {!isNew && name && (
                        <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                            {name}
                        </p>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {!isNew && (
                        <Link
                            to={`/playground?agentId=${id}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                color: '#a5b4fc', borderRadius: '10px',
                                padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700,
                                textDecoration: 'none', transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            💬 Chat
                        </Link>
                    )}
                    <Link to="/" className="access-btn-back">
                        <span>←</span> Voltar
                    </Link>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'geral' ? 'active' : ''}`}
                    onClick={() => setActiveTab('geral')}
                >
                    ⚙️ Geral
                </button>
                <button
                    className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    🧠 Prompts & Identidade
                </button>
                <button
                    className={`tab-btn ${activeTab === 'habilidades' ? 'active' : ''}`}
                    onClick={() => setActiveTab('habilidades')}
                >
                    ⚡ Habilidades
                </button>

                <button
                    className={`tab-btn ${activeTab === 'versoes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('versoes')}
                >
                    🕒 Versões
                </button>
                <button
                    className={`tab-btn ${activeTab === 'seguranca' ? 'active' : ''}`}
                    onClick={() => setActiveTab('seguranca')}
                    style={{ color: activeTab === 'seguranca' ? '#f43f5e' : '' }}
                >
                    🛡️ Segurança
                </button>
                <button
                    className={`tab-btn ${activeTab === 'whitelabel' ? 'active' : ''}`}
                    onClick={() => setActiveTab('whitelabel')}
                >
                    🎨 Whitelabel
                </button>
            </div>

            <div className="tab-content" style={{ marginTop: '2rem' }}>

                {/* TAB: GERAL */}
                {activeTab === 'geral' && (
                    <div className="fade-in">

                        {/* Botão Guia Geral */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowGeralGuide(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    color: '#a5b4fc', borderRadius: '10px',
                                    padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                <span>📖</span><span>Guia das Configurações</span>
                            </button>
                        </div>

                        {/* Modal Guia Geral */}
                        {showGeralGuide && (
                            <div
                                onClick={() => setShowGeralGuide(false)}
                                style={{
                                    position: 'fixed', inset: 0, zIndex: 9999,
                                    background: 'rgba(2,6,23,0.8)',
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '1.5rem',
                                }}
                            >
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        borderRadius: '20px', width: '100%', maxWidth: '680px',
                                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                                        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1.3rem 1.8rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                                        flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                            📖 Guia das Configurações Gerais
                                        </span>
                                        <button
                                            onClick={() => setShowGeralGuide(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                                cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                                        >✕</button>
                                    </div>

                                    {/* Body */}
                                    <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }} className="custom-scrollbar">
                                        {[
                                            { icon: '🏷️', title: 'Nome do Agente', accent: '#60a5fa',
                                              desc: <>O nome de identificação do agente na plataforma. Use um nome <strong style={{color:'#e2e8f0'}}>descritivo e único</strong> para facilitar a gestão.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Exemplos:'}</span>{'\n'}<span style={{color:'#60a5fa'}}>Suporte ao Cliente</span>{'\n'}<span style={{color:'#60a5fa'}}>Assistente de Vendas</span>{'\n'}<span style={{color:'#60a5fa'}}>FAQ Técnico</span></>,
                                              tip: 'O nome é visível apenas internamente na plataforma, não afeta o comportamento do agente.' },
                                            { icon: '🧠', title: 'Modelo Principal', accent: '#4ade80',
                                              desc: <>O modelo de IA que processa as mensagens. Cada modelo tem diferentes capacidades, velocidades e <strong style={{color:'#e2e8f0'}}>custos por 1M tokens</strong>.</>,
                                              code: <><span style={{color:'#60a5fa'}}>gpt-4o</span>{' → '}<span style={{color:'#94a3b8'}}>Versátil, excelente custo-benefício{'\n'}</span><span style={{color:'#a78bfa'}}>gpt-5 / o3</span>{' → '}<span style={{color:'#94a3b8'}}>Raciocínio avançado, mais caro{'\n'}</span><span style={{color:'#4ade80'}}>gemini-2.0-flash</span>{' → '}<span style={{color:'#94a3b8'}}>Rápido e multimodal</span></>,
                                              tip: 'O preço exibido é por 1M tokens. Um usuário médio consome ~1.000 tokens por conversa.' },
                                            { icon: '⛑️', title: 'Modelo de Fallback', accent: '#fbbf24',
                                              desc: <>Modelo reserva ativado <strong style={{color:'#e2e8f0'}}>automaticamente</strong> quando o modelo principal falha ou está indisponível.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Fluxo de execução:'}</span>{'\n'}<span style={{color:'#4ade80'}}>Principal disponível</span>{' → '}<span style={{color:'#94a3b8'}}>Usa o principal{'\n'}</span><span style={{color:'#f87171'}}>Principal falhou</span>{' → '}<span style={{color:'#fbbf24'}}>Fallback ativado automaticamente</span></>,
                                              tip: 'Recomendado para ambientes de produção. Use um modelo mais barato e estável como fallback (ex: gpt-4o-mini).' },
                                            { icon: '🚦', title: 'Roteamento de Modelos (Cost Router)', accent: '#86efac',
                                              desc: <>Analisa cada pergunta e decide automaticamente se ela é <strong style={{color:'#e2e8f0'}}>simples ou complexa</strong>, usando o modelo mais barato possível.</>,
                                              code: <><span style={{color:'#475569'}}>{'// "Qual o horário de funcionamento?" → '}</span><span style={{color:'#4ade80'}}>Modelo Simples (barato){'\n'}</span><span style={{color:'#475569'}}>{'// "Analise esse contrato e aponte riscos" → '}</span><span style={{color:'#a78bfa'}}>Modelo Complexo</span></>,
                                              tip: '⚡ Pode reduzir custos em até 90%. Configure o Modelo Simples para perguntas do dia a dia e o Complexo para análises profundas.' },
                                            { icon: '💬', title: 'Janela de Contexto', accent: '#a5b4fc',
                                              desc: <>Quantas mensagens anteriores da conversa são enviadas ao modelo a cada requisição. <strong style={{color:'#e2e8f0'}}>Mais contexto = mais memória</strong>, porém maior custo.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Janela = 5 msgs:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Usuário vê últimas 5 trocas de mensagens{'\n'}</span><span style={{color:'#475569'}}>{'// Janela = 1 msg:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Agente "esquece" o início da conversa</span></>,
                                              tip: 'Para FAQ e suporte simples, 3–5 mensagens é suficiente. Para consultorias longas, use 10–20.' },
                                            { icon: '🌡️', title: 'Temperatura', accent: '#fb923c',
                                              desc: <>Controla a <strong style={{color:'#e2e8f0'}}>criatividade e aleatoriedade</strong> das respostas. Disponível para GPT padrão e Gemini (não disponível em modelos de raciocínio como o1, o3, gpt-5).</>,
                                              code: <><span style={{color:'#4ade80'}}>0.0–0.3</span>{' → '}<span style={{color:'#94a3b8'}}>Determinístico, respostas consistentes{'\n'}</span><span style={{color:'#fb923c'}}>0.7–1.0</span>{' → '}<span style={{color:'#94a3b8'}}>Criativo, mais variado{'\n'}</span><span style={{color:'#f87171'}}>1.5–2.0</span>{' → '}<span style={{color:'#94a3b8'}}>Muito aleatório, pode perder coerência</span></>,
                                              tip: 'Use valores baixos (0.1–0.4) para suporte técnico e FAQs. Use valores altos (0.8–1.2) para geração criativa.' },
                                            { icon: '🎯', title: 'Top-P (Nucleus Sampling)', accent: '#38bdf8',
                                              desc: <>Controla a <strong style={{color:'#e2e8f0'}}>diversidade de vocabulário</strong>. Só considera os tokens cuja probabilidade cumulativa atinge o valor P.</>,
                                              code: <><span style={{color:'#4ade80'}}>Top-P = 0.9</span>{' → '}<span style={{color:'#94a3b8'}}>Usa os 90% de tokens mais prováveis{'\n'}</span><span style={{color:'#f87171'}}>Top-P = 0.3</span>{' → '}<span style={{color:'#94a3b8'}}>Muito restrito, vocabulário limitado</span></>,
                                              tip: 'A OpenAI recomenda alterar Temperatura OU Top-P, nunca os dois ao mesmo tempo.' },
                                            { icon: '🔢', title: 'Top-K (Gemini)', accent: '#34d399',
                                              desc: <>Exclusivo para modelos Gemini. Limita a seleção de tokens às <strong style={{color:'#e2e8f0'}}>K palavras mais prováveis</strong> em cada passo.</>,
                                              code: <><span style={{color:'#34d399'}}>Top-K = 40</span>{' → '}<span style={{color:'#94a3b8'}}>Escolhe entre as 40 palavras mais prováveis{'\n'}</span><span style={{color:'#34d399'}}>Top-K = 1</span>{' → '}<span style={{color:'#94a3b8'}}>Sempre escolhe a palavra mais provável (greedy)</span></>,
                                              tip: 'Valores menores tornam o texto mais previsível. Valores maiores aumentam a variedade.' },
                                            { icon: '🔄', title: 'Presence & Frequency Penalty (GPT)', accent: '#c084fc',
                                              desc: <>Penalidades que reduzem a repetição. <strong style={{color:'#e2e8f0'}}>Presence Penalty</strong> evita repetir temas; <strong style={{color:'#e2e8f0'}}>Frequency Penalty</strong> evita repetir palavras exatas. Disponível apenas para GPT padrão.</>,
                                              code: <><span style={{color:'#c084fc'}}>Presence (+2)</span>{' → '}<span style={{color:'#94a3b8'}}>Incentiva falar de assuntos novos{'\n'}</span><span style={{color:'#c084fc'}}>Frequency (+2)</span>{' → '}<span style={{color:'#94a3b8'}}>Evita repetir as mesmas palavras{'\n'}</span><span style={{color:'#94a3b8'}}>Valores negativos incentivam a repetição</span></>,
                                              tip: 'Para chatbots de suporte, mantenha ambos em 0. Para redação criativa, valores entre 0.3 e 0.6 ajudam na variedade.' },
                                            { icon: '🧩', title: 'Esforço de Raciocínio (o1 / o3 / GPT-5)', accent: '#f472b6',
                                              desc: <>Controla quanto o modelo <strong style={{color:'#e2e8f0'}}>"pensa" antes de responder</strong>. Disponível apenas para modelos de raciocínio (o1, o3, gpt-5).</>,
                                              code: <><span style={{color:'#4ade80'}}>Low</span>{' → '}<span style={{color:'#94a3b8'}}>Rápido e barato, menos reflexão{'\n'}</span><span style={{color:'#fbbf24'}}>Medium</span>{' → '}<span style={{color:'#94a3b8'}}>Equilíbrio (recomendado){'\n'}</span><span style={{color:'#f472b6'}}>High</span>{' → '}<span style={{color:'#94a3b8'}}>Raciocínio profundo, mais lento e caro</span></>,
                                              tip: 'Use "High" apenas para tarefas complexas como análise jurídica, código avançado ou problemas matemáticos.' },
                                        ].map((item, i) => (
                                            <div key={i} style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderLeft: `3px solid ${item.accent}`,
                                                borderRadius: '12px', padding: '1.1rem 1.3rem',
                                                transition: 'border-color 0.2s',
                                            }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                                    {item.icon} {item.title}
                                                </div>
                                                <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                                <pre style={{
                                                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                                    padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                    margin: '0 0 0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                }}>{item.code}</pre>
                                                <div style={{
                                                    background: 'rgba(99,102,241,0.07)',
                                                    border: 'rgba(99,102,241,0.12)',
                                                    borderRadius: '8px', padding: '8px 11px',
                                                    fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                                }}>
                                                    <strong style={{ color: item.accent }}>Como usar: </strong>{item.tip}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-section">
                            <span className="section-label">Identificação</span>
                            <div className="form-group">
                                <label>Nome do Agente</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Assistente de Vendas"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Descrição (Opcional)</label>
                                <textarea
                                    placeholder="Descreva o propósito deste agente..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ minHeight: '80px' }}
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            {/* Header com toggle de roteamento */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div>
                                    <span className="section-label" style={{ margin: 0 }}>
                                        {routerEnabled ? '🚦 Roteamento de Modelos (Cost Router)' : 'Inteligência & Modelo'}
                                    </span>
                                    {routerEnabled && (
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                            Economize até 90% desviando perguntas simples para modelos mais baratos.
                                        </p>
                                    )}
                                </div>
                                <div className={`status-badge ${routerEnabled ? 'active' : ''}`}
                                    onClick={() => setRouterEnabled(!routerEnabled)}
                                    style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {routerEnabled ? 'ATIVADO' : 'DESATIVADO'}
                                </div>
                            </div>

                            {/* Roteamento DESATIVADO: seletor simples */}
                            {!routerEnabled && (
                                <div className="fade-in">
                                    <div className="form-group">
                                        <label>Modelo Principal</label>
                                        <select value={selectedModel || ''} onChange={(e) => setSelectedModel(e.target.value || null)}>
                                            <option value="">— Nenhum —</option>
                                            {renderModelOptions()}
                                        </select>
                                        {renderPriceDisplay(selectedModel)}
                                        {(() => {
                                            const info = models.find(m => m.id === selectedModel);
                                            if (info?.available_versions?.length > 0) {
                                                return (
                                                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>📡 Versões na API:</span>
                                                        {info.available_versions.map(v => (
                                                            <span key={v} style={{
                                                                fontSize: '0.6rem',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                background: v === (info.real_id || info.id) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                                color: v === (info.real_id || info.id) ? '#10b981' : '#94a3b8',
                                                                border: v === (info.real_id || info.id) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                                                fontFamily: 'monospace'
                                                            }}>{v}{v === (info.real_id || info.id) ? ' ✓' : ''}</span>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Modelo de Fallback (Contingência) <span style={{ fontSize: '0.7em', color: '#64748b' }}>(Opcional)</span></label>
                                        <select
                                            value={fallbackModel || ''}
                                            onChange={(e) => setFallbackModel(e.target.value || null)}
                                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}
                                        >
                                            <option value="">Nenhum (Usar apenas o principal)</option>
                                            {renderModelOptions()}
                                        </select>
                                        {fallbackModel && renderPriceDisplay(fallbackModel)}
                                        {(() => {
                                            if (!fallbackModel) return null;
                                            const info = models.find(m => m.id === fallbackModel);
                                            if (info?.available_versions?.length > 0) {
                                                return (
                                                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>📡 Versões na API:</span>
                                                        {info.available_versions.map(v => (
                                                            <span key={v} style={{
                                                                fontSize: '0.6rem',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                background: v === (info.real_id || info.id) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                                color: v === (info.real_id || info.id) ? '#10b981' : '#94a3b8',
                                                                border: v === (info.real_id || info.id) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                                                fontFamily: 'monospace'
                                                            }}>{v}{v === (info.real_id || info.id) ? ' ✓' : ''}</span>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                                            Usado caso o modelo principal falhe ou exceda limites.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Roteamento ATIVADO: dois modelos */}
                            {routerEnabled && (
                                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', background: 'rgba(16, 185, 129, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    {/* Simple Model Group */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ color: '#6ee7b7' }}>⚡ Modelo para Perguntas Simples</label>
                                            <select
                                                value={routerSimpleModel || ''}
                                                onChange={(e) => setRouterSimpleModel(e.target.value || null)}
                                                style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
                                            >
                                                <option value="">— Nenhum —</option>
                                                {renderModelOptions()}
                                            </select>
                                            {renderPriceDisplay(routerSimpleModel)}
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ color: '#6ee7b7', fontSize: '0.75rem', opacity: 0.8 }}>🔄 Fallback (Simples)</label>
                                            <select
                                                value={routerSimpleFallbackModel}
                                                onChange={(e) => setRouterSimpleFallbackModel(e.target.value)}
                                                style={{ borderColor: 'rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Sem fallback</option>
                                                {renderModelOptions()}
                                            </select>
                                            {routerSimpleFallbackModel && renderPriceDisplay(routerSimpleFallbackModel)}
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px' }}>
                                            Usado para saudações e conversas básicas.
                                        </p>
                                    </div>

                                    {/* Complex Model Group */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ color: '#10b981' }}>🧠 Modelo para Perguntas Complexas</label>
                                            <select
                                                value={routerComplexModel || ''}
                                                onChange={(e) => setRouterComplexModel(e.target.value || null)}
                                                style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
                                            >
                                                <option value="">— Nenhum —</option>
                                                {renderModelOptions()}
                                            </select>
                                            {renderPriceDisplay(routerComplexModel)}
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ color: '#10b981', fontSize: '0.75rem', opacity: 0.8 }}>🔄 Fallback (Complexas)</label>
                                            <select
                                                value={routerComplexFallbackModel}
                                                onChange={(e) => setRouterComplexFallbackModel(e.target.value)}
                                                style={{ borderColor: 'rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Sem fallback</option>
                                                {renderModelOptions()}
                                            </select>
                                            {routerComplexFallbackModel && renderPriceDisplay(routerComplexFallbackModel)}
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px' }}>
                                            Usado quando houver necessidade de RAG ou ferramentas.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ADVANCED MODEL CONFIG */}
                        <div className="form-section" style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span className="section-label" style={{ color: '#818cf8', fontWeight: 600, margin: 0 }}>⚙️ Configurações Avançadas do Modelo</span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Configurar para:</label>
                                    <select
                                        value={configRole}
                                        onChange={(e) => {
                                            const newRole = e.target.value;
                                            // Save current state to the old role in the local modelSettings object
                                            setModelSettings(prev => ({
                                                ...prev,
                                                [configRole]: {
                                                    temperature, top_p: topP, top_k: topK,
                                                    presence_penalty: presencePenalty,
                                                    frequency_penalty: frequencyPenalty,
                                                    safety_settings: safetySettings,
                                                    context_window: parseInt(contextWindow)
                                                }
                                            }));

                                            // Load from new role (if exists)
                                            const roleCfg = modelSettings[newRole] || {};
                                            setConfigRole(newRole);
                                            setTemperature(roleCfg.temperature ?? (newRole === 'main' ? 1.0 : 1.0));
                                            setTopP(roleCfg.top_p ?? 1.0);
                                            setTopK(roleCfg.top_k ?? 40);
                                            setPresencePenalty(roleCfg.presence_penalty ?? 0.0);
                                            setFrequencyPenalty(roleCfg.frequency_penalty ?? 0.0);
                                            setSafetySettings(roleCfg.safety_settings ?? 'standard');
                                            setContextWindow(roleCfg.context_window ?? 5);
                                        }}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto', background: 'rgba(0,0,0,0.3)', minWidth: '180px' }}
                                    >
                                        {!routerEnabled && (
                                            <>
                                                <option value="main">🎯 Modelo Principal</option>
                                                <option value="fallback">⛑️ Modelo de Fallback</option>
                                            </>
                                        )}
                                        {routerEnabled && (
                                            <>
                                                <option value="router_simple">⚡ Modelo Simples (Router)</option>
                                                <option value="router_simple_fallback">🛡️ Fallback Simples (Router)</option>
                                                <option value="router_complex">🧠 Modelo Complexo (Router)</option>
                                                <option value="router_complex_fallback">🪵 Fallback Complexo (Router)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {!getModelForRole(configRole) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                    <span style={{ fontSize: '2rem' }}>🔧</span>
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                        Nenhum modelo selecionado para este slot.<br />
                                        Escolha um modelo acima para configurar seus parâmetros.
                                    </p>
                                </div>
                            ) : (() => {
                                const m = (getModelForRole(configRole) || '').toLowerCase();
                                const isGemini = m.startsWith('gemini');
                                // o1-preview / o1-mini: params aceitos mas fixos — esconde tudo de sampling
                                const isO1Limited = /^o1-(preview|mini)/.test(m);
                                // o1 completo (suporta reasoning_effort)
                                const isO1Full = /^o1(?!-(preview|mini))/.test(m) && m.startsWith('o1');
                                // o3, o3-mini, o4-mini: nenhum param de sampling
                                const isO3Plus = /^o[34]/.test(m);
                                // gpt-5 e variantes (gpt-5.2, gpt-5.4, gpt-5-mini, etc.)
                                const isGpt5 = m.startsWith('gpt-5') || m.startsWith('gpt5');
                                // Qualquer modelo de raciocínio (nenhum param sampling)
                                const isReasoningModel = isO1Limited || isO1Full || isO3Plus || isGpt5;
                                // Suporta reasoning_effort: o1 full, o3+, gpt-5
                                const hasReasoningEffort = isO1Full || isO3Plus || isGpt5;
                                // GPT padrão: 4o, 4o-mini, 4-turbo, 3.5, 4.1, fine-tuned
                                const isStandardGPT = !isGemini && !isReasoningModel;

                                return (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                                        {/* Janela de Contexto — todos */}
                                        <div className="form-group" style={{ marginBottom: 0, gridColumn: isReasoningModel && !hasReasoningEffort ? 'span 2' : undefined }}>
                                            <label>Janela de Contexto <span className="label-value">{contextWindow} msgs</span></label>
                                            <input
                                                type="number" min="1" max="100"
                                                value={contextWindow}
                                                onChange={(e) => setContextWindow(parseInt(e.target.value))}
                                            />
                                            <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Quantas mensagens enviar para a IA lembrar.</p>
                                        </div>

                                        {/* Reasoning Effort — o1 full, o3+, gpt-5 */}
                                        {hasReasoningEffort && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Esforço de Raciocínio</label>
                                                <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)}>
                                                    <option value="low">⚡ Low — Rápido e barato</option>
                                                    <option value="medium">⚖️ Medium — Equilibrado</option>
                                                    <option value="high">🧠 High — Máxima qualidade</option>
                                                    {isGpt5 && <option value="xhigh">🚀 xHigh — Somente GPT-5</option>}
                                                </select>
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Controla quanto o modelo pensa antes de responder.</p>
                                            </div>
                                        )}

                                        {/* Temperatura — Gemini e GPT padrão */}
                                        {!isReasoningModel && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Temperatura <span className="label-value">{temperature.toFixed(1)}</span></label>
                                                <input
                                                    type="range" min="0" max="2" step="0.1"
                                                    value={temperature}
                                                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                                />
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Controla a criatividade (0: Determinístico, 2: Muito Criativo).</p>
                                            </div>
                                        )}

                                        {/* Top-P — Gemini e GPT padrão */}
                                        {!isReasoningModel && (
                                            <div className="form-group" style={{ marginBottom: 0, gridColumn: !isGemini ? 'span 2' : undefined }}>
                                                <label>Top-P (Nucleus Sampling) <span className="label-value">{topP.toFixed(2)}</span></label>
                                                <input
                                                    type="range" min="0" max="1" step="0.01"
                                                    value={topP}
                                                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                                                />
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Controla a diversidade via amostragem de núcleo.</p>
                                            </div>
                                        )}

                                        {/* Top-K — somente Gemini */}
                                        {isGemini && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Top-K <span className="label-value">{topK}</span></label>
                                                <input
                                                    type="range" min="1" max="100" step="1"
                                                    value={topK}
                                                    onChange={(e) => setTopK(parseInt(e.target.value))}
                                                />
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Limita a escolha às K palavras mais prováveis.</p>
                                            </div>
                                        )}

                                        {/* Presence Penalty — somente GPT padrão */}
                                        {isStandardGPT && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Presence Penalty <span className="label-value">{presencePenalty.toFixed(2)}</span></label>
                                                <input
                                                    type="range" min="-2" max="2" step="0.1"
                                                    value={presencePenalty}
                                                    onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
                                                />
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Pune repetição de temas (Incentiva novidade).</p>
                                            </div>
                                        )}

                                        {/* Frequency Penalty — somente GPT padrão */}
                                        {isStandardGPT && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Frequency Penalty <span className="label-value">{frequencyPenalty.toFixed(2)}</span></label>
                                                <input
                                                    type="range" min="-2" max="2" step="0.1"
                                                    value={frequencyPenalty}
                                                    onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                                                />
                                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Pune repetição de palavras exatas.</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Gemini Safety Filter removido a pedido do usuário */}
                        </div>

                    </div>
                )}

                {/* TAB: PROMPTS */}
                {activeTab === 'prompts' && (
                    <div className="fade-in">
                        <div className="form-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <span className="section-label" style={{ margin: 0 }}>Comportamento & Regras</span>
                                <button
                                    type="button"
                                    onClick={() => setShowTemporalGuide(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                                        border: '1px solid rgba(99,102,241,0.3)',
                                        color: '#a5b4fc', borderRadius: '10px',
                                        padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    <span>📖</span><span>Guia do Comportamento</span>
                                </button>
                            </div>

                            {/* Modal Guia Consciência Temporal */}
                            {showTemporalGuide && (
                                <div
                                    onClick={() => setShowTemporalGuide(false)}
                                    style={{
                                        position: 'fixed', inset: 0, zIndex: 9999,
                                        background: 'rgba(2,6,23,0.8)',
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '1.5rem',
                                    }}
                                >
                                    <div
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                                            border: '1px solid rgba(99,102,241,0.2)',
                                            borderRadius: '20px', width: '100%', maxWidth: '640px',
                                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                                            boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '1.3rem 1.8rem',
                                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                                            flexShrink: 0,
                                        }}>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                                🕒 Guia do Comportamento
                                            </span>
                                            <button
                                                onClick={() => setShowTemporalGuide(false)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                                    cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                                            >✕</button>
                                        </div>

                                        {/* Body */}
                                        <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }} className="custom-scrollbar">
                                            {[
                                                { icon: '🕒', title: 'Consciência Temporal', accent: '#60a5fa',
                                                  desc: <>Quando ativada, o agente recebe automaticamente a <strong style={{color:'#e2e8f0'}}>data e hora atual</strong> injetadas no system prompt a cada mensagem.</>,
                                                  code: <><span style={{color:'#475569'}}>{'// O que é injetado no prompt (exemplo):'}</span>{'\n'}<span style={{color:'#60a5fa'}}>Data atual: quinta-feira, 12 de março de 2026{'\n'}Horário atual: 14:35 (UTC-3, Brasília)</span></>,
                                                  tip: 'Essencial para agentes de agendamento, horários de funcionamento, prazos ou qualquer contexto onde "hoje" e "agora" importam.' },
                                                { icon: '❓', title: 'Por que ativar?', accent: '#4ade80',
                                                  desc: <>Modelos de IA não têm acesso ao relógio do sistema por padrão. <strong style={{color:'#e2e8f0'}}>Sem essa opção</strong>, o agente pode responder com datas incorretas ou afirmar que não sabe que dia é hoje.</>,
                                                  code: <><span style={{color:'#f87171'}}>❌ Sem Consciência Temporal:{'\n'}</span><span style={{color:'#94a3b8'}}>{"Usuário: \"Que dia é hoje?\"\nAgente: \"Não tenho acesso à data atual.\""}{'\n\n'}</span><span style={{color:'#4ade80'}}>✅ Com Consciência Temporal:{'\n'}</span><span style={{color:'#94a3b8'}}>{"Usuário: \"Que dia é hoje?\"\nAgente: \"Hoje é quinta-feira, 12 de março de 2026.\""}</span></>,
                                                  tip: 'Ative sempre que o agente precisar raciocinar sobre tempo: dias úteis, dias restantes para um prazo, horários de atendimento, etc.' },
                                                { icon: '🗓️', title: 'Casos de Uso Recomendados', accent: '#fbbf24',
                                                  desc: 'Situações onde a consciência temporal é fundamental para respostas precisas.',
                                                  code: <><span style={{color:'#fbbf24'}}>Atendimento ao cliente</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Nossa loja fecha daqui a 2 horas.\""}{'\n'}</span><span style={{color:'#fbbf24'}}>Agendamentos</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Posso marcar para amanhã, dia 13.\""}{'\n'}</span><span style={{color:'#fbbf24'}}>Prazos e vencimentos</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Sua fatura vence em 3 dias.\""}{'\n'}</span><span style={{color:'#fbbf24'}}>Saudações contextuais</span>{' → '}<span style={{color:'#94a3b8'}}>{"\"Boa tarde! Como posso ajudar?\""}</span></>,
                                                  tip: 'Desative somente em agentes puramente informativos ou de FAQ estático, onde o tempo não é relevante.' },
                                                { icon: '⏰', title: 'Forçar Horário Específico (Opcional)', accent: '#c084fc',
                                                  desc: <>Substitui o horário real por um <strong style={{color:'#e2e8f0'}}>horário fixo simulado</strong>. O agente sempre "acredita" que é o horário definido, independente de quando a conversa acontece.</>,
                                                  code: <><span style={{color:'#475569'}}>{'// Exemplo com horário forçado = 09:00:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Usuário: \"Vocês estão abertos?\""}{'\n'}</span><span style={{color:'#c084fc'}}>{"Agente: \"Sim, acabamos de abrir! Nosso horário é das 9h às 18h.\""}{'\n\n'}</span><span style={{color:'#475569'}}>{'// Mesmo que o usuário escreva à meia-noite.'}</span></>,
                                                  tip: '⚠️ Use com cautela. Ideal para testes de fluxo de horário (ex: simular como o agente se comporta de manhã ou à noite) ou em integrações onde o fuso horário correto já vem de outra fonte.' },
                                            ].map((item, i) => (
                                                <div key={i} style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderLeft: `3px solid ${item.accent}`,
                                                    borderRadius: '12px', padding: '1.1rem 1.3rem',
                                                    transition: 'border-color 0.2s',
                                                }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                                        {item.icon} {item.title}
                                                    </div>
                                                    <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                                    <pre style={{
                                                        background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                                        padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        margin: '0 0 0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                                        border: '1px solid rgba(255,255,255,0.04)',
                                                    }}>{item.code}</pre>
                                                    <div style={{
                                                        background: 'rgba(99,102,241,0.07)',
                                                        border: '1px solid rgba(99,102,241,0.12)',
                                                        borderRadius: '8px', padding: '8px 11px',
                                                        fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                                    }}>
                                                        <strong style={{ color: item.accent }}>Dica: </strong>{item.tip}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div className="checkbox-group" onClick={() => setDateAwareness(!dateAwareness)} style={{ flex: 1 }}>
                                    <input type="checkbox" checked={dateAwareness} onChange={() => { }} />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>
                                        🕒 Ativar Consciência Temporal
                                    </span>
                                </div>

                                {dateAwareness && (
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block', marginBottom: '0.4rem' }}>Forçar Horário Específico (Opcional)</label>
                                        <input
                                            type="time"
                                            value={simulatedTime}
                                            onChange={(e) => setSimulatedTime(e.target.value)}
                                            style={{ background: '#0f172a', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '8px', width: '100%' }}
                                        />
                                    </div>
                                )}
                            </div>

                            <PromptEditor
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                agentId={id}
                                availableTools={toolsList
                                    .filter(t => selectedTools.includes(t.id))
                                    .map(t => t.name)
                                }
                            />
                        </div>
                    </div>
                )}

                {/* TAB: HABILIDADES */}
                {activeTab === 'habilidades' && (
                    <div className="fade-in">

                        {/* Botão Guia Habilidades */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowHabilidadesGuide(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    color: '#6ee7b7', borderRadius: '10px',
                                    padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(99,102,241,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(99,102,241,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                <span>📖</span><span>Guia das Habilidades</span>
                            </button>
                        </div>

                        {/* Modal Guia Habilidades */}
                        {showHabilidadesGuide && (
                            <div
                                onClick={() => setShowHabilidadesGuide(false)}
                                style={{
                                    position: 'fixed', inset: 0, zIndex: 9999,
                                    background: 'rgba(2,6,23,0.8)',
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '1.5rem',
                                }}
                            >
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: '20px', width: '100%', maxWidth: '700px',
                                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                                        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1.3rem 1.8rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                                        flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                            ⚡ Guia das Habilidades
                                        </span>
                                        <button
                                            onClick={() => setShowHabilidadesGuide(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                                cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.color = '#6ee7b7'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                                        >✕</button>
                                    </div>

                                    {/* Body */}
                                    <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }} className="custom-scrollbar">
                                        {[
                                            { icon: '📚', title: 'Base de Conhecimento (RAG)', accent: '#4ade80',
                                              desc: <>Vincula documentos ao agente. Ao receber uma pergunta, o sistema busca automaticamente os trechos mais relevantes e os injeta no contexto antes de responder — sem precisar colocar tudo no prompt.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Fluxo de execução:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Pergunta do usuário{'\n'}</span><span style={{color:'#4ade80'}}>→ Busca vetorial na base{'\n'}</span><span style={{color:'#4ade80'}}>→ Injeta trechos relevantes no prompt{'\n'}</span><span style={{color:'#94a3b8'}}>→ Agente responde com contexto real</span></>,
                                              tip: 'Ideal para FAQs, manuais, catálogos de produtos, políticas internas. A base é atualizada sem precisar alterar o prompt.' },
                                            { icon: '🔢', title: 'Número de Respostas (RAG Limit)', accent: '#60a5fa',
                                              desc: <>Define quantos <strong style={{color:'#e2e8f0'}}>trechos da base</strong> são recuperados a cada mensagem. Mais trechos = mais contexto para o agente, porém maior custo em tokens.</>,
                                              code: <><span style={{color:'#4ade80'}}>3 itens</span>{' → '}<span style={{color:'#94a3b8'}}>Focado, barato, pode perder detalhes{'\n'}</span><span style={{color:'#60a5fa'}}>5 itens</span>{' → '}<span style={{color:'#94a3b8'}}>Equilíbrio (recomendado){'\n'}</span><span style={{color:'#f87171'}}>15+ itens</span>{' → '}<span style={{color:'#94a3b8'}}>Máximo contexto, custo elevado</span></>,
                                              tip: 'Para suporte técnico com muitas variáveis, use 7–10. Para FAQ simples, 3–5 é suficiente.' },
                                            { icon: '🌍', title: 'Tradução Automática de Busca (Cross-Language)', accent: '#fbbf24',
                                              desc: <>Antes de buscar na base, <strong style={{color:'#e2e8f0'}}>traduz a pergunta do usuário</strong> para o idioma em que a base foi escrita. Resolve a barreira de idioma sem precisar duplicar o conteúdo.</>,
                                              code: <><span style={{color:'#f87171'}}>❌ Sem tradução:</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Usuário: \"What's the return policy?\" → Busca: 0 resultados"}{'\n\n'}</span><span style={{color:'#4ade80'}}>✅ Com tradução:</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Usuário: \"What's the return policy?\" → Traduz → \"Qual a política de troca?\" → Encontra 4 trechos"}</span></>,
                                              tip: '⚠️ Usa o LLM principal a cada busca, aumentando custo. Ative apenas se seus usuários escrevem em idiomas diferentes do conteúdo da base.' },
                                            { icon: '🔀', title: 'Busca Multi-Variável (Multi-Query)', accent: '#38bdf8',
                                              desc: <>Em vez de buscar com a pergunta exata, o sistema gera <strong style={{color:'#e2e8f0'}}>múltiplas versões</strong> da mesma dúvida e faz buscas paralelas, maximizando os resultados encontrados.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Pergunta original: "Como faço o reembolso?"'}</span>{'\n'}<span style={{color:'#38bdf8'}}>Variante 1:</span><span style={{color:'#94a3b8'}}>{' "Política de devolução"'}</span>{'\n'}<span style={{color:'#38bdf8'}}>Variante 2:</span><span style={{color:'#94a3b8'}}>{' "Cancelamento e estorno"'}</span>{'\n'}<span style={{color:'#38bdf8'}}>Variante 3:</span><span style={{color:'#94a3b8'}}>{' "Pedido de reembolso"'}</span></>,
                                              tip: '⚠️ Custo 2x–3x por busca (usa o LLM para gerar variantes). Ative para bases com terminologia variada onde uma só busca pode não cobrir tudo.' },
                                            { icon: '🎯', title: 'Re-Rankeador Semântico (LLM Reranking)', accent: '#a78bfa',
                                              desc: <>Após a busca vetorial, uma <strong style={{color:'#e2e8f0'}}>IA relê os trechos encontrados</strong> e os reordena do mais ao menos relevante para a pergunta específica do usuário.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Sem reranking (ordem bruta):'}</span>{'\n'}<span style={{color:'#f87171'}}>1º Trecho sobre frete → 2º Sobre troca → 3º Sobre prazo</span>{'\n\n'}<span style={{color:'#475569'}}>{'// Com reranking (inteligente):'}</span>{'\n'}<span style={{color:'#a78bfa'}}>1º Trecho sobre prazo → 2º Sobre frete → 3º Sobre troca</span></>,
                                              tip: 'Extremamente preciso. Ative sempre que a qualidade da resposta for crítica. Usa o modelo principal — leve aumento de latência e custo.' },
                                            { icon: '📖', title: 'Expansão de Contexto Pai (Parent Docs)', accent: '#34d399',
                                              desc: <>Quando um parágrafo relevante é encontrado, o sistema <strong style={{color:'#e2e8f0'}}>busca o documento completo</strong> de origem e o inclui no contexto — o agente vê o todo, não só o fragmento.</>,
                                              code: <><span style={{color:'#f87171'}}>❌ Sem expansão:</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Agente recebe: \"...o prazo é de 7 dias úteis...\""}{'\n\n'}</span><span style={{color:'#34d399'}}>✅ Com expansão:</span>{'\n'}<span style={{color:'#94a3b8'}}>{"Agente recebe: Documento completo de Política de Trocas (500 palavras)"}</span></>,
                                              tip: 'Ideal para documentos onde o contexto ao redor muda o significado (ex: contratos, manuais técnicos). Aumenta uso de tokens por resposta.' },
                                            { icon: '🛑', title: 'Avaliador Agêntico (Self-Correction)', accent: '#fb923c',
                                              desc: <>Um <strong style={{color:'#e2e8f0'}}>agente avaliador independente</strong> revisa os trechos recuperados e descarta os que não respondem a dúvida antes de passá-los ao agente principal, zerando alucinações de RAG.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Pipeline com Avaliador Agêntico:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Busca → 8 trechos encontrados{'\n'}</span><span style={{color:'#fb923c'}}>Avaliador → descarta 5 irrelevantes{'\n'}</span><span style={{color:'#4ade80'}}>Agente recebe → 3 trechos certeiros</span></>,
                                              tip: 'A proteção mais forte contra respostas inventadas. Recomendado em bases com muitos documentos mistos. Adiciona uma chamada LLM extra.' },
                                            { icon: '🛠️', title: 'Ações & Ferramentas (API)', accent: '#c084fc',
                                              desc: <>Conecta o agente a <strong style={{color:'#e2e8f0'}}>sistemas externos via API ou Webhook</strong>. O agente decide autonomamente quando e como usar cada ferramenta para completar tarefas.</>,
                                              code: <><span style={{color:'#c084fc'}}>Ferramentas Nativas:</span><span style={{color:'#94a3b8'}}>{' Google Calendar, etc.'}</span>{'\n'}<span style={{color:'#c084fc'}}>Ferramentas Webhook:</span><span style={{color:'#94a3b8'}}>{' APIs personalizadas (CRM, ERP, n8n...)'}</span></>,
                                              tip: 'Exemplos: consultar estoque em tempo real, criar agendamentos, registrar leads no CRM. O modelo precisa suportar function calling (ex: gpt-4o, gemini-pro).' },
                                            { icon: '📥', title: 'Inbox de Dúvidas (Captura Automática)', accent: '#10b981',
                                              desc: <>Quando o agente <strong style={{color:'#e2e8f0'}}>não encontra resposta</strong> na base de conhecimento, a pergunta é automaticamente salva no Inbox para você revisar e adicionar o conteúdo faltante.</>,
                                              code: <><span style={{color:'#f87171'}}>Agente: "Não encontrei informação sobre isso."{'\n'}</span><span style={{color:'#10b981'}}>→ Pergunta registrada no Inbox automaticamente{'\n'}</span><span style={{color:'#94a3b8'}}>→ Você ensina o agente adicionando a resposta</span></>,
                                              tip: 'Ferramenta poderosa para melhorar continuamente o agente com base nas dúvidas reais dos usuários. Mantenha sempre ativo em produção.' },
                                            { icon: '🤝', title: 'Orquestração de Enxame (Swarm Handoff)', accent: '#8b5cf6',
                                              desc: <>Permite que este agente <strong style={{color:'#e2e8f0'}}>transfira o atendimento</strong> para outro agente especialista ou humano, enviando um resumo automático da conversa para continuidade.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Exemplo de fluxo:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Agente de Suporte Geral{'\n'}</span><span style={{color:'#8b5cf6'}}>→ Detecta assunto técnico complexo{'\n'}</span><span style={{color:'#8b5cf6'}}>→ Transfere para Agente Técnico + resumo{'\n'}</span><span style={{color:'#94a3b8'}}>→ Usuário não percebe a transição</span></>,
                                              tip: 'Ideal para arquiteturas multi-agente. Configure os agentes destino nas ferramentas de Handoff disponíveis.' },
                                            { icon: '🌐', title: 'Tradução Automática de Resposta', accent: '#60a5fa',
                                              desc: <>Uma IA secundária detecta o idioma da mensagem do usuário e <strong style={{color:'#e2e8f0'}}>traduz a resposta automaticamente</strong> para o mesmo idioma, sem precisar manter bases em múltiplos idiomas.</>,
                                              code: <><span style={{color:'#60a5fa'}}>Base em Português{'\n'}</span><span style={{color:'#94a3b8'}}>Usuário escreve em Inglês → Agente responde em Inglês{'\n'}</span><span style={{color:'#94a3b8'}}>Usuário escreve em Espanhol → Agente responde em Espanhol{'\n'}</span><span style={{color:'#94a3b8'}}>Idioma não detectado → usa idioma de Fallback</span></>,
                                              tip: '⚠️ Usa uma chamada LLM extra por resposta. Ative se você atende um público internacional mas mantém uma única base de conhecimento.' },
                                        ].map((item, i) => (
                                            <div key={i} style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderLeft: `3px solid ${item.accent}`,
                                                borderRadius: '12px', padding: '1.1rem 1.3rem',
                                                transition: 'border-color 0.2s',
                                            }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                                    {item.icon} {item.title}
                                                </div>
                                                <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                                <pre style={{
                                                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                                    padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                    margin: '0 0 0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                }}>{item.code}</pre>
                                                <div style={{
                                                    background: 'rgba(16,185,129,0.06)',
                                                    border: '1px solid rgba(16,185,129,0.1)',
                                                    borderRadius: '8px', padding: '8px 11px',
                                                    fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                                }}>
                                                    <strong style={{ color: item.accent }}>Dica: </strong>{item.tip}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-section">
                            <span className="section-label">Conhecimento Externo (RAG)</span>
                            <div className="form-group">
                                <label>Vincular Bases de Conhecimento</label>
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <select
                                        style={{ flex: 1 }}
                                        value=""
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val && !knowledgeBaseIds.includes(val)) {
                                                setKnowledgeBaseIds([...knowledgeBaseIds, val]);
                                            }
                                        }}
                                    >
                                        <option value="">+ Adicionar Base...</option>
                                        {kbList
                                            .filter(kb => !knowledgeBaseIds.includes(kb.id))
                                            .map(kb => (
                                                <option key={kb.id} value={kb.id}>{kb.name} ({kb.items?.length || 0} itens)</option>
                                            ))}
                                    </select>
                                    <Link to="/knowledge-bases" className="access-btn">Gerenciar Bases</Link>
                                </div>

                                <div className="selected-tools-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {knowledgeBaseIds.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Nenhuma base vinculada.</p>}
                                    {knowledgeBaseIds.map(kbId => {
                                        const kb = kbList.find(b => b.id === kbId);
                                        return (
                                            <div key={kbId} className="tool-chip" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                                <span>📚 {kb ? kb.name : `ID: ${kbId}`}</span>
                                                <button onClick={() => setKnowledgeBaseIds(knowledgeBaseIds.filter(id => id !== kbId))}>✕</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>
                                    Número de Respostas (RAG Limit)
                                    <span className="label-value">{ragRetrievalCount} itens</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input
                                        type="range" min="1" max="20" step="1"
                                        value={ragRetrievalCount}
                                        onChange={(e) => setRagRetrievalCount(parseInt(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1', width: '30px' }}>{ragRetrievalCount}</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                                    Quantos trechos de conhecimento o agente deve recuperar para responder. Maior = mais contexto (mais caro). Menor = mais focado.
                                </p>
                            </div>

                            {/* Advanced RAG Settings Panel */}
                            <div className="form-group" style={{
                                marginTop: '2rem',
                                background: 'rgba(255,255,255,0.02)',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <label style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                                    <span>🧠 Módulos Avançados de RAG</span>
                                </label>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                                    Otimize a inteligência e o custo de buscas na Base de Conhecimento habilitando as camadas adicionais.
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>

                                    {/* Translation */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🌍 Tradução Automática de Busca (Cross-Language)</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Traduz perguntas de qualquer idioma para o idioma da base antes de procurar. Eleva o nível semântico para multi-idioma (Usa LLM principal).</div>
                                        </div>
                                        <div className={`status-badge ${ragTranslationEnabled ? 'active' : ''}`}
                                            onClick={() => setRagTranslationEnabled(!ragTranslationEnabled)}
                                            style={{ cursor: 'pointer', minWidth: '80px', textAlign: 'center' }}>
                                            {ragTranslationEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                    {/* Multi-Query */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🔀 Busca Multi-Variável (Multi-Query)</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Gera diferentes formas de interpretar a pergunta do usuário para maximizar os resultados (Usa LLM principal. Custo 2x na busca).</div>
                                        </div>
                                        <div className={`status-badge ${ragMultiQueryEnabled ? 'active' : ''}`}
                                            onClick={() => setRagMultiQueryEnabled(!ragMultiQueryEnabled)}
                                            style={{ cursor: 'pointer', minWidth: '80px', textAlign: 'center' }}>
                                            {ragMultiQueryEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                    {/* Reranking */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🎯 Re-Rankeador Semântico (LLM Reranking)</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pede à IA para inspecionar os resultados e reordena-os do mais útil ao menos útil. Extremamente preciso (Usa modelo principal).</div>
                                        </div>
                                        <div className={`status-badge ${ragRerankEnabled ? 'active' : ''}`}
                                            onClick={() => setRagRerankEnabled(!ragRerankEnabled)}
                                            style={{ cursor: 'pointer', minWidth: '80px', textAlign: 'center' }}>
                                            {ragRerankEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                    {/* Parent Expansion */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>📖 Expansão de Contexto Pai (Parent Docs)</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Se a busca achar um parágrafo relevante, anexa a página inteira ao contexto. Permite à IA ver o macro, não só o micro.</div>
                                        </div>
                                        <div className={`status-badge ${ragParentExpansionEnabled ? 'active' : ''}`}
                                            onClick={() => setRagParentExpansionEnabled(!ragParentExpansionEnabled)}
                                            style={{ cursor: 'pointer', minWidth: '80px', textAlign: 'center' }}>
                                            {ragParentExpansionEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                    {/* Agentic Evaluation */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🛑 Avaliador Agêntico (Self-Correction)</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Filtro final. Um Agente avaliador descarta respostas soltas que não resolvem a dúvida original ANTES de injetar no prompt, zerando alucinações.</div>
                                        </div>
                                        <div className={`status-badge ${ragAgenticEvalEnabled ? 'active' : ''}`}
                                            onClick={() => setRagAgenticEvalEnabled(!ragAgenticEvalEnabled)}
                                            style={{ cursor: 'pointer', minWidth: '80px', textAlign: 'center' }}>
                                            {ragAgenticEvalEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <span className="section-label">Ações & Ferramentas (API)</span>
                            <div className="form-group">
                                <label>Adicionar Habilidades ao Agente</label>
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <select
                                        style={{ flex: 1 }}
                                        value=""
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val && !selectedTools.includes(val)) {
                                                setSelectedTools([...selectedTools, val]);
                                            }
                                        }}
                                    >
                                        <option value="">Escolher Ferramenta...</option>
                                        {/* Ferramentas Nativas (Google Calendar etc) */}
                                        {toolsList.filter(t => !t.webhook_url && !selectedTools.includes(t.id) && (!t.name.includes('google') || googleConnected)).length > 0 && (
                                            <optgroup label="📅 Ferramentas Nativas">
                                                {toolsList
                                                    .filter(t => !t.webhook_url && !selectedTools.includes(t.id) && (!t.name.includes('google') || googleConnected))
                                                    .map(tool => (
                                                        <option key={tool.id} value={tool.id}>📅 {tool.name}</option>
                                                    ))
                                                }
                                            </optgroup>
                                        )}
                                        {/* Ferramentas via Webhook */}
                                        {toolsList.filter(t => t.webhook_url && !selectedTools.includes(t.id)).length > 0 && (
                                            <optgroup label="🔗 Ferramentas via Webhook">
                                                {toolsList
                                                    .filter(t => t.webhook_url && !selectedTools.includes(t.id))
                                                    .map(tool => (
                                                        <option key={tool.id} value={tool.id} disabled={!activeModelSupportsTools}>
                                                            {tool.name}{!activeModelSupportsTools ? ' (modelo sem suporte)' : ''}
                                                        </option>
                                                    ))
                                                }
                                            </optgroup>
                                        )}
                                    </select>
                                    <Link to="/tools" className="access-btn">Criar Nova</Link>
                                </div>

                                <div className="selected-tools-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {selectedTools.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Nenhuma habilidade selecionada.</p>}
                                    {selectedTools.map(toolId => {
                                        const tool = toolsList.find(t => t.id === toolId);
                                        if (!tool) return null;
                                        const isNative = !tool.webhook_url;
                                        return (
                                            <div key={toolId} className="tool-chip" style={isNative ? { background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' } : {}}>
                                                <span>{isNative ? '📅' : '🛠️'} {tool.name}</span>
                                                <button onClick={() => setSelectedTools(selectedTools.filter(id => id !== toolId))}>✕</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* INBOX CAPTURE CONFIG */}
                        <div className="form-section" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <span className="section-label" style={{ color: '#10b981', margin: 0 }}>📥 Inbox de Dúvidas (Captura Automática)</span>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Quando ativo, o agente registrará automaticamente qualquer pergunta que não souber responder para que você possa ensiná-lo depois.
                                    </p>
                                </div>
                                <div
                                    className={`status-badge ${inboxCaptureEnabled ? 'active' : ''}`}
                                    onClick={() => setInboxCaptureEnabled(!inboxCaptureEnabled)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '10px 20px',
                                        borderRadius: '24px',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        background: inboxCaptureEnabled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        transition: 'all 0.3s ease',
                                        boxShadow: inboxCaptureEnabled ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {inboxCaptureEnabled ? 'ATIVADO' : 'DESATIVADO'}
                                </div>
                            </div>
                        </div>

                        {/* SWARM HANDOFF CONFIG */}
                        <div className="form-section" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <span className="section-label" style={{ color: '#8b5cf6', margin: 0 }}>🤝 Orquestração de Enxame (Swarm Handoff)</span>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Permite que este agente transfira o atendimento para outros especialistas ou humanos, enviando um resumo automático da conversa.
                                    </p>
                                </div>
                                <div
                                    className={`status-badge ${handoffEnabled ? 'active' : ''}`}
                                    onClick={() => setHandoffEnabled(!handoffEnabled)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '10px 20px',
                                        borderRadius: '24px',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        background: handoffEnabled ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        transition: 'all 0.3s ease',
                                        boxShadow: handoffEnabled ? '0 4px 15px rgba(124, 58, 237, 0.4)' : 'none',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {handoffEnabled ? '✨ HANDOFF ATIVO' : 'DESATIVADO'}
                                </div>
                            </div>
                        </div>

                        {/* RESPONSE TRANSLATION */}
                        <div className="form-section" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#a5b4fc', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        🌐 Tradução Automática de Resposta
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                                        Uma IA secundária detecta o idioma da mensagem do usuário e traduz a resposta automaticamente.
                                        Se não detectar, usa o idioma de fallback abaixo.
                                        {routerEnabled
                                            ? <span style={{ color: '#6ee7b7', marginLeft: '4px' }}>Usa o modelo simples do router.</span>
                                            : <span style={{ color: '#94a3b8', marginLeft: '4px' }}>Usa gpt-4o-mini.</span>
                                        }
                                    </p>
                                    {responseTranslationEnabled && (() => {
                                        const ALL_LANGS = [
                                            { code: 'pt-br', label: 'Português (Brasil)',    flag: '🇧🇷' },
                                            { code: 'pt-pt', label: 'Português (Portugal)',  flag: '🇵🇹' },
                                            { code: 'en',    label: 'Inglês',                flag: '🇺🇸' },
                                            { code: 'es',    label: 'Espanhol',              flag: '🇪🇸' },
                                            { code: 'fr',    label: 'Francês',               flag: '🇫🇷' },
                                            { code: 'de',    label: 'Alemão',                flag: '🇩🇪' },
                                            { code: 'it',    label: 'Italiano',              flag: '🇮🇹' },
                                            { code: 'ja',    label: 'Japonês',               flag: '🇯🇵' },
                                            { code: 'zh',    label: 'Chinês (Simplificado)', flag: '🇨🇳' },
                                            { code: 'zh-tw', label: 'Chinês (Tradicional)',  flag: '🇹🇼' },
                                            { code: 'ar',    label: 'Árabe',                 flag: '🇸🇦' },
                                            { code: 'ko',    label: 'Coreano',               flag: '🇰🇷' },
                                            { code: 'ru',    label: 'Russo',                 flag: '🇷🇺' },
                                            { code: 'hi',    label: 'Hindi',                 flag: '🇮🇳' },
                                            { code: 'nl',    label: 'Holandês',              flag: '🇳🇱' },
                                            { code: 'pl',    label: 'Polonês',               flag: '🇵🇱' },
                                            { code: 'tr',    label: 'Turco',                 flag: '🇹🇷' },
                                            { code: 'sv',    label: 'Sueco',                 flag: '🇸🇪' },
                                            { code: 'no',    label: 'Norueguês',             flag: '🇳🇴' },
                                            { code: 'da',    label: 'Dinamarquês',           flag: '🇩🇰' },
                                            { code: 'fi',    label: 'Finlandês',             flag: '🇫🇮' },
                                            { code: 'el',    label: 'Grego',                 flag: '🇬🇷' },
                                            { code: 'cs',    label: 'Tcheco',                flag: '🇨🇿' },
                                            { code: 'hu',    label: 'Húngaro',               flag: '🇭🇺' },
                                            { code: 'ro',    label: 'Romeno',                flag: '🇷🇴' },
                                            { code: 'uk',    label: 'Ucraniano',             flag: '🇺🇦' },
                                            { code: 'id',    label: 'Indonésio',             flag: '🇮🇩' },
                                            { code: 'ms',    label: 'Malaio',                flag: '🇲🇾' },
                                            { code: 'th',    label: 'Tailandês',             flag: '🇹🇭' },
                                            { code: 'vi',    label: 'Vietnamita',            flag: '🇻🇳' },
                                            { code: 'he',    label: 'Hebraico',              flag: '🇮🇱' },
                                        ];
                                        const q = langSearch.toLowerCase();
                                        const filtered = ALL_LANGS.map((l, i) => ({ ...l, num: i + 1 })).filter(l =>
                                            l.label.toLowerCase().includes(q) || l.code.includes(q)
                                        );
                                        const selected = ALL_LANGS.find(l => l.code === responseTranslationFallbackLang);
                                        return (
                                            <div style={{ marginTop: '1rem' }}>
                                                <label style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Idioma de Fallback</label>
                                                <div style={{ position: 'relative', marginTop: '6px' }}>
                                                    {/* Trigger button */}
                                                    <div
                                                        onClick={() => { setLangDropdownOpen(o => !o); setLangSearch(''); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                            fontSize: '0.85rem', color: '#e2e8f0',
                                                        }}
                                                    >
                                                        <span>{selected ? `${selected.flag} ${selected.label}` : '— Selecionar —'}</span>
                                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{langDropdownOpen ? '▲' : '▼'}</span>
                                                    </div>
                                                    {/* Dropdown */}
                                                    {langDropdownOpen && (
                                                        <div style={{
                                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                                            background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)',
                                                            borderRadius: '8px', marginTop: '4px',
                                                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                                        }}>
                                                            {/* Search input */}
                                                            <div style={{ padding: '8px' }}>
                                                                <input
                                                                    autoFocus
                                                                    placeholder="🔍 Buscar idioma..."
                                                                    value={langSearch}
                                                                    onChange={e => setLangSearch(e.target.value)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    style={{
                                                                        width: '100%', padding: '6px 10px', borderRadius: '6px',
                                                                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                                                        color: '#e2e8f0', fontSize: '0.82rem', outline: 'none',
                                                                    }}
                                                                />
                                                            </div>
                                                            {/* List */}
                                                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                                                {filtered.map(l => (
                                                                    <div
                                                                        key={l.code}
                                                                        onClick={() => { setResponseTranslationFallbackLang(l.code); setLangDropdownOpen(false); setLangSearch(''); }}
                                                                        style={{
                                                                            padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                                                                            color: l.code === responseTranslationFallbackLang ? '#a5b4fc' : '#e2e8f0',
                                                                            background: l.code === responseTranslationFallbackLang ? 'rgba(99,102,241,0.15)' : 'transparent',
                                                                            transition: 'background 0.15s',
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                        onMouseLeave={e => e.currentTarget.style.background = l.code === responseTranslationFallbackLang ? 'rgba(99,102,241,0.15)' : 'transparent'}
                                                                    >
                                                                        <span style={{ color: '#475569', fontSize: '0.7rem', marginRight: '6px', minWidth: '18px', display: 'inline-block' }}>{l.num}.</span>
                                                                        {l.flag} {l.label}
                                                                    </div>
                                                                ))}
                                                                {filtered.length === 0 && (
                                                                    <div style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.82rem' }}>
                                                                        Nenhum idioma encontrado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px' }}>
                                                    Usado quando o idioma do usuário não puder ser identificado.
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div
                                    onClick={() => setResponseTranslationEnabled(!responseTranslationEnabled)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '10px 20px',
                                        borderRadius: '24px',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        background: responseTranslationEnabled ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        transition: 'all 0.3s ease',
                                        boxShadow: responseTranslationEnabled ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        whiteSpace: 'nowrap',
                                        marginLeft: '1rem',
                                        marginTop: '2px'
                                    }}
                                >
                                    {responseTranslationEnabled ? '🌐 ATIVO' : 'DESATIVADO'}
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* TAB: SEGURANÇA */}
                {activeTab === 'seguranca' && (
                    <div className="fade-in">
                        <div className="form-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <span className="section-label" style={{ color: '#f43f5e', margin: 0 }}>🛡️ Guardrails & Moderação</span>
                                <button
                                    type="button"
                                    onClick={() => setShowSecurityGuide(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        background: 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                                        border: '1px solid rgba(244,63,94,0.3)',
                                        color: '#fda4af', borderRadius: '10px',
                                        padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(244,63,94,0.22) 0%, rgba(99,102,241,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(99,102,241,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    <span>📖</span><span>Guia de Segurança</span>
                                </button>
                            </div>

                            {/* Modal Guia de Segurança — portal via fixed overlay */}
                            {showSecurityGuide && (
                                <div
                                    onClick={() => setShowSecurityGuide(false)}
                                    style={{
                                        position: 'fixed', inset: 0, zIndex: 9999,
                                        background: 'rgba(2,6,23,0.8)',
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '1.5rem',
                                    }}
                                >
                                    <div
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                                            border: '1px solid rgba(244,63,94,0.2)',
                                            borderRadius: '20px', width: '100%', maxWidth: '680px',
                                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                                            boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '1.3rem 1.8rem',
                                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                                            flexShrink: 0,
                                        }}>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fda4af', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                                🛡️ Guia de Segurança
                                            </span>
                                            <button
                                                onClick={() => setShowSecurityGuide(false)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                                    cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; e.currentTarget.style.color = '#fda4af'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                                            >✕</button>
                                        </div>

                                        {/* Body */}
                                        <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }} className="custom-scrollbar">
                                            {[
                                                { icon: '🚫', title: 'Tópicos Proibidos', accent: '#f87171',
                                                  desc: <>Liste assuntos que o agente deve <strong style={{color:'#e2e8f0'}}>evitar completamente</strong>, separados por vírgula.</>,
                                                  code: <><span style={{color:'#475569'}}>{'// Exemplo:'}</span>{'\n'}<span style={{color:'#f87171'}}>Política, Futebol, Conselhos Médicos</span></>,
                                                  tip: <>O agente recebe instrução de alta prioridade para mudar de assunto. Menções na resposta são substituídas por <code style={{background:'rgba(0,0,0,0.3)',padding:'1px 6px',borderRadius:'4px',fontSize:'0.75rem'}}>[TOPICO BLOQUEADO]</code>.</> },
                                                { icon: '⛔', title: 'Blacklist de Concorrentes', accent: '#f87171',
                                                  desc: <>Nomes de empresas/produtos que o agente <strong style={{color:'#e2e8f0'}}>nunca deve mencionar</strong>.</>,
                                                  code: <><span style={{color:'#475569'}}>{'// Exemplo:'}</span>{'\n'}<span style={{color:'#f87171'}}>Empresa X, Produto Y, Marca Z</span></>,
                                                  tip: <>Menções são substituídas por <code style={{background:'rgba(0,0,0,0.3)',padding:'1px 6px',borderRadius:'4px',fontSize:'0.75rem'}}>[CONCORRENTE BLOQUEADO]</code>.</> },
                                                { icon: '💰', title: 'Teto e Política de Descontos', accent: '#86efac',
                                                  desc: 'Regra de desconto injetada no system prompt como instrução de alta prioridade.',
                                                  code: <><span style={{color:'#475569'}}>{'// Exemplo:'}</span>{'\n'}<span style={{color:'#86efac'}}>Máximo 10% apenas à vista. Nunca ofereça acima de 20%.</span></>,
                                                  tip: 'O agente jamais poderá prometer desconto acima do limite definido.' },
                                                { icon: '🔒', title: 'Ocultar Dados Sensíveis (PII)', accent: '#4ade80',
                                                  desc: <>Filtra dados pessoais na <strong style={{color:'#e2e8f0'}}>resposta final</strong> antes de chegar ao usuário.</>,
                                                  code: <><span style={{color:'#64748b'}}>email@ex.com</span>{' → '}<span style={{color:'#4ade80'}}>[EMAIL OCULTO]</span>{'\n'}<span style={{color:'#64748b'}}>123.456.789-00</span>{' → '}<span style={{color:'#4ade80'}}>[CPF OCULTO]</span>{'\n'}<span style={{color:'#64748b'}}>+55 11 9999-9999</span>{' → '}<span style={{color:'#4ade80'}}>[TELEFONE OCULTO]</span></>,
                                                  tip: 'Não impede o agente de receber dados do usuário — apenas bloqueia que ele os repita na resposta.' },
                                                { icon: '🔴', title: 'Auditoria por IA (Double-Check)', accent: '#fbbf24', tipBg: 'rgba(245,158,11,0.1)',
                                                  desc: <>Uma <strong style={{color:'#e2e8f0'}}>segunda IA</strong> revisa cada resposta antes de enviá-la.</>,
                                                  code: <><span style={{color:'#64748b'}}>Resposta</span>{' → '}<span style={{color:'#fbbf24'}}>Auditoria IA</span>{' → '}<span style={{color:'#4ade80'}}>Aprovada ✓</span>{'\n'}<span style={{color:'#64748b'}}>Resposta</span>{' → '}<span style={{color:'#fbbf24'}}>Auditoria IA</span>{' → '}<span style={{color:'#f87171'}}>Bloqueada ✗</span></>,
                                                  tip: '⚠️ Faz uma chamada extra à LLM em toda mensagem — aumenta custo e latência. Use apenas em ambientes com conformidade crítica.' },
                                                { icon: '🛡️', title: 'Proteção Anti-Loop (Bot Defense)', accent: '#818cf8',
                                                  desc: 'Detecta comportamentos suspeitos de bots ou automações em loop.',
                                                  code: <><span style={{color:'#475569'}}>{'// Limite por sessão (padrão: 20 msgs)'}</span>{'\n'}<span style={{color:'#818cf8'}}>Máx. Mensagens</span>{' → '}<span style={{color:'#86efac'}}>Bloqueia ao atingir{'\n'}</span><span style={{color:'#475569'}}>{'// Detecção de repetição (padrão: 85%)'}</span>{'\n'}<span style={{color:'#818cf8'}}>Threshold Semântico</span>{' → '}<span style={{color:'#86efac'}}>Detecta msgs duplicadas{'\n'}</span><span style={{color:'#818cf8'}}>Janela de Loop</span>{' → '}<span style={{color:'#86efac'}}>Nº de msgs anteriores comparadas</span></>,
                                                  tip: 'Se o usuário repetir mensagens similares dentro da janela configurada, o agente bloqueia e sinaliza intervenção humana.' },
                                                { icon: '💬', title: 'Nível de Linguagem (Tom e Complexidade)', accent: '#a78bfa',
                                                  desc: <>Define o <strong style={{color:'#e2e8f0'}}>estilo de comunicação</strong> do agente em todas as respostas.</>,
                                                  code: <><span style={{color:'#86efac'}}>Simples (Leigo)</span>{' → '}<span style={{color:'#94a3b8'}}>Linguagem acessível, sem jargões{'\n'}</span><span style={{color:'#a78bfa'}}>Padrão</span>{' → '}<span style={{color:'#94a3b8'}}>Equilíbrio entre clareza e precisão{'\n'}</span><span style={{color:'#60a5fa'}}>Técnico (Expert)</span>{' → '}<span style={{color:'#94a3b8'}}>Termos especializados, detalhado</span></>,
                                                  tip: 'Essa configuração injeta uma instrução no system prompt do agente. "Simples" é ideal para atendimento ao público geral; "Técnico" é recomendado para suporte a desenvolvedores ou equipes especializadas.' },
                                            ].map((item, i) => (
                                                <div key={i} style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderLeft: `3px solid ${item.accent}`,
                                                    borderRadius: '12px', padding: '1.1rem 1.3rem',
                                                    transition: 'border-color 0.2s',
                                                }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                                        {item.icon} {item.title}
                                                    </div>
                                                    <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                                    <pre style={{
                                                        background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                                        padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        margin: '0 0 0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                                        border: '1px solid rgba(255,255,255,0.04)',
                                                    }}>{item.code}</pre>
                                                    <div style={{
                                                        background: item.tipBg || 'rgba(99,102,241,0.07)',
                                                        border: `1px solid ${item.tipBg ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.12)'}`,
                                                        borderRadius: '8px', padding: '8px 11px',
                                                        fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                                    }}>
                                                        <strong style={{ color: item.accent }}>Como funciona: </strong>{item.tip}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>🚫 Tópicos Proibidos</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Política, Religião, Futebol, Conselhos Médicos..."
                                    value={securityForbidden}
                                    onChange={(e) => setSecurityForbidden(e.target.value)}
                                    style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                    Assuntos que o agente evitará ativamente, mudando de assunto se perguntado.
                                </p>
                            </div>

                            <div className="form-group">
                                <label>⛔ Blacklist de Concorrentes</label>
                                <textarea
                                    placeholder="Liste nomes de empresas ou produtos concorrentes que nunca devem ser mencionados..."
                                    value={securityBlacklist}
                                    onChange={(e) => setSecurityBlacklist(e.target.value)}
                                    style={{ minHeight: '60px', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>💰 Teto e Política de Descontos</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Máximo 10% apenas à vista. Nunca acima de 20%."
                                    value={securityDiscount}
                                    onChange={(e) => setSecurityDiscount(e.target.value)}
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '2rem' }}>
                                <label>🔒 Proteção de Dados (PII)</label>
                                <div style={{ display: 'flex', gap: '2rem', background: 'rgba(244, 63, 94, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                                    <div className="checkbox-group" onClick={() => setSecurityPii(!securityPii)} style={{ flex: 1 }}>
                                        <input type="checkbox" checked={securityPii} onChange={() => { }} />
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fda4af' }}>
                                            Ocultar Dados Sensíveis (CPF, Email, Cartão)
                                        </span>
                                    </div>

                                    <div className="checkbox-group" onClick={() => setSecurityValidatorIa(!securityValidatorIa)} style={{
                                        flex: 1,
                                        background: securityValidatorIa ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        transition: 'all 0.3s'
                                    }}>
                                        <input type="checkbox" checked={securityValidatorIa} onChange={() => { }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fda4af' }}>
                                                Ativar Auditoria por IA (Double-Check)
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                                Uma 2ª IA valida cada resposta antes do envio para garantir conformidade determinística.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '2.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '1rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🛡️</span> Proteção Anti-Loop (Bot Defense)
                                </label>

                                <div style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    marginTop: '1rem',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                                }}>
                                    <div className="checkbox-group" onClick={() => setSecurityBotProtection(!securityBotProtection)} style={{
                                        marginBottom: securityBotProtection ? '2rem' : '0.5rem',
                                        background: securityBotProtection ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        transition: 'all 0.3s'
                                    }}>
                                        <input type="checkbox" checked={securityBotProtection} onChange={() => { }} />
                                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: securityBotProtection ? '#fff' : '#94a3b8' }}>
                                            Ativar Vigilância de Sessão e Redundância
                                        </span>
                                    </div>

                                    {securityBotProtection && (
                                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1.5fr', gap: '2rem', alignItems: 'center' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '8px' }}>
                                                        Limite de Mensagens
                                                    </label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            value={securityMaxMessages}
                                                            onChange={(e) => setSecurityMaxMessages(e.target.value)}
                                                            style={{
                                                                background: '#0f172a',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                paddingLeft: '12px',
                                                                height: '42px',
                                                                fontSize: '1rem',
                                                                color: '#fff'
                                                            }}
                                                        />
                                                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#64748b' }}>msgs</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '8px' }}>
                                                        Janela de Análise (Múltiplas Tentativas)
                                                    </label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={securityLoopCount}
                                                            onChange={(e) => setSecurityLoopCount(e.target.value)}
                                                            style={{
                                                                background: '#0f172a',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                paddingLeft: '12px',
                                                                height: '42px',
                                                                fontSize: '1rem',
                                                                color: '#fff'
                                                            }}
                                                        />
                                                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#64748b' }}>olhadas</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px' }}>
                                                        Analisa as últimas {securityLoopCount} mensagens para detectar loops.
                                                    </p>
                                                </div>

                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                                                            Sensibilidade Semântica
                                                        </label>
                                                        <span style={{
                                                            background: '#6366f1',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 'bold',
                                                            color: '#fff'
                                                        }}>
                                                            {Math.round(securitySemanticThreshold * 100)}%
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>LEVE</span>
                                                        <input
                                                            type="range"
                                                            min="0.5"
                                                            max="0.98"
                                                            step="0.01"
                                                            value={securitySemanticThreshold}
                                                            onChange={(e) => setSecuritySemanticThreshold(parseFloat(e.target.value))}
                                                            style={{
                                                                flex: 1,
                                                                height: '6px',
                                                                borderRadius: '3px',
                                                                accentColor: '#6366f1',
                                                                cursor: 'pointer'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>RIGOROSA</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                gap: '12px',
                                                padding: '12px',
                                                background: 'rgba(0,0,0,0.2)',
                                                borderRadius: '8px',
                                                borderLeft: '4px solid #6366f1'
                                            }}>
                                                <span style={{ fontSize: '1.1rem' }}>💡</span>
                                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                                                    <strong>Como funciona:</strong> Se o sistema detectar mensagens do usuário com mais de <strong>{Math.round(securitySemanticThreshold * 100)}%</strong> de similaridade em um curto intervalo, o atendimento será pausado automaticamente para evitar loops de IA.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <span className="section-label">🗣️ Tom e Complexidade</span>
                            <div className="form-group">
                                <label>Nível de Linguagem</label>
                                <div className="complexity-selector">
                                    <button
                                        type="button"
                                        className={`toggle-option ${securityComplexity === 'simple' ? 'active' : ''}`}
                                        onClick={() => setSecurityComplexity('simple')}
                                    >
                                        <span className="toggle-icon">🧒</span>
                                        <span className="toggle-label">Simples (Leigo)</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`toggle-option ${securityComplexity === 'standard' ? 'active' : ''}`}
                                        onClick={() => setSecurityComplexity('standard')}
                                    >
                                        <span className="toggle-icon">😐</span>
                                        <span className="toggle-label">Padrão</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`toggle-option ${securityComplexity === 'technical' ? 'active' : ''}`}
                                        onClick={() => setSecurityComplexity('technical')}
                                    >
                                        <span className="toggle-icon">👨‍💻</span>
                                        <span className="toggle-label">Técnico (Expert)</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: WHITELABEL */}
                {activeTab === 'whitelabel' && (
                    <div className="fade-in">

                        {/* Botão Guia Whitelabel */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowWhitelabelGuide(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                                    border: '1px solid rgba(236,72,153,0.3)',
                                    color: '#f9a8d4', borderRadius: '10px',
                                    padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(99,102,241,0.22) 100%)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                <span>📖</span><span>Guia do Whitelabel</span>
                            </button>
                        </div>

                        {/* Modal Guia Whitelabel */}
                        {showWhitelabelGuide && (
                            <div
                                onClick={() => setShowWhitelabelGuide(false)}
                                style={{
                                    position: 'fixed', inset: 0, zIndex: 9999,
                                    background: 'rgba(2,6,23,0.8)',
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '1.5rem',
                                }}
                            >
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        background: 'linear-gradient(145deg, #0d1526 0%, #1a2540 100%)',
                                        border: '1px solid rgba(236,72,153,0.2)',
                                        borderRadius: '20px', width: '100%', maxWidth: '680px',
                                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                                        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1.3rem 1.8rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                                        flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f9a8d4', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                                            🎨 Guia do Whitelabel
                                        </span>
                                        <button
                                            onClick={() => setShowWhitelabelGuide(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#64748b', borderRadius: '8px', width: '32px', height: '32px',
                                                cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(236,72,153,0.15)'; e.currentTarget.style.color = '#f9a8d4'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
                                        >✕</button>
                                    </div>

                                    {/* Body */}
                                    <div style={{ overflowY: 'auto', padding: '1.6rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }} className="custom-scrollbar">
                                        {[
                                            { icon: '🎨', title: 'Cor Primária (Botão e Balões)', accent: '#f9a8d4',
                                              desc: <>Define a <strong style={{color:'#e2e8f0'}}>cor principal do chat</strong>: botão de envio, balões de mensagem do usuário e elementos de destaque. Aceita qualquer cor HEX.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Exemplos de uso:'}</span>{'\n'}<span style={{color:'#60a5fa'}}>#6366f1</span>{' → '}<span style={{color:'#94a3b8'}}>Índigo (padrão da plataforma){'\n'}</span><span style={{color:'#4ade80'}}>#10b981</span>{' → '}<span style={{color:'#94a3b8'}}>Verde (saúde, sustentabilidade){'\n'}</span><span style={{color:'#f87171'}}>#ef4444</span>{' → '}<span style={{color:'#94a3b8'}}>Vermelho (urgência, energia)</span></>,
                                              tip: 'Use a cor principal da marca da empresa que vai usar o chat. O Preview ao lado atualiza em tempo real.' },
                                            { icon: '🖥️', title: 'Cor do Cabeçalho', accent: '#c084fc',
                                              desc: <>A cor de fundo da <strong style={{color:'#e2e8f0'}}>barra superior do chat</strong>, onde aparece o nome e o indicador de status online.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Combinações recomendadas:'}</span>{'\n'}<span style={{color:'#94a3b8'}}>Cabeçalho escuro </span><span style={{color:'#60a5fa'}}>#0f172a</span>{' + Primária '}<span style={{color:'#a78bfa'}}>#8b5cf6</span>{'\n'}<span style={{color:'#94a3b8'}}>Cabeçalho na cor da marca </span><span style={{color:'#4ade80'}}>#1a7a50</span>{' + Primária '}<span style={{color:'#4ade80'}}>#10b981</span></>,
                                              tip: 'Para um visual mais sóbrio, use tons escuros (#0f172a, #1e293b). Para seguir o branding, use a mesma cor ou um tom mais escuro da Cor Primária.' },
                                            { icon: '💬', title: 'Nome do Chat (Título)', accent: '#60a5fa',
                                              desc: <>O nome exibido no <strong style={{color:'#e2e8f0'}}>cabeçalho do widget</strong> para os usuários finais. Deve refletir a identidade do assistente ou da empresa.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Exemplos:'}</span>{'\n'}<span style={{color:'#60a5fa'}}>Suporte Inteligente</span>{' → '}<span style={{color:'#94a3b8'}}>Genérico, funciona bem{'\n'}</span><span style={{color:'#60a5fa'}}>Atendimento VetManager</span>{' → '}<span style={{color:'#94a3b8'}}>Com o nome da marca{'\n'}</span><span style={{color:'#60a5fa'}}>Sofia - Consultora IA</span>{' → '}<span style={{color:'#94a3b8'}}>Humanizado com nome próprio</span></>,
                                              tip: 'Nomes humanizados (com nome próprio) aumentam a taxa de engajamento dos usuários.' },
                                            { icon: '👋', title: 'Mensagem de Boas-vindas', accent: '#fbbf24',
                                              desc: <>Aparece automaticamente como <strong style={{color:'#e2e8f0'}}>primeiro balão do agente</strong> quando o usuário abre o chat. Define o tom e orienta a conversa.</>,
                                              code: <><span style={{color:'#475569'}}>{'// Exemplo genérico:'}</span>{'\n'}<span style={{color:'#fbbf24'}}>{"\"Olá! Como posso te ajudar hoje?\""}{'\n\n'}</span><span style={{color:'#475569'}}>{'// Exemplo específico e direcionado:'}</span>{'\n'}<span style={{color:'#fbbf24'}}>{"\"Oi! Sou a Sofia 👋 Posso te ajudar com dúvidas sobre pedidos, entregas e trocas. O que você precisa?\""}</span></>,
                                              tip: 'Mensagens específicas com opções claras reduzem o tempo de primeira resposta e aumentam a satisfação do usuário.' },
                                            { icon: '🔧', title: 'Código de Instalação (Snippet)', accent: '#34d399',
                                              desc: <>O trecho de código <strong style={{color:'#e2e8f0'}}>HTML pronto</strong> que deve ser colado no site do cliente para ativar o chat widget. Atualiza automaticamente com todas as configurações.</>,
                                              code: <><span style={{color:'#f87171'}}>{'<script'}{'\n'}</span><span style={{color:'#94a3b8'}}>{'  src="...widget.js"'}{'\n'}</span><span style={{color:'#34d399'}}>{'  data-agent-id="123"'}{'\n'}</span><span style={{color:'#fbbf24'}}>{'  data-primary-color="#6366f1"'}{'\n'}</span><span style={{color:'#60a5fa'}}>{'  data-title="Suporte"'}{'\n'}</span><span style={{color:'#f87171'}}>{'></script>'}</span></>,
                                              tip: 'Cole o código antes da tag </body> do HTML do site. Funciona em qualquer plataforma: WordPress, Webflow, HTML puro, etc.' },
                                            { icon: '👁️', title: 'Preview em Tempo Real', accent: '#a78bfa',
                                              desc: <>Simulação visual do chat widget com <strong style={{color:'#e2e8f0'}}>todas as configurações aplicadas</strong>. Atualiza instantaneamente ao mudar cores, título ou mensagem de boas-vindas.</>,
                                              code: <><span style={{color:'#475569'}}>{'// O preview mostra:'}</span>{'\n'}<span style={{color:'#a78bfa'}}>Cabeçalho</span>{' → '}<span style={{color:'#94a3b8'}}>Cor do cabeçalho + título + status online{'\n'}</span><span style={{color:'#a78bfa'}}>Balão do agente</span>{' → '}<span style={{color:'#94a3b8'}}>Mensagem de boas-vindas{'\n'}</span><span style={{color:'#a78bfa'}}>Balão do usuário</span>{' → '}<span style={{color:'#94a3b8'}}>Cor primária aplicada{'\n'}</span><span style={{color:'#a78bfa'}}>Botão de envio</span>{' → '}<span style={{color:'#94a3b8'}}>Ícone com cor primária</span></>,
                                              tip: 'Use o preview para validar o visual antes de instalar no site. Ideal para mostrar ao cliente como ficará antes de publicar.' },
                                        ].map((item, i) => (
                                            <div key={i} style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderLeft: `3px solid ${item.accent}`,
                                                borderRadius: '12px', padding: '1.1rem 1.3rem',
                                                transition: 'border-color 0.2s',
                                            }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                                                    {item.icon} {item.title}
                                                </div>
                                                <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{item.desc}</p>
                                                <pre style={{
                                                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                                    padding: '9px 13px', fontSize: '0.77rem', lineHeight: 1.7,
                                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                    margin: '0 0 0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                }}>{item.code}</pre>
                                                <div style={{
                                                    background: 'rgba(236,72,153,0.06)',
                                                    border: '1px solid rgba(236,72,153,0.1)',
                                                    borderRadius: '8px', padding: '8px 11px',
                                                    fontSize: '0.79rem', color: '#94a3b8', lineHeight: 1.55,
                                                }}>
                                                    <strong style={{ color: item.accent }}>Dica: </strong>{item.tip}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-section">
                            <span className="section-label">Personalização do Chat Widget</span>
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label>Cor Primária (Botão e Balões)</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={uiPrimaryColor}
                                            onChange={(e) => setUiPrimaryColor(e.target.value)}
                                            style={{ width: '50px', height: '50px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                        />
                                        <input
                                            type="text"
                                            value={uiPrimaryColor}
                                            onChange={(e) => setUiPrimaryColor(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label>Cor do Cabeçalho</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={uiHeaderColor}
                                            onChange={(e) => setUiHeaderColor(e.target.value)}
                                            style={{ width: '50px', height: '50px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                        />
                                        <input
                                            type="text"
                                            value={uiHeaderColor}
                                            onChange={(e) => setUiHeaderColor(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Nome do Chat (Título)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: IA do SalesForce"
                                    value={uiChatTitle}
                                    onChange={(e) => setUiChatTitle(e.target.value)}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                    Este nome aparecerá no cabeçalho do chat.
                                </p>
                            </div>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Mensagem de Boas-vindas</label>
                                <textarea
                                    placeholder="Ex: Olá! Como posso te ajudar hoje?"
                                    value={uiWelcomeMessage}
                                    onChange={(e) => setUiWelcomeMessage(e.target.value)}
                                    style={{ minHeight: '80px' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                    Esta mensagem aparecerá automaticamente quando o usuário abrir o chat.
                                </p>
                            </div>
                        </div>

                        <div className="form-section">
                            <span className="section-label">Código de Instalação</span>
                            <div className="form-group">
                                <label>Snippet para o seu Site</label>
                                <div style={{ position: 'relative' }}>
                                    <pre style={{
                                        background: '#0f172a',
                                        padding: '1.5rem',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        overflowX: 'auto',
                                        color: '#cbd5e1',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {`<script 
  src="${API_URL}/static/widget.js" 
  data-agent-id="${id}"
  data-title="${uiChatTitle}"
  data-primary-color="${uiPrimaryColor}"
  data-header-color="${uiHeaderColor}"
  data-welcome="${uiWelcomeMessage}"
></script>`}
                                    </pre>
                                    <button
                                        onClick={() => {
                                            const code = `<script \n  src="${API_URL}/static/widget.js" \n  data-agent-id="${id}"\n  data-title="${uiChatTitle}"\n  data-primary-color="${uiPrimaryColor}"\n  data-header-color="${uiHeaderColor}"\n  data-welcome="${uiWelcomeMessage}"\n></script>`;
                                            navigator.clipboard.writeText(code);
                                            alert('Código copiado para a área de transferência!');
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            padding: '5px 10px',
                                            fontSize: '0.7rem',
                                            background: 'rgba(99, 102, 241, 0.2)',
                                            color: '#818cf8',
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📋 Copiar Código
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px' }}>
                                    Copie e cole este código antes da tag <code>&lt;/body&gt;</code> do seu site para ativar o chat.
                                </p>
                            </div>
                        </div>

                        <div className="form-section">
                            <span className="section-label">Preview em Tempo Real</span>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                padding: '2rem',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255,255,255,0.1)'
                            }}>
                                {/* Mini Chat Mockup */}
                                <div style={{
                                    width: '320px',
                                    height: '450px',
                                    background: '#0f172a',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        background: uiHeaderColor,
                                        padding: '1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
                                        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{uiChatTitle}</span>
                                    </div>

                                    {/* Messages Area */}
                                    <div style={{ flex: 1, padding: '1.2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {uiWelcomeMessage && (
                                            <div style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                padding: '0.8rem 1rem',
                                                borderRadius: '12px 12px 12px 0',
                                                color: '#cbd5e1',
                                                fontSize: '0.85rem',
                                                maxWidth: '85%',
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                {uiWelcomeMessage}
                                            </div>
                                        )}
                                        <div style={{
                                            background: uiPrimaryColor,
                                            padding: '0.8rem 1rem',
                                            borderRadius: '12px 12px 0 12px',
                                            color: 'white',
                                            fontSize: '0.85rem',
                                            maxWidth: '85%',
                                            alignSelf: 'flex-end',
                                            boxShadow: `0 4px 12px ${uiPrimaryColor}44`
                                        }}>
                                            Mensagem do usuário exemplo...
                                        </div>
                                    </div>

                                    {/* Input Area */}
                                    <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
                                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.6rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            Digite sua dúvida...
                                        </div>
                                        <div style={{ width: '35px', height: '35px', background: uiPrimaryColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* TAB: VERSÕES DO PROMPT */}
                {activeTab === 'versoes' && (
                    <div className="fade-in">
                        <PromptVersions
                            agentId={id}
                            onRestore={(text) => {
                                setSystemPrompt(text);
                                setActiveTab('prompts');
                            }}
                        />
                    </div>
                )}
            </div>

            {activeTab !== 'historico' && activeTab !== 'versoes' && (
                <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                    {validationErrors.length > 0 && (
                        <div style={{
                            marginBottom: '1rem', padding: '12px 16px', borderRadius: '10px',
                            background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)',
                            display: 'flex', flexDirection: 'column', gap: '6px'
                        }}>
                            <span style={{ fontWeight: 700, color: '#f43f5e', fontSize: '0.85rem' }}>⚠️ Para {isNew ? 'criar o agente' : 'salvar'}, corrija:</span>
                            {validationErrors.includes('nome') && (
                                <span style={{ fontSize: '0.8rem', color: '#fda4af' }}>
                                    • O agente precisa ter um <strong>nome</strong> — vá até a aba <strong>Geral</strong> e preencha o campo Nome.
                                </span>
                            )}
                            {validationErrors.includes('modelo') && !routerEnabled && (
                                <span style={{ fontSize: '0.8rem', color: '#fda4af' }}>
                                    • Selecione um <strong>Modelo Principal</strong> — vá até a aba <strong>Geral</strong> na seção Inteligência & Modelo.
                                </span>
                            )}
                            {validationErrors.includes('modelo') && routerEnabled && (
                                <span style={{ fontSize: '0.8rem', color: '#fda4af' }}>
                                    • O Roteamento está ativo mas falta configurar os modelos <strong>Simples</strong> e <strong>Complexo</strong> — vá até a aba <strong>Geral</strong>.
                                </span>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={handleSave} className="save-button" style={{ padding: '1rem 3rem' }}>
                            {isNew ? '✨ Criar Agente' : '💾 Salvar Alterações'}
                        </button>
                    </div>
                </div>
            )}

            {status && (
                <div className={`status-message ${status.includes('Erro') ? 'error' : 'success'}`}>
                    {status.includes('Sucesso') ? '✅' : '⏳'} {status}
                </div>
            )}

            <style>{`
                .tab-navigation {
                    display: flex;
                    gap: 1.5rem;
                    border-bottom: 2px solid var(--border-color);
                    margin-top: 1rem;
                }
                .tab-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    padding: 1rem 0.5rem;
                    font-size: 0.9rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s;
                    position: relative;
                }
                .tab-btn.active {
                    color: var(--accent-color);
                }
                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    background: var(--accent-gradient);
                }
                .fade-in {
                    animation: fadeIn 0.4s ease-out;
                }
                .tool-chip {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: white;
                    font-size: 0.85rem;
                }
                .tool-chip button {
                    background: transparent;
                    border: none;
                    color: #ef4444;
                    cursor: pointer;
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                }

                .saving-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(2, 6, 23, 0.85);
                    backdrop-filter: blur(12px);
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }

                .saving-card {
                    background: #161d2f;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 3rem;
                    border-radius: 28px;
                    text-align: center;
                    max-width: 450px;
                    width: 100%;
                    box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.6);
                    animation: savingPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                @keyframes savingPop {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                .saving-spinner-wrapper {
                    position: relative;
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 2rem;
                }

                .saving-spinner {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: 4px solid rgba(99, 102, 241, 0.1);
                    border-top: 4px solid #6366f1;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .saving-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 2rem;
                }

                .saving-card h3 {
                    color: white;
                    font-size: 1.5rem;
                    margin-bottom: 1rem;
                    font-weight: 800;
                }

                .saving-card p {
                    color: #94a3b8;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                }

                .saving-progress-bar {
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .saving-progress-fill {
                    height: 100%;
                    width: 40%;
                    background: linear-gradient(90deg, #6366f1, #a855f7);
                    border-radius: 10px;
                    animation: loadingProgress 2s infinite ease-in-out;
                }

                @keyframes loadingProgress {
                    0% { transform: translateX(-100%); width: 30%; }
                    50% { width: 60%; }
                    100% { transform: translateX(250%); width: 30%; }
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .complexity-selector {
                    display: flex;
                    gap: 12px;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 8px;
                    border-radius: 20px;
                    border: 1px solid var(--border-color);
                }

                .toggle-option {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 1.25rem 0.75rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 16px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    font-family: inherit;
                }

                .toggle-option:hover {
                    background: rgba(255, 255, 255, 0.03);
                    color: white;
                    transform: translateY(-2px);
                }

                .toggle-option.active {
                    background: var(--accent-gradient);
                    color: white;
                    font-weight: 700;
                    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
                    border-color: rgba(255, 255, 255, 0.1);
                }

                .toggle-icon {
                    font-size: 1.5rem;
                    transition: transform 0.3s;
                }

                .toggle-option.active .toggle-icon {
                    transform: scale(1.2);
                }

                .toggle-label {
                    font-size: 0.85rem;
                    letter-spacing: 0.5px;
                }
            `}</style>
        </div >
    );
};

export default ConfigPanel;
