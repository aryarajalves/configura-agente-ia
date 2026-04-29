import React, { useState, useEffect } from 'react';

const KnowledgeBaseSpreadsheet = ({ items, onSave, onCancel }) => {
    const [data, setData] = useState(items.length > 0 ? items : [{ question: '', answer: '', category: 'Geral' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');

    const handleCellChange = (index, field, value) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [field]: value };
        setData(newData);
    };

    const addRow = () => {
        setData([...data, { question: '', answer: '', category: 'Geral' }]);
    };

    const deleteRow = (index) => {
        setData(data.filter((_, i) => i !== index));
    };

    const handleClearAll = () => {
        if (window.confirm('Tem certeza que deseja limpar todas as linhas?')) {
            setData([{ question: '', answer: '', category: 'Geral' }]);
        }
    };

    const handleTogglePairs = () => {
        // Transforms a list of [Q1, Q2, Q3...] into [{q: Q1, a: Q2}, {q: Q3, a: Q4}...]
        // Useful when user pastes a single column list where Q and A alternate lines
        if (data.length < 2) return;
        const newData = [];
        for (let i = 0; i < data.length; i += 2) {
            if (data[i]) {
                newData.push({
                    question: data[i].question || data[i].answer,
                    answer: data[i + 1] ? (data[i + 1].question || data[i + 1].answer) : '',
                    category: data[i].category || 'Geral'
                });
            }
        }
        setData(newData);
    };

    const handlePaste = (e) => {
        const pasteData = e.clipboardData.getData('text');
        const isStructural = pasteData.includes('\t');

        // If focusing a textarea, and NOT a structural paste (no tabs), let it paste normally
        const isFocusedInInput = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';

        if (isStructural || !isFocusedInInput) {
            // Only split into rows if we have multiple lines AND we're not inside a specific cell
            // OR if it's a structural paste from Excel
            const rows = pasteData.split(/\r?\n/).filter(r => r.trim());
            if (rows.length > 1 || isStructural) {
                e.preventDefault();
                const newItems = rows.map(row => {
                    const cols = row.split('\t');
                    return {
                        question: (cols[0] || '').trim(),
                        answer: (cols[1] || '').trim(),
                        category: (cols[2] || 'Geral').trim()
                    };
                }).filter(item => item.question || item.answer);

                if (newItems.length > 0) {
                    setData(prev => {
                        if (prev.length === 1 && !prev[0].question && !prev[0].answer) return newItems;
                        return [...prev, ...newItems];
                    });
                }
            }
        }
    };

    const handleReplaceAll = () => {
        if (!searchTerm) return;
        const newData = data.map(item => ({
            ...item,
            question: item.question.replaceAll(searchTerm, replaceTerm),
            answer: item.answer.replaceAll(searchTerm, replaceTerm)
        }));
        setData(newData);
    };

    return (
        <div className="spreadsheet-view fade-in">
            <div className="spreadsheet-toolbar">
                <div className="tool-group">
                    <button onClick={addRow} className="tool-btn">➕ Adicionar Linha</button>
                    <button
                        onClick={() => onSave(data)}
                        className="tool-btn save"
                        style={{ background: 'var(--success-color)', color: 'white' }}
                    >
                        💾 Salvar Tudo
                    </button>
                    <button onClick={onCancel} className="tool-btn cancel">Cancelar</button>
                </div>

                <div className="tool-group find-replace">
                    <input
                        type="text"
                        placeholder="Localizar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Substituir por..."
                        value={replaceTerm}
                        onChange={e => setReplaceTerm(e.target.value)}
                    />
                    <button onClick={handleReplaceAll} className="replace-btn">🔄 Substituir Tudo</button>
                </div>

                <div className="paste-hint">
                    💡 Dica: Você pode <strong>Colar (Ctrl+V)</strong> dados do Excel ou Google Sheets aqui.
                </div>
            </div>

            <div className="table-container" onPaste={handlePaste}>
                <table className="spreadsheet-table">
                    <thead>
                        <tr>
                            <th width="50">#</th>
                            <th width="30%">Pergunta / Chave</th>
                            <th>Resposta / Conteúdo</th>
                            <th width="150">Categoria</th>
                            <th width="50"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, idx) => (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>
                                    <textarea
                                        value={item.question}
                                        onChange={e => handleCellChange(idx, 'question', e.target.value)}
                                        placeholder="Pergunta..."
                                    />
                                </td>
                                <td>
                                    <textarea
                                        value={item.answer}
                                        onChange={e => handleCellChange(idx, 'answer', e.target.value)}
                                        placeholder="Conteúdo..."
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        value={item.category || 'Geral'}
                                        onChange={e => handleCellChange(idx, 'category', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <button onClick={() => deleteRow(idx)} className="row-del-btn">✕</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                .spreadsheet-view {
                    background: #0f172a;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    height: 80vh;
                    overflow: hidden;
                    position: relative;
                }
                .spreadsheet-toolbar {
                    padding: 1rem;
                    background: rgba(30, 41, 59, 0.8);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                    align-items: center;
                }
                .tool-group { display: flex; gap: 0.5rem; }
                .tool-btn {
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.05);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.85rem;
                }
                .tool-btn:hover { background: rgba(255,255,255,0.1); }
                
                .find-replace {
                    background: rgba(15, 23, 42, 0.5);
                    padding: 0.3rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .find-replace input {
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.4rem 0.8rem;
                    font-size: 0.85rem;
                    width: 140px;
                }
                .replace-btn {
                    background: #6366f1;
                    color: white;
                    border: none;
                    padding: 0.4rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                }

                .paste-hint { font-size: 0.8rem; color: #94a3b8; }

                .table-container { flex: 1; overflow: auto; }
                .spreadsheet-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .spreadsheet-table th {
                    position: sticky;
                    top: 0;
                    background: #1e293b;
                    z-index: 10;
                    padding: 0.8rem;
                    text-align: left;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: #94a3b8;
                    border-bottom: 2px solid #334155;
                }
                .spreadsheet-table td {
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 0;
                }
                .spreadsheet-table textarea, .spreadsheet-table input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.8rem;
                    font-family: inherit;
                    font-size: 0.9rem;
                    resize: none;
                    display: block;
                }
                .spreadsheet-table textarea:focus, .spreadsheet-table input:focus {
                    background: rgba(99, 102, 241, 0.05);
                    outline: 1px solid #6366f1;
                    z-index: 1;
                }
                .row-del-btn {
                    background: transparent;
                    border: none;
                    color: #ef4444;
                    cursor: pointer;
                    width: 100%;
                    height: 100%;
                    opacity: 0.5;
                }
                .row-del-btn:hover { opacity: 1; background: rgba(239, 68, 68, 0.1); }
            `}</style>
        </div>
    );
};

export default KnowledgeBaseSpreadsheet;
