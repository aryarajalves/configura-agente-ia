import React, { useState, useRef, useEffect } from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import { api } from '../api/client';
import ExpandableField from './ExpandableField';
import KnowledgeBaseImporter from './KnowledgeBaseImporter';
import ConfirmModal from './ConfirmModal';

/**
 * KnowledgeBaseManager Component
 * 
 * UI Refactor (2026-04-27):
 * - Simplified Quick Actions bar to 4 primary buttons.
 * - Secondary import options (Paste, CSV, PDF) moved to AddDocumentsModal.
 * - Manual Q&A entry form moved to AddNewEntryModal for better list visibility.
 * - Uses React portals for consistent z-index and accessibility.
 */
const KnowledgeBaseManager = ({ knowledgeBase = [], onChange, onAdd, onDelete, onUpdate, collapsible = true, kbType = 'qa', kbId }) => {
    const [isExpanded, setIsExpanded] = useState(!collapsible);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 100;
    const [newPair, setNewPair] = useState({ question: '', answer: '', metadata_val: '', category: 'Geral' });
    const [showImporter, setShowImporter] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isTextModalOpen, setIsTextModalOpen] = useState(false);
    const [tempText, setTempText] = useState('');
    const [pendingText, setPendingText] = useState('');
    const [pendingUrl, setPendingUrl] = useState('');
    const [sourceView, setSourceView] = useState(null);
    const [editedItems, setEditedItems] = useState({});
    const [maximizedItem, setMaximizedItem] = useState(null);
    const [kbFilterTerm, setKbFilterTerm] = useState('');
    const [duplicateGroups, setDuplicateGroups] = useState(null);
    const [scanningDuplicates, setScanningDuplicates] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [scanMode, setScanMode] = useState('exact'); // 'exact' ou 'semantic'
    const [proposedMerge, setProposedMerge] = useState(null); // { question, answer, original_ids }
    const [mergingLoading, setMergingLoading] = useState(false);
    const [kbLabels, setKbLabels] = useState({ question: 'Pergunta', answer: 'Resposta', metadata: 'Metadado' });
    const [isSavingLabels, setIsSavingLabels] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionResult, setTranscriptionResult] = useState('');
    const [transcriptionMetrics, setTranscriptionMetrics] = useState({ duration: 0, tokens: 0, cost_usd: 0 });
    const [showTranscriptionPopup, setShowTranscriptionPopup] = useState(false);
    const [showConfigPopup, setShowConfigPopup] = useState(false);
    const [showRagConfigPopup, setShowRagConfigPopup] = useState(false);
    const [selectedVideoFile, setSelectedVideoFile] = useState(null);
    const [showMediaSelectionModal, setShowMediaSelectionModal] = useState(false);
    const [selectedMediaType, setSelectedMediaType] = useState('media');
    const textMediaInputRef = useRef(null);
    const [transcriptionProgress, setTranscriptionProgress] = useState(0);
    const [transcriptionConfig, setTranscriptionConfig] = useState({
        autoLanguage: true,
        language: 'pt',
        speakerLabels: false,
        profanityFilter: false,
        summarization: false
    });
    const [ragConfig, setRagConfig] = useState({
        extractQA: true,
        extractChunks: false,
        generateSummary: false,
        chunkSize: 1500,
        chunkOverlap: 150
    });

    // Estados para Upload JSON em lote
    const [isJsonBatchModalOpen, setIsJsonBatchModalOpen] = useState(false);
    const [jsonBatchInput, setJsonBatchInput] = useState('');
    const [jsonParsedData, setJsonParsedData] = useState(null);
    const [showJsonConfirmModal, setShowJsonConfirmModal] = useState(false);
    const [isGlobalConfigEnabled, setIsGlobalConfigEnabled] = useState(false);
    const [isProcessingJsonBatch, setIsProcessingJsonBatch] = useState(false);
    const [isUploadMode, setIsUploadMode] = useState(false); // false = texto, true = arquivo

    // Lista de metadados
    const [metadata, setMetadata] = useState([{ name: '', content: '' }]);
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isCreatingRag, setIsCreatingRag] = useState(false);
    const [showMaximizedTranscription, setShowMaximizedTranscription] = useState(false);
    const [transcriptionFilename, setTranscriptionFilename] = useState('');
    const [isTextOptionsOpen, setIsTextOptionsOpen] = useState(false);
    const [textForProcessing, setTextForProcessing] = useState('');
    const [isAddDocsModalOpen, setIsAddDocsModalOpen] = useState(false);
    const [isAddNewModalOpen, setIsAddNewModalOpen] = useState(false);

    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [bulkEditForm, setBulkEditForm] = useState({
        question: '',
        answer: '',
        metadata_val: '',
        category: '',
        useQuestion: false,
        useAnswer: false,
        useMetadata: false,
        useCategory: false
    });

    // Estados para Edição e Navegação no Modal Maximizado
    const [isEditingMaximized, setIsEditingMaximized] = useState(false);
    const [maximizedForm, setMaximizedForm] = useState(null);
    const [isSavingMaximized, setIsSavingMaximized] = useState(false);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [showJsonView, setShowJsonView] = useState(false);
    const [metadataEditorItems, setMetadataEditorItems] = useState([]);

    const [isBulkSummarizeOpen, setIsBulkSummarizeOpen] = useState(false);
    const [bulkSummarizeForm, setBulkSummarizeForm] = useState({
        question: '',
        metadata_val: '',
        category: 'Resumo'
    });
    const [isSummarizing, setIsSummarizing] = useState(false);

    const videoInputRef = useRef(null);

    // Simulator states
    const [simQuery, setSimQuery] = useState('');
    const [simResults, setSimResults] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [simConfig, setSimConfig] = useState({
        threshold: 0.7,
        limit: 5,
        multiQuery: false,
        rerank: true,
        agenticEval: true,
        parentExpansion: true
    });

    const handleJsonBatchSubmit = async () => {
        try {
            const parsed = JSON.parse(jsonBatchInput);
            if (!parsed.data || !Array.isArray(parsed.data)) {
                alert("O JSON deve conter uma chave 'data' com um array de itens.");
                return;
            }
            setJsonParsedData(parsed.data);
            setIsJsonBatchModalOpen(false);
            setShowJsonConfirmModal(true);
        } catch (e) {
            alert("JSON inválido: " + e.message);
        }
    };

    const handleJsonFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setJsonBatchInput(event.target.result);
        };
        reader.readAsText(file);
    };

    const handleConfirmJsonBatch = async () => {
        setIsProcessingJsonBatch(true);
        try {
            await api.post(`/knowledge-bases/${kbId}/process-json-batch`, {
                data: jsonParsedData,
                global_config: isGlobalConfigEnabled ? ragConfig : {}
            });
            setShowJsonConfirmModal(false);
            setShowSuccessModal(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao processar: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsProcessingJsonBatch(false);
        }
    };

    // Data processing and Filtering
    const safeKb = Array.isArray(knowledgeBase) ? knowledgeBase : [];
    const filteredItems = safeKb
        .map((item, index) => (item ? { ...item, originalIndex: index } : null))
        .filter(item => !!item)
        .filter(item => {
            if (!kbFilterTerm.trim()) return true;
            const t = kbFilterTerm.toLowerCase();
            return (
                (item?.question || '').toLowerCase().includes(t) ||
                (item?.answer || '').toLowerCase().includes(t) ||
                (item?.category || '').toLowerCase().includes(t) ||
                (item?.metadata_val || '').toLowerCase().includes(t)
            );
        });

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const hasItems = filteredItems.length > 0;

    // Navigation and Update Handlers for Maximized Modal
    const handlePrevItem = () => {
        if (!maximizedItem) return;
        const currentIndex = filteredItems.findIndex(i => i.id === maximizedItem.id);
        if (currentIndex > 0) {
            const prevItem = filteredItems[currentIndex - 1];
            setMaximizedItem({ ...prevItem });
            setIsEditingMaximized(false);
            setMaximizedForm(null);
        }
    };

    const handleNextItem = () => {
        if (!maximizedItem) return;
        const currentIndex = filteredItems.findIndex(i => i.id === maximizedItem.id);
        if (currentIndex < filteredItems.length - 1) {
            const nextItem = filteredItems[currentIndex + 1];
            setMaximizedItem({ ...nextItem });
            setIsEditingMaximized(false);
            setMaximizedForm(null);
        }
    };

    const handleUpdateMaximized = async () => {
        if (!maximizedForm || !maximizedItem) return;
        setIsSavingMaximized(true);
        try {
            // Normalização dos metadados: converte o array do editor em um objeto JSON
            const metadataObj = {};
            metadataEditorItems.forEach(item => {
                if (item.key.trim()) {
                    metadataObj[item.key.trim()] = item.value;
                }
            });

            const finalPayload = {
                ...maximizedForm,
                metadata_val: JSON.stringify(metadataObj)
            };

            const response = await api.put(`/knowledge-items/${maximizedItem.id}`, finalPayload);
            if (response) {
                if (onUpdate) {
                    await onUpdate(maximizedItem.id, finalPayload);
                }
                setMaximizedItem({ ...finalPayload, id: maximizedItem.id });
                setIsEditingMaximized(false);
                setMaximizedForm(null);
                setShowSuccessModal(true);
            }
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            alert('Falha ao atualizar o item. Por favor, tente novamente.');
        } finally {
            setIsSavingMaximized(false);
        }
    };

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
        if (maximizedItem || sourceView || duplicateGroups || showMaximizedTranscription || isTranscribing || isCreatingRag || showTranscriptionPopup || showRagConfigPopup || showSuccessModal || isBulkEditOpen || isBulkSummarizeOpen || isTextOptionsOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [maximizedItem, sourceView, duplicateGroups, showMaximizedTranscription, isTranscribing, isCreatingRag, showTranscriptionPopup, showRagConfigPopup, showSuccessModal, isBulkEditOpen, isBulkSummarizeOpen, isTextOptionsOpen]);

    // Listener para navegação via teclado no modal maximizado
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!maximizedItem || isEditingMaximized) return;

            if (e.key === 'ArrowLeft') {
                handlePrevItem();
            } else if (e.key === 'ArrowRight') {
                handleNextItem();
            } else if (e.key === 'Escape') {
                setMaximizedItem(null);
                setIsEditingMaximized(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [maximizedItem, isEditingMaximized, filteredItems]);

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(i => i.id)));
        }
    };

    const handleSimulate = async () => {
        if (!simQuery.trim() || !kbId) return;
        setSimLoading(true);
        setSimResults(null);
        try {
            const response = await api.post(`/knowledge-bases/${kbId}/simulate-rag`, {
                query: simQuery,
                translation_enabled: simConfig.translation,
                multi_query_enabled: simConfig.multiQuery,
                rerank_enabled: simConfig.rerank,
                agentic_eval_enabled: simConfig.agenticEval,
                parent_expansion_enabled: simConfig.parentExpansion,
                limit: 5
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                setSimResults({ error: err.detail || `Erro HTTP ${response.status}` });
                return;
            }
            const data = await response.json();
            setSimResults(data);
        } catch (e) {
            console.error(e);
            setSimResults({ error: "Erro ao testar a base." });
        } finally {
            setSimLoading(false);
        }
    };

    const scanDuplicates = async (mode = scanMode) => {
        if (!kbId) return;
        setScanningDuplicates(true);
        try {
            const isSemantic = mode === 'semantic';
            const res = await api.get(`/knowledge-bases/${kbId}/duplicates?semantic=${isSemantic}`);
            if (res.ok) {
                const data = await res.json();
                setDuplicateGroups(data.duplicates || []);
            } else {
                const errData = await res.json();
                alert(`Erro ao varrer duplicados: ${errData.detail || 'Falha desconhecida'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão ao buscar duplicados.");
        } finally {
            setScanningDuplicates(false);
        }
    };

    const handleProposeMerge = async (ids) => {
        setMergingLoading(true);
        try {
            const res = await api.post(`/knowledge-bases/${kbId}/propose-merge`, { item_ids: ids });
            if (res.ok) {
                const data = await res.json();
                setProposedMerge({ ...data.proposed, original_ids: ids });
            } else {
                alert("Erro ao gerar proposta de mesclagem.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setMergingLoading(false);
        }
    };

    const handleUpdateLabels = async () => {
        if (!kbId) return;
        setIsSavingLabels(true);
        try {
            const res = await api.put(`/knowledge-bases/${kbId}`, {
                question_label: kbLabels.question,
                answer_label: kbLabels.answer,
                metadata_label: kbLabels.metadata
            });
            if (res.ok) {
                alert("Rótulos atualizados com sucesso!");
            } else {
                alert("Erro ao salvar rótulos.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão ao salvar rótulos.");
        } finally {
            setIsSavingLabels(false);
        }
    };

    const handleSaveMerge = async () => {
        if (!proposedMerge || !kbId) return;
        setMergingLoading(true);
        try {
            // 1. Cria o novo item mesclado
            const addRes = await api.post(`/knowledge-bases/${kbId}/items`, proposedMerge);

            if (addRes.ok) {
                // 2. Deleta os originais
                await api.delete(`/knowledge-bases/${kbId}/items/batch-delete`, { item_ids: proposedMerge.original_ids });

                // 3. Atualiza UI
                setProposedMerge(null);
                scanDuplicates(); // Re-scaneia para tirar o grupo resolvido
            } else {
                alert("Erro ao salvar item mesclado.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setMergingLoading(false);
        }
    };

    const handleBulkDelete = () => {
        if (!selectedItems.size) return;
        setIsConfirmOpen(true);
    };

    const confirmBulkDelete = async () => {
        const idsToDelete = Array.from(selectedItems);
        setIsDeleting(true);

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const currentKbId = kbId || pathParts[pathParts.length - 1];

        try {
            const response = await api.delete(`/knowledge-bases/${currentKbId}/items/batch-delete`, {
                item_ids: idsToDelete
            });
            if (response.ok) {
                window.location.reload();
                return;
            } else {
                const err = await response.json();
                alert(`Erro ao excluir: ${err.detail || 'Falha desconhecida'}`);
            }
        } catch (e) {
            console.error("Bulk delete failed", e);
            alert("Erro de conexão ao excluir");
        } finally {
            setIsDeleting(false);
            setIsConfirmOpen(false);
            setSelectedItems(new Set());
        }

        // Fallback for local deletion if API fails or isn't used (unlikely with kbId)
        if (!kbId) {
            for (const id of idsToDelete) {
                if (onDelete) onDelete(id);
            }
        }
    };

    const handleBulkUpdate = async () => {
        if (!selectedItems.size || !kbId) return;
        setIsBulkUpdating(true);

        const updatePayload = {
            item_ids: Array.from(selectedItems)
        };

        if (bulkEditForm.useQuestion) updatePayload.question = bulkEditForm.question;
        if (bulkEditForm.useAnswer) updatePayload.answer = bulkEditForm.answer;
        if (bulkEditForm.useMetadata) updatePayload.metadata_val = bulkEditForm.metadata_val;
        if (bulkEditForm.useCategory) updatePayload.category = bulkEditForm.category;

        try {
            const res = await api.put(`/knowledge-bases/${kbId}/items/batch-update`, updatePayload);
            if (res.ok) {
                setIsBulkEditOpen(false);
                setSelectedItems(new Set());
                window.location.reload();
            } else {
                const err = await res.json();
                alert(`Erro ao atualizar itens: ${err.detail || 'Falha desconhecida'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão ao atualizar itens.");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkSummarize = async () => {
        if (!selectedItems.size || !kbId) return;
        if (!bulkSummarizeForm.question.trim()) {
            alert("Por favor, defina a pergunta do resumo.");
            return;
        }
        setIsSummarizing(true);
        try {
            const res = await api.post(`/knowledge-bases/${kbId}/items/bulk-summarize`, {
                item_ids: Array.from(selectedItems),
                question: bulkSummarizeForm.question,
                metadata_val: bulkSummarizeForm.metadata_val,
                category: bulkSummarizeForm.category
            });
            if (res.ok) {
                setIsBulkSummarizeOpen(false);
                setSelectedItems(new Set());
                setShowSuccessModal(true);
            } else {
                const err = await res.json();
                alert(`Erro ao gerar resumo: ${err.detail || 'Falha desconhecida'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão ao gerar resumo.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const fileInputRef = useRef(null);

    const handleAddItem = () => {
        if (!newPair.question.trim() || !newPair.answer.trim()) return;
        if (onAdd) {
            onAdd(newPair.question, newPair.answer, newPair.category, newPair.metadata_val);
        } else if (onChange) {
            const currentKb = Array.isArray(knowledgeBase) ? knowledgeBase : [];
            const updated = [...currentKb, newPair];
            onChange(updated);
        }
        setNewPair({ question: '', answer: '', metadata_val: '', category: 'Geral' });
    };

    const handleDeleteItem = (indexToDelete, itemId) => {
        setItemToDelete({ index: indexToDelete, id: itemId });
        setIsConfirmOpen(true);
    };

    const confirmDeletion = async () => {
        if (selectedItems.size > 0) {
            confirmBulkDelete();
            return;
        }

        if (!itemToDelete) return;
        setIsDeleting(true);

        try {
            if (onDelete && itemToDelete.id) {
                await onDelete(itemToDelete.id);
            } else if (onChange) {
                const updated = knowledgeBase.filter((_, i) => i !== itemToDelete.index);
                onChange(updated);
            }
        } catch (e) {
            console.error("Delete failed", e);
            alert("Erro ao excluir item");
        } finally {
            setIsDeleting(false);
            setIsConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const handleUpdateItem = (index, itemId, field, value) => {
        if (onUpdate && itemId) {
            const current = knowledgeBase[index];
            if (field === 'all') {
                onUpdate(itemId, value.question, value.answer, value.category);
            } else {
                onUpdate(
                    itemId,
                    field === 'question' ? value : current.question,
                    field === 'answer' ? value : current.answer,
                    field === 'category' ? value : current.category,
                    field === 'metadata_val' ? value : current.metadata_val
                );
            }
        } else if (onChange) {
            const updated = [...knowledgeBase];
            if (field === 'all') {
                updated[index] = { ...updated[index], ...value };
            } else {
                updated[index] = { ...updated[index], [field]: value };
            }
            onChange(updated);
        }
    };

    const handleItemContentChange = (itemId, originalItem, newContent) => {
        let q = '';
        let a = '';

        if (newContent.includes('\n\n')) {
            const parts = newContent.split('\n\n');
            q = parts[0]?.trim() || '';
            a = parts.slice(1).join('\n\n')?.trim() || '';
        } else {
            const lines = newContent.split('\n');
            q = lines[0]?.trim() || '';
            a = lines.slice(1).join('\n')?.trim() || '';
        }

        setEditedItems(prev => ({
            ...prev,
            [itemId]: { ...(prev[itemId] || originalItem), question: q, answer: a }
        }));
    };

    const saveItemEdits = (index, itemId) => {
        const edits = editedItems[itemId];
        if (edits) {
            handleUpdateItem(index, itemId, 'all', edits);
            setEditedItems(prev => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
        }
    };

    const handlePasteText = () => {
        setIsTextModalOpen(true);
    };

    const confirmTextImport = () => {
        if (!tempText) return;
        setTextForProcessing(tempText);
        setIsTextModalOpen(false);
        setTempText('');
        setIsTextOptionsOpen(true);
    };
    const handleVideoTranscribe = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedVideoFile(file);
        setSelectedMediaType('media');
        setShowRagConfigPopup(true);
        setShowMediaSelectionModal(false);
        e.target.value = '';
    };

    const handleTextMediaTranscribe = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedVideoFile(file);
        setSelectedMediaType('text');
        setShowRagConfigPopup(true);
        setShowMediaSelectionModal(false);
        e.target.value = '';
    };

    const handleMetadataChange = (index, field, value) => {
        const newMetadata = [...metadata];
        newMetadata[index][field] = value;
        setMetadata(newMetadata);
    };

    const addMetadataRow = () => {
        setMetadata([...metadata, { name: '', content: '' }]);
    };

    const removeMetadataRow = (index) => {
        const newMetadata = [...metadata];
        newMetadata.splice(index, 1);
        setMetadata(newMetadata);
    };

    const handleJsonMerge = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (!parsed.metadata || typeof parsed.metadata !== 'object') {
                alert('O JSON deve conter um objeto "metadata". Ex: { "metadata": { "chave": "valor" } }');
                return;
            }

            const currentMap = new Map();
            metadata.forEach(item => {
                if (item.name) currentMap.set(item.name, item.content);
            });

            // Sobrescreve ou adiciona
            Object.entries(parsed.metadata).forEach(([k, v]) => {
                currentMap.set(k, String(v));
            });

            // Reconstrói a lista
            const updatedMetadata = [];
            currentMap.forEach((val, key) => {
                updatedMetadata.push({ name: key, content: val });
            });

            if (updatedMetadata.length === 0) {
                updatedMetadata.push({ name: '', content: '' });
            }

            setMetadata(updatedMetadata);
            setIsJsonModalOpen(false);
            setJsonInput('');
        } catch (e) {
            alert('JSON inválido');
        }
    };

    const handleConfirmTranscription = async (fileToUse = null) => {
        // Obsoleto - foi substituído pelo processamento em background após configuração de RAG
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = '';
        setPendingFile(file);
        setPendingUrl('');
        setPendingText('');
        setShowImporter(true);
    };


    const handleCreateRag = async () => {
        if (!selectedVideoFile) return;
        setIsCreatingRag(true);
        try {
            // Formata metadados para objeto
            const formattedMetadata = {};
            metadata.forEach(item => {
                if (item.name.trim()) {
                    formattedMetadata[item.name.trim()] = item.content;
                }
            });
            const finalRagConfig = {
                ...ragConfig,
                metadata: formattedMetadata
            };

            const formData = new FormData();
            formData.append('file', selectedVideoFile);
            formData.append('config', JSON.stringify(finalRagConfig));
            formData.append('is_media', selectedMediaType === 'media' ? 'true' : 'false');

            const response = await api.post(`/knowledge-bases/${kbId}/video-background`, formData);

            if (response.ok) {
                setShowRagConfigPopup(false);
                setShowSuccessModal(true);
            } else {
                const err = await response.json().catch(() => ({}));
                alert(`Erro ao criar RAG: ${err.detail || 'Falha no processamento'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Erro na comunicação com o servidor.");
        } finally {
            setIsCreatingRag(false);
            setSelectedVideoFile(null);
        }
    };

    const handleCreateRagFromText = async () => {
        setIsCreatingRag(true);
        try {
            const response = await api.post(`/knowledge-bases/${kbId}/process-transcription`, {
                text: textForProcessing,
                config: ragConfig
            });
            if (response.ok) {
                setIsTextOptionsOpen(false);
                setTextForProcessing('');
                setShowSuccessModal(true);
            } else {
                const err = await response.json().catch(() => ({}));
                alert(`Erro ao processar texto: ${err.detail || 'Falha no processamento'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Erro na comunicação com o servidor.");
        } finally {
            setIsCreatingRag(false);
        }
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                setPendingFile(file);
                setPendingUrl('');
                setPendingText('');
                setShowImporter(true);
            }
        };
        input.click();
    };

    if (showImporter) {
        return (
            <KnowledgeBaseImporter
                initialFile={pendingFile}
                initialUrl={pendingUrl}
                initialText={pendingText}
                kbType={kbType}
                kbId={kbId}
                onCancel={(payload) => {
                    setShowImporter(false);
                    setPendingFile(null);
                    setPendingUrl('');
                    setPendingText('');
                    if (payload && payload.backToText) {
                        setTempText(payload.text);
                        setIsTextModalOpen(true);
                    }
                }}
                onComplete={() => { setShowImporter(false); setPendingFile(null); setPendingUrl(''); setPendingText(''); window.location.reload(); }}
            />
        );
    }

    return (
        <div className="kb-manager">
            <div
                className="kb-header fade-in"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '1rem',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        {kbType === 'product' ? '📦' : '📚'}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            {kbType === 'product' ? 'Base de Produtos' : 'Repositório de FAQs'}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0 }}>
                            {safeKb.length} itens de conhecimento ativos
                        </p>
                    </div>
                </div>

            </div>

            <div className="kb-content" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                <div className="kb-quick-actions">
                    <button onClick={() => setIsAddNewModalOpen(true)} className="kb-quick-action-btn">✨ Adicionar Novo</button>
                    <button onClick={() => setIsAddDocsModalOpen(true)} className="kb-quick-action-btn">📂 Adicionar Documentos</button>
                    <button onClick={() => setShowMediaSelectionModal(true)} className="kb-quick-action-btn">
                        📽️ Transcrição de Vídeo
                    </button>
                    <button onClick={() => {
                        setJsonBatchInput('');
                        setIsJsonBatchModalOpen(true);
                    }} className="kb-quick-action-btn">
                        📄 Upload Json
                    </button>
                    <input
                        type="file"
                        ref={videoInputRef}
                        style={{ display: 'none' }}
                        onChange={handleVideoTranscribe}
                        accept="video/*,audio/*"
                    />
                    <input
                        type="file"
                        ref={textMediaInputRef}
                        style={{ display: 'none' }}
                        onChange={handleTextMediaTranscribe}
                        accept=".txt"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        accept=".pdf,.docx,.doc"
                    />
                </div>


                {/* Form moved to modal */}

                {/* SIMULATOR BLOCK */}
                <div style={{ marginTop: '3rem', paddingTop: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <div style={{ width: '8px', height: '24px', background: 'linear-gradient(to bottom, #22c55e, #10b981)', borderRadius: '4px' }}></div>
                        <h4 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Simulador RAG (Central de Testes)</h4>
                    </div>
                    <div className="kb-item-modern" style={{ cursor: 'default' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Escreva uma pergunta e veja como a base de dados vai responder ao usuário, ativando ou desativando os filtros de IA.
                        </p>

                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                            {Object.keys(simConfig).map(key => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={simConfig[key]}
                                        onChange={e => setSimConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                                        style={{ accentColor: '#10b981', transform: 'scale(1.1)' }}
                                    />
                                    {key === 'translation' && 'TRADUÇÃO'}
                                    {key === 'multiQuery' && 'MULTI-QUERY'}
                                    {key === 'rerank' && 'RERANQUEAMENTO'}
                                    {key === 'agenticEval' && 'FILTRO AGENTE (IA)'}
                                    {key === 'parentExpansion' && 'EXPANSÃO DE CONTEXTO'}
                                </label>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                className="kb-search-input-premium"
                                style={{ flex: 1, width: 'auto' }}
                                placeholder="Faça uma pergunta..."
                                value={simQuery}
                                onChange={e => setSimQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSimulate()}
                            />
                            <button onClick={handleSimulate} disabled={simLoading} className="kb-save-btn-modern">
                                {simLoading ? 'Processando...' : '▶ Testar Busca'}
                            </button>
                        </div>

                        {simResults && (
                            <div style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h5 style={{ color: '#818cf8', fontWeight: 700, margin: 0, fontSize: '0.9rem' }}>RESULTADOS DA BUSCA:</h5>
                                    <button
                                        onClick={() => setSimResults(null)}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    >✕</button>
                                </div>

                                {simResults.error ? (
                                    <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{simResults.error}</p>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
                                            <div className="kb-stats-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                                Itens encontrados: {simResults.items?.length || 0}
                                            </div>
                                            <div className="kb-stats-pill" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                                Tokens: ~{simResults.usage?.prompt_tokens + simResults.usage?.completion_tokens}
                                            </div>
                                        </div>

                                        {simResults.items?.length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Nenhuma informação encontrada para esta pergunta.</p>
                                        ) : (
                                            <div style={{ display: 'grid', gap: '1rem' }}>
                                                {simResults.items?.map((item, idx) => (
                                                    <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '0.8rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                                            <strong style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>ID: {item.id}</strong>
                                                            {item.relevance_score !== undefined && (
                                                                <div style={{
                                                                    background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.2) 100%)',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    color: '#4ade80',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 800,
                                                                    letterSpacing: '0.5px'
                                                                }}>
                                                                    🎯 RELEVÂNCIA: {item.relevance_score.toFixed(4)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ color: '#cbd5e1', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                                            {item.metadata_val && <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.4rem' }}>{kbLabels.metadata.toUpperCase()}: {item.metadata_val}</div>}
                                                            {item.question && <div style={{ color: '#f8fafc', fontWeight: 'bold', marginBottom: '0.5rem' }}>Q: {item.question}</div>}
                                                            <div style={{ color: '#94a3b8' }}>{item.answer ? item.answer : item.content}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* END SIMULATOR BLOCK */}

                {(() => {
                    const content = (
                        <div className="kb-items-section-container" style={{ width: '100%', overflow: 'visible' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '1.5rem', marginTop: '2.5rem' }}>
                                {/* Left: title + filter */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
                                        📦 Conteúdo da Base ({safeKb.length} itens{kbFilterTerm ? ` · ${filteredItems.length} filtrados` : ''})
                                    </h4>
                                    {/* Filter bar */}
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none', opacity: 0.5 }}>🔎</span>
                                        <input
                                            type="text"
                                            value={kbFilterTerm}
                                            onChange={e => { setKbFilterTerm(e.target.value); setCurrentPage(1); }}
                                            placeholder="Filtrar conteúdo..."
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '10px',
                                                color: 'white',
                                                padding: '7px 32px 7px 30px',
                                                fontSize: '0.82rem',
                                                width: '200px',
                                                outline: 'none',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                        {kbFilterTerm && (
                                            <button
                                                onClick={() => setKbFilterTerm('')}
                                                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, padding: '2px' }}
                                            >✕</button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                        <button
                                            onClick={() => setScanMode('exact')}
                                            style={{
                                                padding: '8px 14px', background: scanMode === 'exact' ? '#475569' : 'transparent', color: scanMode === 'exact' ? 'white' : '#94a3b8',
                                                border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                                            }}
                                        >EXATO</button>
                                        <button
                                            onClick={() => setScanMode('semantic')}
                                            style={{
                                                padding: '8px 14px', background: scanMode === 'semantic' ? '#6366f1' : 'transparent', color: scanMode === 'semantic' ? 'white' : '#94a3b8',
                                                border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            IA <span>🧠</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => scanDuplicates()}
                                        disabled={scanningDuplicates}
                                        style={{
                                            padding: '10px 18px',
                                            background: scanMode === 'semantic' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                                            color: scanMode === 'semantic' ? '#818cf8' : '#ef4444',
                                            border: scanMode === 'semantic' ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; }}
                                    >
                                        {scanningDuplicates ? '📦 Analisando...' : scanMode === 'semantic' ? '🔍 Varredura Semântica' : '🧹 Varrer Duplicados'}
                                    </button>
                                </div>

                                {/* Right: selection controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    {selectedItems.size > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ background: '#ef4444', color: 'white', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{selectedItems.size}</span>
                                                <span style={{ opacity: 0.9, fontSize: '0.75rem' }}>{selectedItems.size === 1 ? 'item' : 'itens'}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setBulkSummarizeForm({
                                                        question: '',
                                                        metadata_val: '',
                                                        category: 'Resumo'
                                                    });
                                                    setIsBulkSummarizeOpen(true);
                                                }}
                                                className="kb-delete-btn-modern-small fade-in"
                                                title="Resumir selecionados"
                                                style={{ margin: 0, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                                            >
                                                ✨
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setBulkEditForm({
                                                        question: '',
                                                        answer: '',
                                                        metadata_val: '',
                                                        category: '',
                                                        useQuestion: false,
                                                        useAnswer: false,
                                                        useMetadata: false,
                                                        useCategory: false
                                                    });
                                                    setIsBulkEditOpen(true);
                                                }}
                                                className="kb-delete-btn-modern-small fade-in"
                                                title="Editar selecionados"
                                                style={{ margin: 0, padding: '8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="kb-delete-btn-modern-small fade-in"
                                                title="Excluir seleção"
                                                style={{ margin: 0, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                                        <input type="checkbox" checked={hasItems && selectedItems.size === filteredItems.length} onChange={toggleSelectAll} style={{ transform: 'scale(1.2)', accentColor: '#6366f1', cursor: 'pointer' }} />
                                        Selecionar Todos
                                    </label>
                                </div>
                            </div>

                            {!hasItems ? (
                                <div className="kb-empty-state">
                                    <span className="empty-icon">📂</span>
                                    <p>Sua base ainda está vazia ou a busca não retornou resultados.</p>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: '1.5rem',
                                    marginBottom: '2rem',
                                    width: '100%',
                                    minWidth: 0
                                }}>
                                    {paginatedItems.map((item) => {
                                        const isEdited = !!editedItems[item.id];
                                        const displayItem = isEdited ? editedItems[item.id] : item;
                                        const combinedContent = kbType === 'product' ? displayItem.answer : (
                                            (displayItem.metadata_val ? `[${kbLabels.metadata}: ${displayItem.metadata_val}]\n\n` : '') +
                                            displayItem.question + (displayItem.answer ? '\n\n' + displayItem.answer : '')
                                        );

                                        return (
                                            <div
                                                key={item.id}
                                                className={`kb-item-modern ${selectedItems.has(item.id) ? 'selected-card' : ''} ${sourceView?.id === item.id ? 'active-source' : ''}`}
                                                style={{ boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}
                                            >
                                                <div className="kb-item-accent-bar"></div>

                                                <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    {isEdited && (
                                                        <button onClick={() => saveItemEdits(item.originalIndex, item.id)} className="kb-save-btn-modern">
                                                            ✓ Salvar
                                                        </button>
                                                    )}
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(item.id)}
                                                        onChange={() => toggleSelect(item.id)}
                                                        style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: '#6366f1' }}
                                                    />
                                                </div>

                                                <div className="kb-item-main-row">
                                                    <div className="kb-item-content-col">
                                                        {kbType === 'product' && (
                                                            <input
                                                                type="text"
                                                                value={displayItem.question}
                                                                onChange={(e) => handleUpdateItem(item.originalIndex, item.id, 'question', e.target.value)}
                                                                placeholder="Nome do produto..."
                                                                style={{
                                                                    background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '1.15rem',
                                                                    fontWeight: 'bold', width: '100%', outline: 'none', marginBottom: '8px',
                                                                    textOverflow: 'ellipsis'
                                                                }}
                                                            />
                                                        )}

                                                        <div className="kb-field-group" style={{ marginTop: kbType === 'product' ? '0' : '20px' }}>
                                                            <ExpandableField
                                                                label={kbType === 'product' ? 'Especificações e Detalhes' : 'CONTEÚDO DO CONHECIMENTO'}
                                                                type="textarea"
                                                                showExpand={false}
                                                                value={combinedContent}
                                                                onChange={(e) => {
                                                                    if (kbType === 'product') {
                                                                        handleUpdateItem(item.originalIndex, item.id, 'answer', e.target.value);
                                                                    } else {
                                                                        handleItemContentChange(item.id, item, e.target.value);
                                                                    }
                                                                }}
                                                                placeholder={kbType === 'product' ? 'Ex: Cor: Azul, Tamanho: G...' : 'Pergunta\n\nResposta...'}
                                                                style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)', minHeight: '120px', fontSize: '0.9rem', color: kbType === 'product' ? '#cbd5e1' : 'inherit' }}
                                                            />
                                                        </div>

                                                        <style>{`
                                                                /* Override internal ExpandableField label style for KB Manager cards */
                                                                .kb-item-modern .expandable-field-container label {
                                                                    color: #64748b !important;
                                                                    font-weight: 800 !important;
                                                                    font-size: 0.65rem !important;
                                                                    text-transform: uppercase;
                                                                    letter-spacing: 0.5px;
                                                                }
                                                            `}</style>

                                                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                                                <span className="kb-category-pill">{displayItem.category || 'Geral'}</span>
                                                                <div className="kb-stats-pill">
                                                                    📏 {(displayItem.question?.length || 0) + (displayItem.answer?.length || 0) + (displayItem.metadata?.length || 0)} chars | 🪙 ~{Math.ceil(((displayItem.question?.length || 0) + (displayItem.answer?.length || 0) + (displayItem.metadata?.length || 0)) / 4)} tokens
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                {item.source_metadata && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const meta = typeof item.source_metadata === 'string' ? JSON.parse(item.source_metadata) : item.source_metadata;
                                                                            setSourceView(sourceView?.id === item.id ? null : { ...item, source_text: meta.source_text, metadata: meta });
                                                                        }}
                                                                        className={`btn-view-source-mini ${sourceView?.id === item.id ? 'active' : ''}`}
                                                                    >
                                                                        🔍 Fonte
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setMaximizedItem({ ...displayItem, id: item.id, originalIndex: item.originalIndex })}
                                                                    title="Ver conteúdo completo"
                                                                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#a5b4fc', cursor: 'pointer', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    onMouseEnter={e => { e.target.style.background = '#6366f1'; e.target.style.color = 'white'; }}
                                                                    onMouseLeave={e => { e.target.style.background = 'rgba(99,102,241,0.1)'; e.target.style.color = '#a5b4fc'; }}
                                                                >⤢ Ver</button>
                                                                <button onClick={() => handleDeleteItem(item.originalIndex, item.id)} className="kb-delete-btn-modern">🗑️</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1.5rem 0 0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: currentPage === 1 ? '#334155' : '#94a3b8', borderRadius: '8px', padding: '6px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                                    >«</button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: currentPage === 1 ? '#334155' : '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                                    >‹</button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                        .reduce((acc, p, i, arr) => {
                                            if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, i) => p === '...' ? (
                                            <span key={`ellipsis-${i}`} style={{ color: '#475569', fontSize: '0.8rem', padding: '0 4px' }}>…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                style={{
                                                    background: currentPage === p ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.05)',
                                                    border: '1px solid ' + (currentPage === p ? 'transparent' : 'rgba(255,255,255,0.08)'),
                                                    color: currentPage === p ? 'white' : '#94a3b8',
                                                    borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                                                    fontSize: '0.8rem', fontWeight: currentPage === p ? 700 : 400,
                                                    transition: 'all 0.2s', minWidth: '36px'
                                                }}
                                            >{p}</button>
                                        ))
                                    }

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: currentPage === totalPages ? '#334155' : '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                                    >›</button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: currentPage === totalPages ? '#334155' : '#94a3b8', borderRadius: '8px', padding: '6px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                                    >»</button>

                                    <span style={{ color: '#475569', fontSize: '0.78rem', marginLeft: '8px' }}>
                                        Página {currentPage} de {totalPages} · {filteredItems.length} itens
                                    </span>
                                </div>
                            )}
                        </div>
                    );

                    return content;
                })()}

            </div>



            {sourceView && document.body && createPortal(
                <div className="kb-sidebar-overlay" onClick={() => setSourceView(null)}>
                    <div className="source-viewer-modal fade-in" onClick={e => e.stopPropagation()}>
                        <div className="sidebar-header">
                            <h4>🔍 Contexto Original</h4>
                            <button onClick={() => setSourceView(null)}>✕</button>
                        </div>
                        <div className="sidebar-content">
                            <div className="source-meta-info">
                                <span>Item ID: <strong>{sourceView.id}</strong></span>
                                {sourceView.metadata?.page && <span>Página: <strong>{sourceView.metadata.page}</strong></span>}
                            </div>
                            <div className="source-text-blob">{sourceView.source_text}</div>
                        </div>
                    </div>
                </div>, document.body
            )}

            {maximizedItem && document.body && createPortal(
                <div
                    onClick={() => { if (!isEditingMaximized) setMaximizedItem(null); }}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                        zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '2rem', animation: 'fadeIn 0.2s ease'
                    }}
                >
                    {/* Navigation Arrows */}
                    {!isEditingMaximized && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePrevItem(); }}
                                disabled={filteredItems.findIndex(i => i.id === maximizedItem.id) === 0}
                                style={{
                                    position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'white', width: '64px', height: '64px', borderRadius: '50%',
                                    cursor: filteredItems.findIndex(i => i.id === maximizedItem.id) === 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    zIndex: 20001, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: filteredItems.findIndex(i => i.id === maximizedItem.id) === 0 ? 0.1 : 0.8,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                    backdropFilter: 'blur(4px)'
                                }}
                                onMouseEnter={e => { if (filteredItems.findIndex(i => i.id === maximizedItem.id) !== 0) { e.currentTarget.style.background = 'rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; e.currentTarget.style.opacity = '1'; } }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.opacity = '0.8'; }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleNextItem(); }}
                                disabled={filteredItems.findIndex(i => i.id === maximizedItem.id) === filteredItems.length - 1}
                                style={{
                                    position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'white', width: '64px', height: '64px', borderRadius: '50%',
                                    cursor: filteredItems.findIndex(i => i.id === maximizedItem.id) === filteredItems.length - 1 ? 'not-allowed' : 'pointer',
                                    fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    zIndex: 20001, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: filteredItems.findIndex(i => i.id === maximizedItem.id) === filteredItems.length - 1 ? 0.1 : 0.8,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                    backdropFilter: 'blur(4px)'
                                }}
                                onMouseEnter={e => { if (filteredItems.findIndex(i => i.id === maximizedItem.id) !== filteredItems.length - 1) { e.currentTarget.style.background = 'rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; e.currentTarget.style.opacity = '1'; } }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.opacity = '0.8'; }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </>
                    )}

                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '20px',
                            width: '100%',
                            maxWidth: '760px',
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
                            animation: 'slideUp 0.25s ease',
                        }}
                    >
                        {/* Header */}
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '8px', height: '32px', background: 'linear-gradient(to bottom, #6366f1, #a855f7)', borderRadius: '4px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {isEditingMaximized ? 'EDIÇÃO DE CONTEÚDO' : `CONTEÚDO COMPLETO (${filteredItems.findIndex(i => i.id === maximizedItem.id) + 1} de ${filteredItems.length})`}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600, marginTop: '2px' }}>ID: {maximizedItem.id} &nbsp;·&nbsp; {isEditingMaximized ? (
                                    <input
                                            value={maximizedForm.category}
                                            onChange={e => setMaximizedForm({ ...maximizedForm, category: e.target.value })}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', color: 'white', fontSize: '0.8rem', outline: 'none', transition: 'all 0.2s' }}
                                        />
                                    ) : (maximizedItem.category || 'Geral')}</div>
                                </div>
                            </div>
                            {!isEditingMaximized && (
                                <button
                                    onClick={() => setMaximizedItem(null)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                                >✕</button>
                            )}
                        </div>

                        {/* Content */}
                        <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Metadata */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>🏷️ {kbLabels.metadata}</div>
                                    {!isEditingMaximized && (
                                        <button 
                                            onClick={() => setShowJsonView(!showJsonView)}
                                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {showJsonView ? (
                                                <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> Ver Lista</>
                                            ) : (
                                                <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> Ver JSON</>
                                            )}
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingMaximized ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '12px' }}>
                                        {metadataEditorItems.map((item, idx) => (
                                            <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    value={item.key}
                                                    placeholder="Nome"
                                                    onChange={e => {
                                                        const newItems = [...metadataEditorItems];
                                                        newItems[idx].key = e.target.value;
                                                        setMetadataEditorItems(newItems);
                                                    }}
                                                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                                                />
                                                <span style={{ color: '#f59e0b', fontWeight: 900 }}>:</span>
                                                <input
                                                    value={item.value}
                                                    placeholder="Valor"
                                                    onChange={e => {
                                                        const newItems = [...metadataEditorItems];
                                                        newItems[idx].value = e.target.value;
                                                        setMetadataEditorItems(newItems);
                                                    }}
                                                    style={{ flex: 2, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '6px 10px', color: '#cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                                                />
                                                <button
                                                    onClick={() => setMetadataEditorItems(metadataEditorItems.filter((_, i) => i !== idx))}
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setMetadataEditorItems([...metadataEditorItems, { id: Math.random().toString(36).substr(2, 9), key: '', value: '' }])}
                                            style={{ marginTop: '4px', background: 'rgba(99,102,241,0.1)', border: '1px dashed rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '6px', padding: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Adicionar Variável
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '1rem 1.5rem', color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600 }}>
                                        {showJsonView ? (
                                            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', color: '#fbbf24', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                                {(() => {
                                                    const raw = maximizedItem.metadata_val || maximizedItem.metadata || '{}';
                                                    try {
                                                        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                                                        return JSON.stringify(parsed, null, 2);
                                                    } catch (e) {
                                                        return String(raw);
                                                    }
                                                })()}
                                            </pre>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {(() => {
                                                    const raw = maximizedItem.metadata_val || maximizedItem.metadata || '';
                                                    try {
                                                        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                                                        if (parsed && typeof parsed === 'object') {
                                                            const entries = Object.entries(parsed);
                                                            if (entries.length === 0) return 'Nenhum metadado';
                                                            return entries.map(([k, v]) => (
                                                                <div key={k} style={{ display: 'flex', gap: '8px' }}>
                                                                    <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{k}:</span>
                                                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                                </div>
                                                            ));
                                                        }
                                                    } catch (e) {}
                                                    return raw || 'Nenhum metadado';
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Question */}
                            <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>❓ {kbLabels.question}</div>
                                {isEditingMaximized ? (
                                    <textarea
                                        value={maximizedForm.question}
                                        onChange={e => setMaximizedForm({ ...maximizedForm, question: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '1.25rem 1.5rem', color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, lineHeight: 1.6, minHeight: '100px', outline: 'none', resize: 'vertical', transition: 'all 0.2s' }}
                                    />
                                ) : (
                                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '1.25rem 1.5rem', color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, lineHeight: 1.6 }}>
                                        {maximizedItem.question}
                                    </div>
                                )}
                            </div>
                            {/* Answer */}
                            <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>💬 {kbLabels.answer}</div>
                                {isEditingMaximized ? (
                                    <textarea
                                        value={maximizedForm.answer}
                                        onChange={e => setMaximizedForm({ ...maximizedForm, answer: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '1.25rem 1.5rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.8, minHeight: '200px', outline: 'none', resize: 'vertical', transition: 'all 0.2s' }}
                                    />
                                ) : (
                                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '1.25rem 1.5rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                        {maximizedItem.answer}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 2rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {isEditingMaximized ? (
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>Modo de Edição Ativo</span>
                                ) : (
                                    <>
                                        <span style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 700 }}>{maximizedItem.category || 'Geral'}</span>
                                        <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                                            📏 {(maximizedItem.question?.length || 0) + (maximizedItem.answer?.length || 0) + (maximizedItem.metadata_val?.length || 0) + (maximizedItem.metadata?.length || 0)} chars
                                        </span>
                                    </>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {isEditingMaximized ? (
                                    <>
                                        <button
                                            onClick={() => { setIsEditingMaximized(false); setMaximizedForm(null); }}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '10px', padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                        >Cancelar</button>
                                        <button
                                            onClick={handleUpdateMaximized}
                                            disabled={isSavingMaximized}
                                            style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)', border: 'none', color: 'white', borderRadius: '10px', padding: '8px 24px', fontSize: '0.85rem', fontWeight: 700, cursor: isSavingMaximized ? 'not-allowed' : 'pointer', opacity: isSavingMaximized ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {isSavingMaximized ? 'Salvando...' : 'Atualizar'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                const rawMetadata = maximizedItem.metadata_val || maximizedItem.metadata || '';
                                                let parsedMetadata = [];
                                                
                                                try {
                                                    const metaObj = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
                                                    if (metaObj && typeof metaObj === 'object') {
                                                        parsedMetadata = Object.entries(metaObj).map(([key, value]) => ({
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            key,
                                                            value: typeof value === 'object' ? JSON.stringify(value) : String(value)
                                                        }));
                                                    }
                                                } catch (e) {
                                                    // Se não for JSON, trata como string simples se houver conteúdo
                                                    if (rawMetadata) {
                                                        parsedMetadata = [{ id: 'default', key: 'info', value: String(rawMetadata) }];
                                                    }
                                                }

                                                if (parsedMetadata.length === 0) {
                                                    parsedMetadata = [{ id: Math.random().toString(36).substr(2, 9), key: '', value: '' }];
                                                }

                                                setMetadataEditorItems(parsedMetadata);
                                                setMaximizedForm({
                                                    question: maximizedItem.question,
                                                    answer: maximizedItem.answer,
                                                    category: maximizedItem.category || 'Geral',
                                                    metadata_val: rawMetadata
                                                });
                                                setIsEditingMaximized(true);
                                            }}
                                            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: '10px', padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                        >Editar</button>
                                        <button
                                            onClick={() => setMaximizedItem(null)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '10px', padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                        >Fechar</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>, document.body
            )}

            <ConfirmModal
                isOpen={isConfirmOpen}
                title="Excluir Conteúdo"
                message={selectedItems.size > 0 ? `Excluir ${selectedItems.size} itens?` : "Excluir este item?"}
                confirmText="Excluir"
                onConfirm={confirmDeletion}
                onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
                isLoading={isDeleting}
                type="danger"
            />

            {isTextModalOpen && document.body && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(7, 10, 20, 0.97)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        zIndex: 10000000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                        animation: 'fadeIn 0.2s ease'
                    }}
                    onClick={() => setIsTextModalOpen(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.querySelector('.txt-drop-zone').style.borderColor = '#6366f1'; e.currentTarget.querySelector('.txt-drop-zone').style.background = 'rgba(99,102,241,0.08)'; }}
                        onDragLeave={e => { e.currentTarget.querySelector('.txt-drop-zone').style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.querySelector('.txt-drop-zone').style.background = 'rgba(0,0,0,0.2)'; }}
                        onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.querySelector('.txt-drop-zone').style.borderColor = 'rgba(255,255,255,0.08)';
                            e.currentTarget.querySelector('.txt-drop-zone').style.background = 'rgba(0,0,0,0.2)';
                            const file = e.dataTransfer.files[0];
                            if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
                                const reader = new FileReader();
                                reader.onload = ev => setTempText(ev.target.result);
                                reader.readAsText(file);
                            }
                        }}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '32px',
                            width: '100%', maxWidth: '780px',
                            maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1)',
                            animation: 'modalPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        {/* Top accent bar */}
                        <div style={{ height: '4px', background: 'linear-gradient(90deg, #6366f1, #a855f7, #06b6d4)', flexShrink: 0 }} />

                        {/* Header */}
                        <div style={{ padding: '28px 36px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '48px', height: '48px', background: 'rgba(99,102,241,0.12)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📋</div>
                                <div>
                                    <h2 style={{ margin: 0, color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>Colar Texto</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>Cole texto ou arraste um arquivo .txt</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsTextModalOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                            >✕</button>
                        </div>

                        {/* Textarea area */}
                        <div className="txt-drop-zone" style={{ margin: '0 36px', flex: 1, minHeight: 0, background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden', transition: 'all 0.2s', position: 'relative' }}>
                            {!tempText && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: '8px', opacity: 0.3 }}>
                                    <div style={{ fontSize: '3rem' }}>📄</div>
                                    <p style={{ color: 'white', fontWeight: 700, margin: 0 }}>Cole seu texto ou arraste um .txt</p>
                                </div>
                            )}
                            <textarea
                                value={tempText}
                                onChange={e => setTempText(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%', height: '100%', minHeight: '320px',
                                    background: 'transparent', border: 'none', outline: 'none',
                                    color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.7,
                                    padding: '20px', resize: 'none', fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Stats bar */}
                        <div style={{ margin: '12px 36px 0', display: 'flex', gap: '10px', flexShrink: 0 }}>
                            {[
                                { label: 'Caracteres', value: (tempText || '').length.toLocaleString(), color: '#6366f1' },
                                { label: 'Palavras', value: (tempText || '').trim() ? (tempText || '').trim().split(/\s+/).length.toLocaleString() : '0', color: '#10b981' },
                                { label: '~Tokens', value: Math.ceil((tempText || '').length / 4).toLocaleString(), color: '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: s.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                                    <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900, marginTop: '2px' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '20px', flexShrink: 0 }}>
                            <button
                                onClick={() => { setIsTextModalOpen(false); setTempText(''); }}
                                style={{ border: 'none', padding: '22px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', background: '#0f172a', color: '#64748b', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#0f172a'; }}
                            >Cancelar</button>
                            <button
                                onClick={confirmTextImport}
                                disabled={!tempText.trim()}
                                style={{ border: 'none', padding: '22px', fontSize: '0.95rem', fontWeight: 800, cursor: tempText.trim() ? 'pointer' : 'not-allowed', background: '#0f172a', color: tempText.trim() ? '#818cf8' : '#334155', transition: 'all 0.2s' }}
                                onMouseEnter={e => { if (tempText.trim()) { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = 'white'; } }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = tempText.trim() ? '#818cf8' : '#334155'; }}
                            >Processar Texto ➡️</button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {isTextOptionsOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'linear-gradient(160deg, #070a14 0%, #0d1230 50%, #07101f 100%)',
                    backdropFilter: 'blur(30px) saturate(200%)',
                    zIndex: 10000001,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '48px 20px 60px', overflowY: 'auto', color: 'white',
                    animation: 'fadeIn 0.25s ease'
                }}>
                    {/* Ambient glow blobs */}
                    <div style={{ position: 'fixed', top: '-10%', left: '20%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
                    <div style={{ position: 'fixed', bottom: '0', right: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

                    <div style={{ maxWidth: '820px', width: '100%', position: 'relative', zIndex: 1 }}>

                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '48px', animation: 'fadeInUp 0.4s ease' }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '72px', height: '72px', borderRadius: '22px', marginBottom: '20px',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 100%)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                boxShadow: '0 0 40px rgba(99,102,241,0.15)',
                                fontSize: '2rem'
                            }}>📋</div>
                            <h2 style={{
                                margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px',
                                background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                            }}>Texto Processado</h2>
                            <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '1rem', fontWeight: 500 }}>
                                Escolha como deseja importar este conteúdo para a base de conhecimento
                            </p>
                        </div>

                        {/* Text preview card */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '24px',
                            marginBottom: '36px', overflow: 'hidden',
                            boxShadow: '0 4px 40px rgba(0,0,0,0.3)',
                            animation: 'fadeInUp 0.45s ease'
                        }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
                                    <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Conteúdo Transcrito</span>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(textForProcessing)}
                                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: '8px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >Copiar</button>
                            </div>
                            <div style={{ padding: '20px 24px', color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.8, maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {textForProcessing || "Nenhum texto detectado."}
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                {[
                                    { label: 'Caracteres', value: textForProcessing.length.toLocaleString(), color: '#6366f1', glow: 'rgba(99,102,241,0.3)' },
                                    { label: 'Palavras', value: textForProcessing.trim() ? textForProcessing.trim().split(/\s+/).length.toLocaleString() : '0', color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
                                    { label: '~Tokens', value: Math.ceil(textForProcessing.length / 4).toLocaleString(), color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
                                ].map((s, i) => (
                                    <div key={s.label} style={{ flex: 1, padding: '16px 12px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                        <div style={{ fontSize: '0.62rem', color: s.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>{s.label}</div>
                                        <div style={{ fontSize: '1.3rem', color: 'white', fontWeight: 900, textShadow: `0 0 20px ${s.glow}` }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section label */}
                        <div style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>Próximos Passos</span>
                        </div>

                        {/* Option cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '28px', animation: 'fadeInUp 0.55s ease' }}>
                            {[
                                {
                                    key: 'extractQA', icon: '❓', label: 'Extrair Perguntas',
                                    desc: 'Cria diálogos automáticos entre o robô e o conteúdo.',
                                    activeColor: '#6366f1', activeBg: 'rgba(99,102,241,0.12)',
                                    activeShadow: '0 8px 32px rgba(99,102,241,0.25)', iconBg: 'rgba(99,102,241,0.15)'
                                },
                                {
                                    key: 'extractChunks', icon: '🧩', label: 'Extrair Chunks',
                                    desc: 'Mapeia o conhecimento em blocos atômicos.',
                                    activeColor: '#10b981', activeBg: 'rgba(16,185,129,0.12)',
                                    activeShadow: '0 8px 32px rgba(16,185,129,0.25)', iconBg: 'rgba(16,185,129,0.15)'
                                },
                                {
                                    key: 'generateSummary', icon: '✨', label: 'Gerar Resumo IA',
                                    desc: 'Cria um resumo executivo para consulta rápida do robô.',
                                    activeColor: '#a855f7', activeBg: 'rgba(168,85,247,0.12)',
                                    activeShadow: '0 8px 32px rgba(168,85,247,0.25)', iconBg: 'rgba(168,85,247,0.15)'
                                }
                            ].map(opt => {
                                const isActive = ragConfig[opt.key];
                                return (
                                    <div
                                        key={opt.key}
                                        onClick={() => setRagConfig(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                        style={{
                                            background: isActive ? opt.activeBg : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isActive ? opt.activeColor : 'rgba(255,255,255,0.07)'}`,
                                            borderRadius: '20px', padding: '26px 24px', cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            position: 'relative', backdropFilter: 'blur(10px)',
                                            boxShadow: isActive ? opt.activeShadow : '0 2px 12px rgba(0,0,0,0.2)',
                                            transform: isActive ? 'scale(1.02) translateY(-2px)' : 'scale(1)'
                                        }}
                                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.border = `1px solid ${opt.activeColor}`; e.currentTarget.style.transform = 'scale(1.03) translateY(-3px)'; e.currentTarget.style.boxShadow = opt.activeShadow; e.currentTarget.style.background = opt.activeBg; } }}
                                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; } }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: isActive ? opt.iconBg : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? opt.activeColor + '44' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', transition: 'all 0.25s' }}>
                                                {opt.icon}
                                            </div>
                                            <div style={{
                                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                                background: isActive ? opt.activeColor : 'rgba(255,255,255,0.06)',
                                                border: `2px solid ${isActive ? opt.activeColor : 'rgba(255,255,255,0.1)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.65rem', fontWeight: 900, color: 'white',
                                                transition: 'all 0.25s', boxShadow: isActive ? `0 0 12px ${opt.activeColor}88` : 'none'
                                            }}>{isActive ? '✓' : ''}</div>
                                        </div>
                                        <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', marginBottom: '8px' }}>{opt.label}</div>
                                        <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>{opt.desc}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chunk config */}
                        {ragConfig.extractChunks && (
                            <div className="fade-in" style={{
                                padding: '24px 28px', background: 'rgba(16,185,129,0.04)',
                                border: '1px solid rgba(16,185,129,0.15)', borderRadius: '20px',
                                marginBottom: '28px', backdropFilter: 'blur(10px)'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '20px' }}>⚙️ Configuração dos Blocos</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Tamanho do Bloco</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <input type="range" min="500" max="4000" step="100" value={ragConfig.chunkSize} onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))} style={{ flex: 1, accentColor: '#10b981' }} />
                                            <input type="number" value={ragConfig.chunkSize} onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 0 }))} style={{ width: '72px', background: 'rgba(16,185,129,0.15)', color: 'white', fontWeight: 900, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '6px 8px', textAlign: 'center', outline: 'none' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Sobreposição</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <input type="range" min="0" max="2000" step="10" value={ragConfig.chunkOverlap} onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))} style={{ flex: 1, accentColor: '#6366f1' }} />
                                            <input type="number" value={ragConfig.chunkOverlap} onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 0 }))} style={{ width: '72px', background: 'rgba(99,102,241,0.15)', color: 'white', fontWeight: 900, border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '6px 8px', textAlign: 'center', outline: 'none' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Metadata */}
                        <div style={{ marginBottom: '36px', animation: 'fadeInUp 0.6s ease' }}>
                            <label style={{ display: 'block', color: '#475569', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1.5px' }}>🏷️ Metadados do Conteúdo</label>
                            <input
                                type="text"
                                placeholder="Ex: Manual do Produto, Módulo 01..."
                                value={ragConfig.metadata}
                                onChange={e => setRagConfig(prev => ({ ...prev, metadata: e.target.value }))}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 22px', color: 'white', fontSize: '1rem', outline: 'none', transition: 'all 0.25s', boxSizing: 'border-box' }}
                                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.boxShadow = 'none'; }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '14px', animation: 'fadeInUp 0.65s ease' }}>
                            <button
                                onClick={() => { setIsTextOptionsOpen(false); setTextForProcessing(''); }}
                                style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >Cancelar</button>
                            <button
                                onClick={handleCreateRagFromText}
                                disabled={isCreatingRag}
                                style={{
                                    flex: 2.5, padding: '16px',
                                    background: isCreatingRag ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #7c3aed 100%)',
                                    color: 'white', border: 'none', borderRadius: '16px',
                                    fontWeight: 900, fontSize: '1.05rem', cursor: isCreatingRag ? 'not-allowed' : 'pointer',
                                    boxShadow: isCreatingRag ? 'none' : '0 8px 32px rgba(99,102,241,0.45)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    transition: 'all 0.25s', letterSpacing: '0.3px'
                                }}
                                onMouseEnter={e => { if (!isCreatingRag) { e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(99,102,241,0.55)'; } }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.45)'; }}
                            >
                                {isCreatingRag ? (
                                    <><div className="spin" style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>Processando...</>
                                ) : (
                                    <>🚀 Gerar Base de Conhecimento</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}

            <style>{`
                .kb-manager { width: 100%; position: relative; }
                
                .kb-quick-actions {
                    display: flex; gap: 15px; margin-bottom: 25px; align-items: center; flex-wrap: wrap;
                }
                .kb-quick-action-btn {
                    background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #a5b4fc; padding: 12px 20px; border-radius: 12px; font-size: 0.95rem;
                    font-weight: 700; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; align-items: center; gap: 10px;
                }
                .kb-quick-action-btn:hover {
                    background: #6366f1; color: white; border-color: #818cf8;
                    transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
                }

                .kb-search-input {
                    width: 100%; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px; padding: 12px 12px 12px 3rem; color: white; outline: none; transition: all 0.2s;
                }
                .kb-search-input:focus { border-color: #6366f1; background: rgba(99, 102, 241, 0.05); }

                /* Text Import Modal Styles */
                .kb-text-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(7, 10, 19, 0.9); backdrop-filter: blur(12px);
                    z-index: 10000000; display: flex; align-items: center; justify-content: center;
                    padding: 20px; animation: fadeIn 0.3s ease-out;
                }
                .kb-text-card {
                    background: #161d2f; border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 28px; width: 100%; max-width: 650px;
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8);
                    overflow: hidden; animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    display: flex; flex-direction: column;
                }
                .kb-text-content { padding: 40px; text-align: left; }
                .kb-text-actions {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
                    background: rgba(255,255,255,0.05); border-top: 1px solid rgba(255,255,255,0.05);
                }
                .kb-text-btn {
                    border: none; padding: 22px; font-size: 0.95rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s; background: #161d2f;
                }
                .kb-text-btn.cancel { color: #64748b; }
                .kb-text-btn.cancel:hover { background: rgba(255,255,255,0.02); color: white; }
                .kb-text-btn.confirm { color: #818cf8; }
                .kb-text-btn.confirm:hover { background: #6366f1; color: white; }
                .modal-textarea-premium {
                    width: 100%; height: 250px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);
                    color: white; border-radius: 12px; padding: 15px; font-size: 0.95rem; outline: none;
                    font-family: inherit; transition: all 0.2s; resize: vertical;
                }
                .modal-textarea-premium:focus { border-color: #6366f1; background: rgba(0,0,0,0.4); }
                @keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }


                
                .kb-search-input-premium {
                    background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); color: white;
                    padding: 10px 20px; border-radius: 12px; width: 350px; outline: none; transition: all 0.2s;
                    backdrop-filter: blur(10px);
                }
                .kb-search-input-premium:focus { border-color: #6366f1; background: rgba(15, 23, 42, 0.8); }
                
                .kb-item-modern {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 1.5rem; padding: 1.5rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative; overflow: hidden;
                    backdrop-filter: blur(10px);
                }
                .kb-item-modern:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(99, 102, 241, 0.3);
                    transform: translateY(-4px);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }
                .kb-item-accent-bar {
                    position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
                    background: linear-gradient(to bottom, #6366f1, #a855f7);
                    opacity: 0.5; transition: opacity 0.3s;
                }
                .kb-item-modern:hover .kb-item-accent-bar { opacity: 1; }
                
                .active-source { border-color: #6366f1 !important; box-shadow: 0 0 25px rgba(99,102,241,0.2) !important; }
                
                .kb-category-pill {
                    background: rgba(168, 85, 247, 0.1); color: #c084fc;
                    padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800;
                    border: 1px solid rgba(168, 85, 247, 0.2);
                }
                .kb-stats-pill {
                    background: rgba(255, 255, 255, 0.03); color: #64748b;
                    padding: 4px 12px; border-radius: 20px; font-size: 0.65rem; font-weight: 700;
                }
                .kb-delete-btn-modern {
                    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #ef4444; width: 32px; height: 32px; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
                }
                .kb-delete-btn-modern:hover { background: #ef4444; color: white; transform: scale(1.1); }

                .kb-delete-btn-modern-small {
                    background: transparent; border: none; color: #ef4444; width: 28px; height: 28px; border-radius: 6px;
                    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
                    font-size: 0.95rem; opacity: 0.8;
                }
                .kb-delete-btn-modern-small:hover { background: rgba(239, 68, 68, 0.15); opacity: 1; transform: scale(1.1); }
                
                .btn-view-source-mini {
                    background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #818cf8; padding: 6px 14px; border-radius: 8px; cursor: pointer;
                    font-size: 0.75rem; font-weight: 700; transition: all 0.2s;
                }
                .btn-view-source-mini:hover { background: rgba(99, 102, 241, 0.2); color: white; }
                .btn-view-source-mini.active { background: #6366f1; color: white; }
                
                .kb-sidebar-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
                .source-viewer-modal { width: 90%; max-width: 800px; background: #0f172a; max-height: 85vh; border-radius: 24px; border: 1px solid rgba(99,102,241,0.2); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; animation: fadeIn 0.3s ease; }
                .sidebar-header { padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
                .sidebar-header h4 { margin: 0; color: #fff; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
                .sidebar-header button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .sidebar-header button:hover { background: #ef4444; border-color: transparent; }
                .sidebar-content { padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
                .source-meta-info { display: flex; gap: 15px; color: #94a3b8; font-size: 0.85rem; background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 12px; }
                .source-meta-info strong { color: #fff; }
                .source-text-blob { background: #020617; padding: 25px; border-radius: 15px; color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.05); }

                .selection-info-bar { background: #6366f1; padding: 15px 30px; border-radius: 20px; display: flex; gap: 30px; align-items: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
                .kb-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; width: 100%; }

                .kb-save-btn-modern {
                    background: #22c55e;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
                }
                .kb-save-btn-modern:hover {
                    background: #16a34a;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
                }
                
                .modal-overlay-custom {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    backdrop-filter: blur(12px);
                    padding: 20px;
                }
                
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                
                .modal-content-animated {
                    animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
            {duplicateGroups && document.body && createPortal(
                <div className="modal-overlay-custom" onClick={() => { if (!scanningDuplicates) setDuplicateGroups(null); }}>
                    <div className="modal-content modal-content-animated"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '1000px',
                            width: '95%',
                            maxHeight: '92vh',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#0f172a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '32px',
                            boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                        {/* HEADER */}
                        <div style={{
                            padding: '20px 32px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            borderBottom: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                                    color: 'white',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.4rem',
                                    boxShadow: '0 8px 20px rgba(225, 29, 72, 0.3)'
                                }}>🧹</div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'white', letterSpacing: '-0.01em' }}>Otimização de Base</h3>
                                    <p style={{ margin: '2px 0 0 0', opacity: 0.5, color: '#94a3b8', fontSize: '0.85rem' }}>
                                        Limpando redundâncias para performance máxima do seu agente.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDuplicateGroups(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '10px', borderRadius: '12px', fontSize: '1rem' }}>✕</button>
                        </div>

                        {/* STATS BAR */}
                        {duplicateGroups.length > 0 && !showBulkConfirm && (
                            <div style={{ padding: '16px 32px', background: 'rgba(244, 63, 94, 0.03)', display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid rgba(244, 63, 94, 0.08)' }}>
                                <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>Grupos Duplicados:</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f43f5e' }}>{duplicateGroups.length}</div>
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>Total REDUNDANTES:</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f43f5e' }}>{duplicateGroups.reduce((acc, g) => acc + (g.count - 1), 0)}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowBulkConfirm(true)}
                                    disabled={scanningDuplicates}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'linear-gradient(135deg, #f43f5e 0%, #dc2626 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '14px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        boxShadow: '0 8px 20px rgba(244, 63, 94, 0.2)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {scanningDuplicates ? '...' : '🚀 Limpar Tudo Agora'}
                                </button>
                            </div>
                        )}

                        {/* BULK CONFIRM OVERLAY */}
                        {showBulkConfirm && (
                            <div className="fade-in" style={{ padding: '40px', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderBottom: '1px solid rgba(244, 63, 94, 0.2)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                                <h3 style={{ color: 'white', marginBottom: '12px', fontSize: '1.6rem', fontWeight: 800 }}>Deseja remover todas as redundâncias?</h3>
                                <p style={{ color: '#94a3b8', maxWidth: '500px', lineHeight: 1.6, marginBottom: '24px' }}>
                                    Isso removerá permanentemente todos os itens repetidos, mantendo apenas 1 versão original de cada. Esta ação não pode ser desfeita.
                                </p>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <button
                                        onClick={() => setShowBulkConfirm(false)}
                                        style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                                    >Cancelar</button>
                                    <button
                                        onClick={async () => {
                                            const allIdsToDelete = (duplicateGroups || []).flatMap(group => (group?.ids || []).slice(1));
                                            setScanningDuplicates(true);
                                            try {
                                                const currentKbId = kbId || window.location.pathname.split('/').filter(Boolean).pop();
                                                await api.delete(`/knowledge-bases/${currentKbId}/items/batch-delete`, { item_ids: allIdsToDelete });
                                                setDuplicateGroups(null);
                                                window.location.reload();
                                            } catch (e) { console.error(e); }
                                            finally { setScanningDuplicates(false); setShowBulkConfirm(false); }
                                        }}
                                        style={{ padding: '14px 40px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(244, 63, 94, 0.3)' }}
                                    >
                                        SIM, LIMPAR TUDO
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CONTENT LIST */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: 'rgba(15, 23, 42, 0.2)' }}>
                            {(!duplicateGroups || duplicateGroups.length === 0) ? (
                                <div style={{ textAlign: 'center', padding: '100px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: '5rem', background: 'rgba(34, 197, 94, 0.1)', width: '120px', height: '120px', borderRadius: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>✨</div>
                                    <h4 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800 }}>Base 100% Otimizada!</h4>
                                    <p style={{ color: '#94a3b8', marginTop: '12px', fontSize: '1.1rem', maxWidth: '400px', lineHeight: 1.6 }}>Sua estrutura está limpa e livre de redundâncias. O desempenho do agente será superior.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {duplicateGroups.map((group, idx) => (
                                        <div key={idx} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '28px',
                                            padding: '28px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }} className="duplicate-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{
                                                        background: group.is_semantic ? 'rgba(99, 102, 241, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                                        color: group.is_semantic ? '#818cf8' : '#f87171',
                                                        padding: '6px 16px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 900,
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {group.is_semantic ? 'SIMILARIDADE DE IA' : 'CONTEÚDO IDÊNTICO'} ({group.count}x)
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        onClick={() => handleProposeMerge(group.ids)}
                                                        disabled={mergingLoading}
                                                        style={{
                                                            background: 'rgba(99, 102, 241, 0.1)',
                                                            border: '1px solid #6366f1',
                                                            color: '#818cf8',
                                                            padding: '10px 20px',
                                                            borderRadius: '14px',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {mergingLoading ? '...' : '🧠 Mesclar com IA'}
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const idsToDelete = group.ids.slice(1);
                                                            setScanningDuplicates(true);
                                                            try {
                                                                await api.delete(`/knowledge-bases/${kbId}/items/batch-delete`, { item_ids: idsToDelete });
                                                                scanDuplicates();
                                                            } catch (e) { console.error(e); }
                                                            finally { setScanningDuplicates(false); }
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid rgba(244, 63, 94, 0.4)',
                                                            color: '#f43f5e',
                                                            padding: '10px 20px',
                                                            borderRadius: '14px',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {scanningDuplicates ? '...' : 'Manter Principal'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.2rem', marginBottom: '12px', lineHeight: 1.4 }}>
                                                {group.question}
                                            </div>
                                            <div style={{
                                                color: '#abb2bf',
                                                fontSize: '1rem',
                                                lineHeight: 1.7,
                                                background: 'rgba(0,0,0,0.25)',
                                                padding: '20px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(255,255,255,0.03)',
                                            }}>
                                                {group.answer}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PROPOSED MERGE OVERLAY */}
                        {proposedMerge && (
                            <div style={{ position: 'absolute', inset: 0, background: '#0f172a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99,102,241,0.05)' }}>
                                    <h4 style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🧠 Proposta de Mesclagem IA</h4>
                                    <button onClick={() => setProposedMerge(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '10px', borderRadius: '12px' }}>✕</button>
                                </div>
                                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ color: '#6366f1', fontSize: '0.7rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>PERGUNTA SINTETIZADA</div>
                                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '14px 20px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'white', fontWeight: 600, fontSize: '1.1rem' }}>
                                            {proposedMerge.question}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>RESPOSTA UNIFICADA (MAIS COMPLETA)</div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '20px 24px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.15)', color: '#e2e8f0', lineHeight: 1.7, fontSize: '0.95rem' }}>
                                            {proposedMerge.answer}
                                        </div>
                                    </div>
                                    <p style={{ marginTop: '20px', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                        💡 Ao confirmar, este novo item será adicionado e os <strong>{proposedMerge.original_ids.length} itens originais serão removidos</strong> automaticamente.
                                    </p>
                                </div>
                                <div style={{ padding: '20px 32px', background: 'rgba(0,0,0,0.4)', display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button onClick={() => setProposedMerge(null)} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Revisar Originais</button>
                                    <button
                                        onClick={handleSaveMerge}
                                        disabled={mergingLoading}
                                        style={{ padding: '12px 28px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)', fontSize: '0.85rem' }}
                                    >
                                        {mergingLoading ? 'Salvando...' : 'CONFIRMAR E SUBSTITUIR'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* INFO & ACTIONS FOOTER */}
                        <div style={{
                            padding: '16px 32px',
                            background: 'rgba(0,0,0,0.3)',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '24px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px' }}>
                                    <span>💡</span> NOTA SOBRE A VARREDURA
                                </div>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1.5, maxWidth: '600px' }}>
                                    {scanMode === 'semantic' ? (
                                        <>O modo de <strong>Inteligência de IA</strong> está ativo, identificando tanto duplicatas exatas quanto conteúdos com o mesmo sentido semântico.</>
                                    ) : (
                                        <>Esta varredura utiliza <strong>Análise Determinística (Exata)</strong> para encontrar textos 100% idênticos. Ative o modo <strong>IA</strong> para uma análise profunda de sentido.</>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setDuplicateGroups(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#94a3b8',
                                    padding: '12px 32px',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Voltar para a Base
                            </button>
                        </div>

                        <style>{`
                            .duplicate-card:hover {
                                transform: translateY(-5px);
                                background: rgba(255,255,255,0.04) !important;
                                border-color: rgba(244, 63, 94, 0.3) !important;
                                box-shadow: 0 15px 30px rgba(0,0,0,0.2);
                            }
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                            @keyframes fadeInUp {
                                from { opacity: 0; transform: translateY(20px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                    </div>
                </div>,
                document.body
            )}
            {isTranscribing && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(7, 10, 20, 0.98)',
                    backdropFilter: 'blur(25px) saturate(180%)',
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: (transcriptionProgress < 100 || isCreatingRag) ? 'center' : 'flex-start',
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: 'white',
                    overflowY: 'auto'
                }}>

                    {/* PHASE 1: LOADING & PROGRESS */}
                    <div className="fade-in" style={{
                        maxWidth: '800px',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginBottom: transcriptionProgress < 100 ? '0' : '40px',
                        transition: 'all 0.5s ease'
                    }}>
                        <div style={{
                            position: 'relative',
                            width: transcriptionProgress < 100 ? '120px' : '60px',
                            height: transcriptionProgress < 100 ? '120px' : '60px',
                            marginBottom: '24px',
                            transition: 'all 0.5s ease'
                        }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: '3px solid rgba(99, 102, 241, 0.1)',
                                borderTopColor: transcriptionProgress < 100 ? '#6366f1' : '#10b981',
                                animation: transcriptionProgress < 100 ? 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite' : 'none'
                            }}></div>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: transcriptionProgress < 100 ? '2.5rem' : '1.5rem'
                            }}>
                                {transcriptionProgress < 100 ? '🎙️' : '✅'}
                            </div>
                        </div>

                        <h2 style={{
                            fontSize: transcriptionProgress < 100 ? '2.5rem' : '1.8rem',
                            fontWeight: 900,
                            marginBottom: '12px',
                            background: 'linear-gradient(to right, #fff, #94a3b8)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                            transition: 'all 0.5s ease'
                        }}>
                            {transcriptionProgress < 100 ? "Preparando seu Conteúdo..." : "Transcrição Concluída!"}
                        </h2>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px',
                            width: '100%',
                            maxWidth: '500px',
                            marginTop: '10px'
                        }}>
                            <div style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                height: '12px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{
                                    width: `${transcriptionProgress}%`,
                                    height: '100%',
                                    background: transcriptionProgress < 100 ? 'linear-gradient(90deg, #6366f1, #a855f7)' : '#10b981',
                                    transition: 'width 0.4s ease',
                                    boxShadow: transcriptionProgress < 100 ? '0 0 20px rgba(99, 102, 241, 0.5)' : '0 0 20px rgba(16, 185, 129, 0.5)'
                                }}></div>
                            </div>
                            <div style={{
                                color: transcriptionProgress < 100 ? '#6366f1' : '#10b981',
                                fontWeight: 900,
                                fontSize: '1.4rem',
                                letterSpacing: '1px'
                            }}>
                                {Math.round(transcriptionProgress)}%
                            </div>
                        </div>

                        <p style={{
                            color: '#94a3b8',
                            fontSize: '1.1rem',
                            marginTop: '20px',
                            maxWidth: '600px',
                            lineHeight: 1.6
                        }}>
                            {transcriptionProgress < 100
                                ? "Enviando e transcrevendo via AssemblyAI. Nossa IA está processando cada palavra com precisão cirúrgica..."
                                : "Excelente! O texto foi extraído com sucesso. Agora, escolha como deseja organizar este conhecimento."}
                        </p>
                    </div>

                    {/* PHASE 2: RAG CONFIGURATION (SHOWN ONLY AT 100%) */}
                    {transcriptionProgress === 100 && (
                        <div className="fade-in-up" style={{
                            background: '#0f172a',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '32px',
                            width: '100%',
                            maxWidth: '750px',
                            padding: '40px',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
                            textAlign: 'left',
                            marginBottom: '60px'
                        }}>
                            {/* Transcription Metrics Summary */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '24px' }}>
                                <div style={{ flex: 1, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Tempo</div>
                                    <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>{Math.floor(transcriptionMetrics.duration / 60)}m {Math.round(transcriptionMetrics.duration % 60)}s</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Tokens</div>
                                    <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>{transcriptionMetrics.tokens}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Custo Est.</div>
                                    <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>${transcriptionMetrics.cost_usd.toFixed(4)}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ fontSize: '2.5rem' }}>🎯</div>
                                <div>
                                    <h3 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Configurar Inteligência RAG</h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '5px 0 0 0' }}>Personalize como o robô deve consumir esta informação.</p>
                                </div>
                            </div>

                            {/* Transcription Result Preview */}
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ display: 'block', color: '#6366f1', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>📄 Conteúdo Transcrito</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => setShowMaximizedTranscription(true)}
                                            style={{
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                color: '#a5b4fc',
                                                borderRadius: '8px',
                                                padding: '4px 12px',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; }}
                                        >
                                            <span>⛶</span> MAXIMIZAR
                                        </button>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    color: '#cbd5e1',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.6,
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    position: 'relative'
                                }}>
                                    {transcriptionResult || "Nenhum texto detectado."}
                                </div>

                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <input
                                            type="text"
                                            placeholder="Nome do arquivo (ex: reuniao_vendas)"
                                            value={transcriptionFilename}
                                            onChange={e => setTranscriptionFilename(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '10px',
                                                padding: '10px 15px',
                                                color: 'white',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const element = document.createElement("a");
                                            const file = new Blob([transcriptionResult], { type: 'text/plain' });
                                            element.href = URL.createObjectURL(file);
                                            const finalName = (transcriptionFilename || `transcricao_${new Date().getTime()}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                                            element.download = `${finalName}.txt`;
                                            document.body.appendChild(element);
                                            element.click();
                                            document.body.removeChild(element);
                                        }}
                                        style={{
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            color: '#a5b4fc',
                                            borderRadius: '10px',
                                            padding: '10px 20px',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                            height: '42px'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <span>💾</span> BAIXAR (.TXT)
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                                <div
                                    className={`config-option ${ragConfig.extractQA ? 'active' : ''}`}
                                    onClick={() => setRagConfig(prev => ({ ...prev, extractQA: !prev.extractQA }))}
                                    style={{
                                        background: ragConfig.extractQA ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${ragConfig.extractQA ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'}`,
                                        padding: '24px', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                                    }}
                                >
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>❓</div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>Extrair Perguntas</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.4, marginTop: '8px' }}>Cria diálogos automáticos entre o robô e o conteúdo.</div>
                                    {ragConfig.extractQA && <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#6366f1', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900 }}>✓</div>}
                                </div>

                                <div
                                    className={`config-option ${ragConfig.extractChunks ? 'active' : ''}`}
                                    onClick={() => setRagConfig(prev => ({ ...prev, extractChunks: !prev.extractChunks }))}
                                    style={{
                                        background: ragConfig.extractChunks ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${ragConfig.extractChunks ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                                        padding: '24px', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                                    }}
                                >
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🧩</div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>Extrair Chunks</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.4, marginTop: '8px' }}>Mapeia o conhecimento em blocos atômicos.</div>
                                    {ragConfig.extractChunks && <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#10b981', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900 }}>✓</div>}
                                </div>

                                <div
                                    className={`config-option ${ragConfig.generateSummary ? 'active' : ''}`}
                                    onClick={() => setRagConfig(prev => ({ ...prev, generateSummary: !prev.generateSummary }))}
                                    style={{
                                        background: ragConfig.generateSummary ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${ragConfig.generateSummary ? '#a855f7' : 'rgba(255, 255, 255, 0.1)'}`,
                                        padding: '24px', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                                    }}
                                >
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✨</div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>Gerar Resumo IA</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.4, marginTop: '8px' }}>Cria um resumo executivo para consulta rápida do robô.</div>
                                    {ragConfig.generateSummary && <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#a855f7', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900 }}>✓</div>}
                                </div>
                            </div>

                            {ragConfig.extractChunks && (
                                <div className="fade-in" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Tamanho do Bloco</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <input
                                                    type="range" min="500" max="4000" step="100"
                                                    value={ragConfig.chunkSize}
                                                    onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                                                    style={{ flex: 1, accentColor: '#10b981' }}
                                                />
                                                <input
                                                    type="number"
                                                    value={ragConfig.chunkSize}
                                                    onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 0 }))}
                                                    style={{
                                                        width: '70px',
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        color: 'white',
                                                        fontWeight: 900,
                                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '4px 8px',
                                                        textAlign: 'center',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Sobreposição</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <input
                                                    type="range" min="0" max="2000" step="10"
                                                    value={ragConfig.chunkOverlap}
                                                    onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))}
                                                    style={{ flex: 1, accentColor: '#6366f1' }}
                                                />
                                                <input
                                                    type="number"
                                                    value={ragConfig.chunkOverlap}
                                                    onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 0 }))}
                                                    style={{
                                                        width: '70px',
                                                        background: 'rgba(99, 102, 241, 0.2)',
                                                        color: 'white',
                                                        fontWeight: 900,
                                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '4px 8px',
                                                        textAlign: 'center',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: '40px' }}>
                                <label style={{ display: 'block', color: '#818cf8', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>🏷️ Metadados do Conteúdo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Aula de Biologia, Módulo 01..."
                                    value={ragConfig.metadata}
                                    onChange={e => setRagConfig(prev => ({ ...prev, metadata: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '18px',
                                        padding: '18px 24px',
                                        color: 'white',
                                        fontSize: '1.1rem',
                                        outline: 'none',
                                        transition: 'all 0.3s'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => { setIsTranscribing(false); setSelectedVideoFile(null); }}
                                    style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateRag}
                                    disabled={isCreatingRag}
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '20px',
                                        fontWeight: 900,
                                        fontSize: '1.2rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 15px 35px rgba(16, 185, 129, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    {isCreatingRag ? (
                                        <>
                                            <div className="spin" style={{ width: '22px', height: '22px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                            Processando...
                                        </>
                                    ) : (
                                        <>🚀 Gerar Base de Conhecimento</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        .fade-in { animation: fadeIn 0.8s ease-out forwards; }
                        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                        .config-option { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                        .config-option:hover { transform: translateY(-4px); background: rgba(255,255,255,0.05); }
                        .config-option.active { transform: scale(1.02); }
                        .spin { animation: spin 1s linear infinite; }
                    `}</style>
                </div>,
                document.body
            )}


            {/* TRANSCRIPTION SUCCESS POPUP */}
            {showTranscriptionPopup && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 100000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        width: '100%',
                        maxWidth: '800px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>🎙️ Transcrição Concluída</h3>
                            <button onClick={() => setShowTranscriptionPopup(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ flex: 1, background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Duração</div>
                                    <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 900 }}>{Math.floor(transcriptionMetrics.duration / 60)}m {Math.round(transcriptionMetrics.duration % 60)}s</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Tokens</div>
                                    <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 900 }}>{transcriptionMetrics.tokens}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Custo Est.</div>
                                    <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 900 }}>${transcriptionMetrics.cost_usd.toFixed(4)}</div>
                                </div>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 20px 0' }}>
                                A Inteligência Artificial finalizou a leitura do seu arquivo. Abaixo está o texto extraído:
                            </p>
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '16px',
                                padding: '24px',
                                color: '#e2e8f0',
                                fontSize: '1.05rem',
                                lineHeight: 1.8,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-primary)'
                            }}>
                                {transcriptionResult || "Nenhum texto detectado na mídia."}
                            </div>
                        </div>
                        <div style={{ padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '16px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                            <button
                                onClick={() => setShowTranscriptionPopup(false)}
                                style={{ padding: '12px 24px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => {
                                    setShowTranscriptionPopup(false);
                                    setShowRagConfigPopup(true);
                                }}
                                style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)', transition: 'transform 0.2s' }}
                            >
                                🧠 Criar RAG
                            </button>
                            <button
                                onClick={(e) => {
                                    navigator.clipboard.writeText(transcriptionResult);
                                    const btn = e.currentTarget;
                                    const origText = btn.innerHTML;
                                    btn.innerHTML = "✅ Copiado!";
                                    btn.style.background = "#10b981";
                                    setTimeout(() => {
                                        btn.innerHTML = origText;
                                        btn.style.background = "#6366f1";
                                    }, 2000);
                                }}
                                style={{ padding: '12px 32px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)', transition: 'background 0.3s' }}
                            >
                                📋 Copiar Conteúdo
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MEDIA SELECTION MODAL */}
            {showMediaSelectionModal && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.95)',
                    backdropFilter: 'blur(15px)', zIndex: 100000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '32px', width: '100%', maxWidth: '500px',
                        padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📽️</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Selecione a Mídia</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Como você deseja enviar o conteúdo?</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <button
                                onClick={() => videoInputRef.current.click()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)',
                                    padding: '20px', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'left', color: 'white'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                            >
                                <div style={{ fontSize: '2rem' }}>🎬</div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Arquivo de Vídeo/Áudio</div>
                                    <div style={{ color: '#a5b4fc', fontSize: '0.85rem', marginTop: '4px' }}>MP4, MP3, WAV (Será transcrito usando IA)</div>
                                </div>
                            </button>

                            <button
                                onClick={() => textMediaInputRef.current.click()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                    padding: '20px', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'left', color: 'white'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                            >
                                <div style={{ fontSize: '2rem' }}>📄</div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Arquivo de Texto (.txt)</div>
                                    <div style={{ color: '#6ee7b7', fontSize: '0.85rem', marginTop: '4px' }}>Texto já pronto e transcrito</div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowMediaSelectionModal(false)}
                            style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* RAG CONFIGURATION POPUP */}
            {showRagConfigPopup && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.95)',
                    backdropFilter: 'blur(15px)',
                    zIndex: 100001,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '32px',
                        width: '100%',
                        maxWidth: '650px',
                        padding: '40px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎬</div>
                            <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>Processamento de Mídia</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Configure a importação com IA e a extração para a base de conhecimentos.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            <div
                                className={`config-option ${ragConfig.generateSummary ? 'active' : ''}`}
                                onClick={() => setRagConfig(prev => ({ ...prev, generateSummary: !prev.generateSummary }))}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    background: ragConfig.generateSummary ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${ragConfig.generateSummary ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'}`,
                                    padding: '12px 20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem' }}>📄</div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Gerar Resumo IA</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px' }}>Cria um resumo consolidado de todo o conteúdo.</div>
                                </div>
                            </div>

                            <div
                                className={`config-option ${ragConfig.extractQA ? 'active' : ''}`}
                                onClick={() => setRagConfig(prev => ({ ...prev, extractQA: !prev.extractQA }))}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    background: ragConfig.extractQA ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${ragConfig.extractQA ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'}`,
                                    padding: '12px 20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem' }}>❓</div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Extrair Perguntas</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px' }}>Cria pares de Pergunta/Resposta automáticos.</div>
                                </div>
                            </div>

                            <div
                                className={`config-option ${ragConfig.extractChunks ? 'active' : ''}`}
                                onClick={() => setRagConfig(prev => ({ ...prev, extractChunks: !prev.extractChunks }))}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    background: ragConfig.extractChunks ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${ragConfig.extractChunks ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                                    padding: '12px 20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem' }}>🧩</div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Extrair Chunks</div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px' }}>Divide em blocos de conhecimento puro.</div>
                                </div>
                            </div>
                        </div>

                        {ragConfig.extractChunks && (
                            <div className="fade-in" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Tamanho do Chunk (Chars)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="range" min="500" max="4000" step="100"
                                                value={ragConfig.chunkSize}
                                                onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                                                style={{ flex: 1, accentColor: '#10b981' }}
                                            />
                                            <input
                                                type="number"
                                                value={ragConfig.chunkSize}
                                                onChange={e => setRagConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 0 }))}
                                                style={{
                                                    width: '65px',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    color: 'white',
                                                    fontWeight: 800,
                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    borderRadius: '6px',
                                                    padding: '2px 5px',
                                                    textAlign: 'center',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Sobreposição (Overlay)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="range" min="0" max="2000" step="10"
                                                value={ragConfig.chunkOverlap}
                                                onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))}
                                                style={{ flex: 1, accentColor: '#818cf8' }}
                                            />
                                            <input
                                                type="number"
                                                value={ragConfig.chunkOverlap}
                                                onChange={e => setRagConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 0 }))}
                                                style={{
                                                    width: '65px',
                                                    background: 'rgba(129, 140, 248, 0.1)',
                                                    color: 'white',
                                                    fontWeight: 800,
                                                    border: '1px solid rgba(129, 140, 248, 0.2)',
                                                    borderRadius: '6px',
                                                    padding: '2px 5px',
                                                    textAlign: 'center',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-group" style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <label style={{ margin: 0, color: '#818cf8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Metadados Comuns</label>
                                <button
                                    type="button"
                                    onClick={() => setIsJsonModalOpen(true)}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {`{ JSON }`}
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {metadata.map((item, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            placeholder="Nome (Ex: categoria)"
                                            style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '0.95rem', outline: 'none' }}
                                            value={item.name}
                                            onChange={(e) => handleMetadataChange(index, 'name', e.target.value)}
                                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Conteúdo (Ex: Tecnologia)"
                                            style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '0.95rem', outline: 'none' }}
                                            value={item.content}
                                            onChange={(e) => handleMetadataChange(index, 'content', e.target.value)}
                                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeMetadataRow(index)}
                                            title="Remover"
                                            style={{ background: '#ef4444', color: '#fff', border: 'none', width: '42px', height: '42px', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', transition: 'background 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addMetadataRow}
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px dashed rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginTop: '16px', width: '100%', fontWeight: '600', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            >
                                + Adicionar Item Metadado
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setShowRagConfigPopup(false)}
                                style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateRag}
                                disabled={isCreatingRag}
                                style={{
                                    flex: 2,
                                    padding: '16px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                {isCreatingRag ? (
                                    <>
                                        <div className="spin" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                        Processando...
                                    </>
                                ) : (
                                    <>🚀 Gerar Base de Conhecimento</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* JSON IMPORT MODAL */}
            {isJsonModalOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.95)',
                    backdropFilter: 'blur(15px)', zIndex: 100002, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '24px', width: '100%', maxWidth: '500px',
                        padding: '32px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>Importar JSON</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '20px' }}>Cole abaixo o JSON contendo os metadados. Valores existentes serão substituídos ou mesclados.</p>
                        <textarea
                            style={{
                                width: '100%', height: '200px', fontFamily: 'monospace',
                                padding: '16px', background: 'rgba(255,255,255,0.03)', color: '#e2e8f0',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
                                outline: 'none', resize: 'vertical'
                            }}
                            placeholder={`{\n  "metadata": {\n    "exemplo1": "novoConteúdo"\n  }\n}`}
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            onFocus={e => e.target.style.borderColor = '#3b82f6'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button
                                type="button"
                                onClick={() => setIsJsonModalOpen(false)}
                                style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleJsonMerge}
                                style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                            >
                                Mesclar JSON
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* SUCCESS MODAL */}
            {showSuccessModal && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.9)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 1000000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '38px',
                        width: '100%',
                        maxWidth: '500px',
                        padding: '40px',
                        textAlign: 'center',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
                        animation: 'modalPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '90px',
                            height: '90px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3.5rem',
                            margin: '0 auto 24px auto',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.2)'
                        }}>
                            ✨
                        </div>
                        <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px' }}>RAG Criado com Sucesso!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '32px' }}>
                            O conteúdo foi processado, otimizado e já está disponível na sua Base de Conhecimento para o seu agente.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                width: '100%',
                                padding: '18px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '18px',
                                fontWeight: 900,
                                fontSize: '1.1rem',
                                cursor: 'pointer',
                                boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                        >
                            Excelente, Entendi!
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {isCreatingRag && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.98)',
                    backdropFilter: 'blur(25px) saturate(180%)',
                    zIndex: 1000005,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: 'white',
                }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '24px' }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(16, 185, 129, 0.1)', borderTopColor: '#10b981', animation: 'spin 1s linear infinite' }}></div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🚀</div>
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '10px', color: 'white' }}>Gerando sua Base com IA...</h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Mapeando conteúdos e criando chunks estratégicos.</p>
                </div>,
                document.body
            )}
            {showMaximizedTranscription && document.body && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 200000,
                        background: 'rgba(2, 6, 23, 0.85)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '40px'
                    }}
                    onClick={() => setShowMaximizedTranscription(false)}
                >
                    <div
                        style={{
                            background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: '32px',
                            width: '90%', maxWidth: '900px',
                            maxHeight: '85vh',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 30px 100px rgba(0,0,0,0.8)',
                            overflow: 'hidden',
                            animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '24px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>📄 Visualização Completa</h3>
                                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.8rem' }}>Conteúdo integral da transcrição processada.</p>
                            </div>
                            <button
                                onClick={() => setShowMaximizedTranscription(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                            >✕</button>
                        </div>
                        <div style={{ padding: '40px', overflowY: 'auto', flex: 1 }}>
                            <div style={{
                                color: '#e2e8f0',
                                fontSize: '1rem',
                                lineHeight: 1.8,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'Inter, system-ui, sans-serif'
                            }}>
                                {transcriptionResult}
                            </div>
                        </div>
                        <div style={{ padding: '24px 40px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                            <div style={{ flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    placeholder="Nome do arquivo personalizado..."
                                    value={transcriptionFilename}
                                    onChange={e => setTranscriptionFilename(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        padding: '12px 18px',
                                        color: 'white',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setShowMaximizedTranscription(false)}
                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '14px', padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}
                                >Fechar</button>
                                <button
                                    onClick={() => {
                                        const element = document.createElement("a");
                                        const file = new Blob([transcriptionResult], { type: 'text/plain' });
                                        element.href = URL.createObjectURL(file);
                                        const finalName = (transcriptionFilename || `transcricao_${new Date().getTime()}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                                        element.download = `${finalName}.txt`;
                                        document.body.appendChild(element);
                                        element.click();
                                        document.body.removeChild(element);
                                    }}
                                    style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '14px', padding: '12px 28px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)' }}
                                >💾 Baixar Arquivo</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isBulkEditOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.9)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 1000000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '38px',
                        width: '100%',
                        maxWidth: '700px',
                        padding: '40px',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 40px rgba(99, 102, 241, 0.1)',
                        animation: 'modalPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✏️</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Edição em Massa</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>Alterando {selectedItems.size} itens selecionados</p>
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                                🔄 Re-vetorização automática será aplicada
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontWeight: 800, marginBottom: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={bulkEditForm.useCategory}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, useCategory: e.target.checked }))}
                                        style={{ accentColor: '#6366f1', transform: 'scale(1.2)' }}
                                    />
                                    Alterar Categoria
                                </label>
                                {bulkEditForm.useCategory && (
                                    <input
                                        type="text"
                                        placeholder="Nova categoria..."
                                        value={bulkEditForm.category}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, category: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none' }}
                                    />
                                )}
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontWeight: 800, marginBottom: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={bulkEditForm.useMetadata}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, useMetadata: e.target.checked }))}
                                        style={{ accentColor: '#6366f1', transform: 'scale(1.2)' }}
                                    />
                                    Alterar {kbLabels.metadata}
                                </label>
                                {bulkEditForm.useMetadata && (
                                    <input
                                        type="text"
                                        placeholder={`Novo ${kbLabels.metadata}...`}
                                        value={bulkEditForm.metadata_val}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, metadata_val: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none' }}
                                    />
                                )}
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontWeight: 800, marginBottom: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={bulkEditForm.useQuestion}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, useQuestion: e.target.checked }))}
                                        style={{ accentColor: '#6366f1', transform: 'scale(1.2)' }}
                                    />
                                    Alterar {kbLabels.question} (Para todos os selecionados)
                                </label>
                                {bulkEditForm.useQuestion && (
                                    <textarea
                                        placeholder={`Nova ${kbLabels.question}...`}
                                        value={bulkEditForm.question}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, question: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                                    />
                                )}
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontWeight: 800, marginBottom: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={bulkEditForm.useAnswer}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, useAnswer: e.target.checked }))}
                                        style={{ accentColor: '#6366f1', transform: 'scale(1.2)' }}
                                    />
                                    Alterar {kbLabels.answer} (Para todos os selecionados)
                                </label>
                                {bulkEditForm.useAnswer && (
                                    <textarea
                                        placeholder={`Nova ${kbLabels.answer}...`}
                                        value={bulkEditForm.answer}
                                        onChange={e => setBulkEditForm(prev => ({ ...prev, answer: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none', minHeight: '100px', resize: 'vertical' }}
                                    />
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                style={{ flex: 1, padding: '16px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkUpdate}
                                disabled={isBulkUpdating || (!bulkEditForm.useCategory && !bulkEditForm.useMetadata && !bulkEditForm.useQuestion && !bulkEditForm.useAnswer)}
                                style={{
                                    flex: 2,
                                    padding: '16px',
                                    background: isBulkUpdating ? '#475569' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '18px',
                                    fontWeight: 900,
                                    cursor: isBulkUpdating ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
                                }}
                            >
                                {isBulkUpdating ? 'Atualizando...' : '✏️ Aplicar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isBulkSummarizeOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7, 10, 20, 0.9)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 1000000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '38px',
                        width: '100%',
                        maxWidth: '650px',
                        padding: '40px',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
                        animation: 'modalPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✨</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Resumo Inteligente</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>Sintetizando {selectedItems.size} itens selecionados</p>
                        </div>

                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'block', color: '#818cf8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Pergunta / Título do Resumo</label>
                                <textarea
                                    placeholder="Ex: Resumo Geral do Módulo 01..."
                                    value={bulkSummarizeForm.question}
                                    onChange={e => setBulkSummarizeForm(prev => ({ ...prev, question: e.target.value }))}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: 'white', outline: 'none', minHeight: '80px', resize: 'vertical', fontSize: '1rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <label style={{ display: 'block', color: '#818cf8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Metadado do Item</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Módulo 1..."
                                        value={bulkSummarizeForm.metadata_val}
                                        onChange={e => setBulkSummarizeForm(prev => ({ ...prev, metadata_val: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <label style={{ display: 'block', color: '#818cf8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Categoria</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Resumo..."
                                        value={bulkSummarizeForm.category}
                                        onChange={e => setBulkSummarizeForm(prev => ({ ...prev, category: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', outline: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                            <button
                                onClick={() => setIsBulkSummarizeOpen(false)}
                                style={{ flex: 1, padding: '18px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkSummarize}
                                disabled={isSummarizing || !bulkSummarizeForm.question.trim()}
                                style={{
                                    flex: 2,
                                    padding: '18px',
                                    background: isSummarizing ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '20px',
                                    fontWeight: 900,
                                    cursor: isSummarizing ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)'
                                }}
                            >
                                {isSummarizing ? 'Sintetizando...' : '✨ Gerar e Salvar Resumo'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* JSON BATCH IMPORT MODAL 1: INPUT */}
            {isJsonBatchModalOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.95)',
                    backdropFilter: 'blur(20px)', zIndex: 100003, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '32px', width: '100%', maxWidth: '600px',
                        padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📦</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Importar Lote JSON</h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Adicione múltiplos itens de uma vez à sua base de conhecimento.</p>
                        </div>

                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '6px', marginBottom: '24px' }}>
                            <button
                                onClick={() => setIsUploadMode(false)}
                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: !isUploadMode ? '#10b981' : 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                            >Texto Escrito</button>
                            <button
                                onClick={() => setIsUploadMode(true)}
                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: isUploadMode ? '#10b981' : 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                            >Upload de Arquivo</button>
                        </div>

                        {isUploadMode ? (
                            <div style={{
                                border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '40px', textAlign: 'center',
                                background: 'rgba(255,255,255,0.02)', cursor: 'pointer'
                            }} onClick={() => document.getElementById('json-file-input').click()}>
                                <input id="json-file-input" type="file" accept=".json" onChange={handleJsonFileChange} style={{ display: 'none' }} />
                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                                <p style={{ color: '#94a3b8', margin: 0 }}>{jsonBatchInput ? 'Arquivo carregado!' : 'Clique para selecionar o arquivo .json'}</p>
                            </div>
                        ) : (
                            <textarea
                                value={jsonBatchInput}
                                onChange={e => setJsonBatchInput(e.target.value)}
                                placeholder='{ "data": [ { "context": "...", "metadata": ["cat1"], "generate_questions": true } ] }'
                                style={{
                                    width: '100%', height: '250px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px', padding: '16px', color: 'white', fontFamily: 'monospace', outline: 'none', resize: 'none'
                                }}
                            />
                        )}

                        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                            <button
                                onClick={() => setIsJsonBatchModalOpen(false)}
                                style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                            >Cancelar</button>
                            <button
                                onClick={handleJsonBatchSubmit}
                                disabled={!jsonBatchInput.trim()}
                                style={{
                                    flex: 2, padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer',
                                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)', opacity: !jsonBatchInput.trim() ? 0.5 : 1
                                }}
                            >Continuar</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* JSON BATCH CONFIRMATION MODAL 2 */}
            {showJsonConfirmModal && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.95)',
                    backdropFilter: 'blur(20px)', zIndex: 100004, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '32px', width: '100%', maxWidth: '650px',
                        padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Confirmar Importação</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Identificamos <strong>{jsonParsedData?.length || 0}</strong> itens para processar.</p>
                        </div>

                        <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isGlobalConfigEnabled ? '20px' : 0 }}>
                                <div>
                                    <h4 style={{ color: 'white', margin: 0, fontSize: '1rem', fontWeight: 800 }}>Configurações Globais</h4>
                                    <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.8rem' }}>Aplicar as mesmas regras para todos os itens.</p>
                                </div>
                                <button
                                    onClick={() => setIsGlobalConfigEnabled(!isGlobalConfigEnabled)}
                                    style={{
                                        padding: '10px 20px', borderRadius: '12px', border: 'none',
                                        background: isGlobalConfigEnabled ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                        color: 'white', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >{isGlobalConfigEnabled ? 'Ativado' : 'Ativar'}</button>
                            </div>

                            {isGlobalConfigEnabled && (
                                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                    {/* Simplified RAG Config UI */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        <div onClick={() => setRagConfig(p => ({ ...p, extractQA: !p.extractQA }))} style={{ flex: '1 1 140px', padding: '12px', borderRadius: '12px', background: ragConfig.extractQA ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)', border: `1px solid ${ragConfig.extractQA ? '#10b981' : 'transparent'}`, cursor: 'pointer', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem' }}>❓</div>
                                            <div style={{ color: 'white', fontSize: '0.75rem', fontWeight: 800, marginTop: '4px' }}>Perguntas</div>
                                        </div>
                                        <div onClick={() => setRagConfig(p => ({ ...p, generateSummary: !p.generateSummary }))} style={{ flex: '1 1 140px', padding: '12px', borderRadius: '12px', background: ragConfig.generateSummary ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.2)', border: `1px solid ${ragConfig.generateSummary ? '#3b82f6' : 'transparent'}`, cursor: 'pointer', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem' }}>📄</div>
                                            <div style={{ color: 'white', fontSize: '0.75rem', fontWeight: 800, marginTop: '4px' }}>Resumo IA</div>
                                        </div>
                                        <div onClick={() => setRagConfig(p => ({ ...p, extractChunks: !p.extractChunks }))} style={{ flex: '1 1 140px', padding: '12px', borderRadius: '12px', background: ragConfig.extractChunks ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)', border: `1px solid ${ragConfig.extractChunks ? '#6366f1' : 'transparent'}`, cursor: 'pointer', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem' }}>🧩</div>
                                            <div style={{ color: 'white', fontSize: '0.75rem', fontWeight: 800, marginTop: '4px' }}>Chunks</div>
                                        </div>
                                    </div>
                                    {ragConfig.extractChunks && (
                                        <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800 }}>TAMANHO (CHARS)</label>
                                                <input type="number" value={ragConfig.chunkSize} onChange={e => setRagConfig(p => ({ ...p, chunkSize: parseInt(e.target.value) }))} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: 'white', marginTop: '4px' }} />
                                            </div>
                                            <div>
                                                <label style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800 }}>OVERLAY</label>
                                                <input type="number" value={ragConfig.chunkOverlap} onChange={e => setRagConfig(p => ({ ...p, chunkOverlap: parseInt(e.target.value) }))} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: 'white', marginTop: '4px' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setShowJsonConfirmModal(false)}
                                style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                            >Voltar</button>
                            <button
                                onClick={handleConfirmJsonBatch}
                                disabled={isProcessingJsonBatch}
                                style={{
                                    flex: 2, padding: '16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer',
                                    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {isProcessingJsonBatch ? (
                                    <>
                                        <div className="spin" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                        Iniciando...
                                    </>
                                ) : (
                                    <>🚀 Processar Todos os Arquivos</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {isAddDocsModalOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.8)',
                    backdropFilter: 'blur(20px)', zIndex: 100005, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '32px', width: '100%', maxWidth: '500px',
                        padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📂</div>
                            <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Adicionar Documentos</h2>
                            <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Escolha o método de importação</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button
                                onClick={() => { setIsAddDocsModalOpen(false); handlePasteText(); }}
                                style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '15px' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <span style={{ fontSize: '1.5rem' }}>📋</span>
                                <div>
                                    <div style={{ fontWeight: 800 }}>Colar Texto</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cole conteúdo manualmente ou de arquivos .txt</div>
                                </div>
                            </button>

                            <button
                                onClick={() => { setIsAddDocsModalOpen(false); handleImportClick(); }}
                                style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '15px' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <span style={{ fontSize: '1.5rem' }}>📊</span>
                                <div>
                                    <div style={{ fontWeight: 800 }}>Importar CSV / Excel</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Planilhas estruturadas com dados em lote</div>
                                </div>
                            </button>

                            <button
                                onClick={() => { setIsAddDocsModalOpen(false); fileInputRef.current.click(); }}
                                style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '15px' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <span style={{ fontSize: '1.5rem' }}>📄</span>
                                <div>
                                    <div style={{ fontWeight: 800 }}>Upload PDF/DOCX</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Arquivos de documentos para extração de RAG</div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setIsAddDocsModalOpen(false)}
                            style={{ width: '100%', marginTop: '32px', padding: '16px', background: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                        >Cancelar</button>
                    </div>
                </div>,
                document.body
            )}

            {isAddNewModalOpen && document.body && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(7, 10, 20, 0.9)',
                    backdropFilter: 'blur(20px)', zIndex: 100005, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="fade-in" style={{
                        background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '32px', width: '100%', maxWidth: '800px',
                        padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '8px', height: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div>
                                <h4 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Novo Conhecimento</h4>
                            </div>
                            <button
                                onClick={() => setIsAddNewModalOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer' }}
                            >✕</button>
                        </div>

                        <div className="form-row-kb">
                            <div className="form-group flex-2">
                                <ExpandableField
                                    label={kbLabels.question}
                                    placeholder={`Ex: ${kbLabels.question === 'Pergunta' ? 'Qual o horário de funcionamento?' : 'Digite aqui...'}`}
                                    value={newPair.question}
                                    onChange={(e) => setNewPair({ ...newPair, question: e.target.value })}
                                />
                            </div>
                            <div className="form-group flex-2">
                                <ExpandableField
                                    label={kbLabels.metadata}
                                    placeholder={`Ex: ${kbLabels.metadata === 'Metadado' ? 'PAINEL INICIAL | Chat' : 'Digite aqui...'}`}
                                    value={newPair.metadata_val}
                                    onChange={(e) => setNewPair({ ...newPair, metadata_val: e.target.value })}
                                />
                            </div>
                            <div className="form-group flex-1">
                                <label>Categoria</label>
                                <input
                                    type="text"
                                    value={newPair.category}
                                    onChange={e => setNewPair({ ...newPair, category: e.target.value })}
                                    placeholder="Geral, Preços, etc."
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white' }}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <ExpandableField
                                label={kbLabels.answer}
                                type="textarea"
                                placeholder={`Ex: ${kbLabels.answer === 'Resposta' ? 'O horário é...' : 'Digite o conteúdo...'}`}
                                value={newPair.answer}
                                onChange={(e) => setNewPair({ ...newPair, answer: e.target.value })}
                                style={{ minHeight: '200px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                            <button
                                onClick={() => setIsAddNewModalOpen(false)}
                                style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                            >Cancelar</button>
                            <button
                                onClick={() => {
                                    handleAddItem();
                                    setIsAddNewModalOpen(false);
                                }}
                                disabled={!newPair.question.trim() || !newPair.answer.trim()}
                                style={{
                                    flex: 2, padding: '18px', background: 'var(--accent-gradient)',
                                    color: 'white', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer',
                                    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
                                    opacity: (!newPair.question.trim() || !newPair.answer.trim()) ? 0.5 : 1
                                }}
                            >✨ Adicionar à Base</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default KnowledgeBaseManager;
