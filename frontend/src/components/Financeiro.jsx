import { api } from '../api/client';

import React, { useState, useEffect, useMemo } from 'react';
const USD_BRL = 5.8;

function Financeiro() {
    const [report, setReport] = useState({ items: [], grand_total_cost: 0 });
    const [ftJobs, setFtJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('7d'); // 'today', '7d', '30d', 'custom'
    const [viewMode, setViewMode] = useState('agents'); // 'agents' | 'finetuning'
    const [customDates, setCustomDates] = useState({ start: '', end: '' });

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const getLocalDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getPeriodBounds = () => {
        const today = new Date();
        let end = getLocalDateString(today);
        let start = '';
        if (period === 'today') {
            start = end;
        } else if (period === '7d') {
            const d = new Date(); d.setDate(d.getDate() - 7);
            start = getLocalDateString(d);
        } else if (period === '30d') {
            const d = new Date(); d.setDate(d.getDate() - 30);
            start = getLocalDateString(d);
        } else if (period === 'custom') {
            start = customDates.start;
            end = customDates.end;
        }
        return { start, end };
    };

    const fetchReport = async () => {
        setLoading(true);
        const { start, end } = getPeriodBounds();
        const params = new URLSearchParams();
        if (start) params.append('start_date', start);
        if (end) params.append('end_date', end);

        try {
            const [reportRes, jobsRes] = await Promise.all([
                api.get(`/financial/report?${params.toString()}`),
                api.get('/fine-tuning/jobs')
            ]);
            const reportData = await reportRes.json().catch(() => null);
            const jobsData = await jobsRes.json().catch(() => null);

            // Null-safe fallbacks: API may return null, error object, or valid data
            const safeReport = reportData && Array.isArray(reportData.items)
                ? reportData
                : { items: [], grand_total_cost: 0 };
            const safeJobs = Array.isArray(jobsData) ? jobsData : [];

            setReport(safeReport);
            setFtJobs(safeJobs);
        } catch (e) {
            console.error("Erro ao carregar relatório:", e);
            setReport({ items: [], grand_total_cost: 0 });
            setFtJobs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        setCurrentPage(1); // Reset page on period change
    }, [period, customDates.start, customDates.end]);

    // Calcula custo real do job em BRL com base em trained_tokens
    const calcJobCostBrl = (job) => {
        if (!job.trained_tokens) return 0;
        const pricePerM = job.model?.includes('gpt-3.5') ? 8 : 3;
        return (job.trained_tokens / 1_000_000) * pricePerM * USD_BRL;
    };

    // Filtra jobs concluídos dentro do período
    const ftJobsInPeriod = useMemo(() => {
        const { start, end } = getPeriodBounds();
        return ftJobs.filter(j => {
            if (j.status !== 'succeeded' || !j.finished_at) return false;
            const jobDate = getLocalDateString(new Date(j.finished_at * 1000));
            if (start && jobDate < start) return false;
            if (end && jobDate > end) return false;
            return true;
        });
    }, [ftJobs, period, customDates]);

    // Converte jobs em "linhas" de fine-tuning para a tabela
    const ftRows = useMemo(() => ftJobsInPeriod.map(j => ({
        date: getLocalDateString(new Date(j.finished_at * 1000)),
        agent_name: `Fine-Tuning (${j.model?.replace('gpt-4o-mini-2024-07-18', 'gpt-4o-mini') || 'modelo'})`,
        total_messages: 0,
        total_tokens: j.trained_tokens || 0,
        total_cost: calcJobCostBrl(j),
        avg_cost_per_message: 0,
        unique_sessions: 0,
        isFtJob: true,
        jobId: j.id,
    })), [ftJobsInPeriod]);

    const ftTotalCost = ftRows.reduce((s, r) => s + r.total_cost, 0);

    // Seleciona quais dados mostrar baseado no filtro
    const activeRowsData = useMemo(() => {
        return viewMode === 'agents' ? report.items : ftRows;
    }, [viewMode, report.items, ftRows]);

    const activeTotalCost = useMemo(() => {
        return viewMode === 'agents' ? report.grand_total_cost : ftTotalCost;
    }, [viewMode, report.grand_total_cost, ftTotalCost]);

    // Ranking: Top 3 do modo selecionado
    const ranking = useMemo(() => {
        const agentCosts = {};
        activeRowsData.forEach(item => {
            const name = item.agent_name || "Excluído";
            agentCosts[name] = (agentCosts[name] || 0) + item.total_cost;
        });
        return Object.entries(agentCosts)
            .map(([name, cost]) => ({ name, cost }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 3);
    }, [activeRowsData]);

    // Dados para o gráfico do modo selecionado
    const chartData = useMemo(() => {
        const dailyTotals = {};
        activeRowsData.forEach(item => {
            dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.total_cost;
        });
        return Object.entries(dailyTotals)
            .map(([date, cost]) => ({ date, cost }))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-7);
    }, [activeRowsData]);

    const maxChartCost = Math.max(...chartData.map(d => d.cost), 0.01);

    // Itens da tabela filtrados e ordenados
    const allTableRows = useMemo(() => {
        return [...activeRowsData].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [activeRowsData]);

    // Paginação
    const totalPages = Math.ceil(allTableRows.length / rowsPerPage);
    const paginatedRows = useMemo(() => {
        const startIdx = (currentPage - 1) * rowsPerPage;
        return allTableRows.slice(startIdx, startIdx + rowsPerPage);
    }, [allTableRows, currentPage, rowsPerPage]);

    if (loading) {
        return (
            <div className="financeiro-container fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div style={{
                        margin: '0 auto 1.5rem',
                        width: '60px',
                        height: '60px',
                        border: '5px solid rgba(99, 102, 241, 0.2)',
                        borderTopColor: '#6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <h2 style={{ color: '#818cf8', fontSize: '1.8rem', marginBottom: '0.5rem', margin: 0 }}>Atualizando dados...</h2>
                    <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>Sincronizando estatísticas financeiras e uso de I.A.</p>
                </div>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="financeiro-container fade-in">
            <header className="dashboard-header-flex">
                <div>
                    <h1>Financeiro 💰</h1>
                    <p className="subtitle">Controle de gastos e inteligência de tokens</p>

                    <div className="view-mode-toggle">
                        <button
                            className={viewMode === 'agents' ? 'active' : ''}
                            onClick={() => { setViewMode('agents'); setCurrentPage(1); }}
                        >
                            🤖 Agentes
                        </button>
                        <button
                            className={viewMode === 'finetuning' ? 'active' : ''}
                            onClick={() => { setViewMode('finetuning'); setCurrentPage(1); }}
                        >
                            🧠 Fine-Tuning
                        </button>
                    </div>
                </div>
                <div className="period-selector">
                    <button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>Hoje</button>
                    <button className={period === '7d' ? 'active' : ''} onClick={() => setPeriod('7d')}>7 dias</button>
                    <button className={period === '30d' ? 'active' : ''} onClick={() => setPeriod('30d')}>30 dias</button>
                    <div className="custom-picker">
                        <input type="date" value={customDates.start} onChange={e => { setPeriod('custom'); setCustomDates({ ...customDates, start: e.target.value }) }} />
                        <span>até</span>
                        <input type="date" value={customDates.end} onChange={e => { setPeriod('custom'); setCustomDates({ ...customDates, end: e.target.value }) }} />
                    </div>
                </div>
            </header>

            {allTableRows.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3.5rem' }}>💸</div>
                    <h2 style={{ margin: 0, color: '#e2e8f0', fontWeight: 700, fontSize: '1.6rem' }}>Nenhum gasto registrado ainda</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', maxWidth: '380px' }}>
                        Quando seus agentes começarem a responder mensagens, os custos aparecerão aqui.
                    </p>
                </div>
            ) : (<>
            <div className="finance-top-layout">
                {/* Gráfico de Tendência */}
                <div className="chart-section">
                    <h3>Tendência de Gastos (Últimos 7 registros)</h3>
                    <div className="bar-chart">
                        {chartData.length === 0 ? (
                            <div className="no-data">Sem dados para o período</div>
                        ) : (
                            chartData.map((d, i) => (
                                <div key={i} className="chart-bar-container">
                                    <div className="bar-value">R$ {d.cost.toFixed(2)}</div>
                                    <div
                                        className="bar-fill"
                                        style={{ height: `${(d.cost / maxChartCost) * 100}%` }}
                                        title={`${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}: R$ ${d.cost.toFixed(4)}`}
                                    ></div>
                                    <div className="bar-label">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Ranking e Totais */}
                <div className="side-stats">
                    <div className="grand-total-card" style={{ background: viewMode === 'finetuning' ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <span className="label">Total {viewMode === 'agents' ? 'Agentes' : 'Fine-Tuning'}</span>
                        <span className="value">R$ {activeTotalCost.toFixed(2)}</span>
                    </div>

                    <div className="ranking-card">
                        <h3>🏆 Top 3 {viewMode === 'agents' ? 'Agentes' : 'Modelos'}</h3>
                        {ranking.length === 0 ? (
                            <p className="empty">Nenhuma atividade</p>
                        ) : (
                            ranking.map((agente, idx) => (
                                <div key={idx} className="ranking-item">
                                    <div className="rank-name">
                                        <span className="rank-num">{idx + 1}º</span>
                                        {agente.name}
                                    </div>
                                    <span className="rank-cost">R$ {agente.cost.toFixed(2)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="stats-row" style={{ marginTop: '2rem' }}>
                <div className="financial-card-full">
                    <div className="table-header">
                        <span>Data</span>
                        <span>Agente / Operação</span>
                        <span style={{ textAlign: 'center' }} title="Conversas Únicas">👥 Chats</span>
                        <span style={{ textAlign: 'center' }}>Msgs</span>
                        <span style={{ textAlign: 'center' }}>Tokens</span>
                        <span style={{ textAlign: 'right' }}>Média/Msg</span>
                        <span style={{ textAlign: 'right' }}>Custo Total</span>
                    </div>
                    <div className="table-body">
                        {paginatedRows.map((item, index) => (
                            <div key={index} className={`table-row ${item.isFtJob ? 'ft-job-row-fin' : ''}`}>
                                <div className="date-cell">
                                    <span className="calendar-icon">{item.isFtJob ? '🚀' : '📅'}</span>
                                    {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </div>
                                <div className="agent-cell" title={item.agent_name}>
                                    <span className="agent-icon">{item.isFtJob ? '🧠' : '🤖'}</span>
                                    {item.agent_name}
                                </div>
                                <div className="conv-cell" style={{ textAlign: 'center', color: '#a78bfa', fontWeight: 'bold' }}>
                                    {item.isFtJob ? '—' : (item.unique_sessions || 0)}
                                </div>
                                <div className="msg-cell" style={{ textAlign: 'center' }}>
                                    {item.isFtJob ? '—' : item.total_messages}
                                </div>
                                <div className="token-cell">
                                    {item.total_tokens ? item.total_tokens.toLocaleString() : '—'}
                                </div>
                                <div className="avg-cell">
                                    {item.isFtJob ? '—' : `R$ ${item.avg_cost_per_message.toFixed(4)}`}
                                </div>
                                <div className="cost-cell">
                                    R$ {item.total_cost.toFixed(4)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer com Paginação */}
                    {allTableRows.length > 0 && (
                        <div className="table-footer-pagination">
                            <div className="rows-per-page">
                                <span>Mostrar:</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(parseInt(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div className="pagination-controls">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="p-btn"
                                >
                                    Anterior
                                </button>
                                <span className="p-info">Página <strong>{currentPage}</strong> de {totalPages || 1}</span>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="p-btn"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </>)}

            <style>{`
                .financeiro-container { padding: 2rem; }
                
                .dashboard-header-flex {
                    margin-bottom: 3.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .dashboard-header-flex h1 {
                    margin-bottom: 0.8rem;
                    margin-top: 0;
                }
                .subtitle {
                    margin-bottom: 2rem;
                    opacity: 0.7;
                    font-size: 0.95rem;
                    display: block;
                }

                .view-mode-toggle {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    background: rgba(15, 23, 42, 0.4);
                    padding: 4px;
                    border-radius: 12px;
                    width: fit-content;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .view-mode-toggle button {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    padding: 8px 16px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 700;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .view-mode-toggle button.active {
                    background: rgba(99, 102, 241, 0.2);
                    color: white;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                }
                .view-mode-toggle button:hover:not(.active) {
                    color: white;
                    background: rgba(255,255,255,0.05);
                }
                
                /* Period Selector */
                .period-selector {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    background: rgba(30, 41, 59, 0.4);
                    padding: 0.5rem;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .period-selector button {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                }
                .period-selector button.active {
                    background: #6366f1;
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .custom-picker {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-left: 0.5rem;
                    padding-left: 1rem;
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    color: #475569;
                    font-size: 0.8rem;
                }
                .custom-picker input {
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 0.3rem 0.5rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                }

                .finance-top-layout {
                    display: grid;
                    grid-template-columns: 1fr 350px;
                    gap: 2rem;
                    margin-top: 2rem;
                }

                /* Chart Style */
                .chart-section {
                    background: rgba(30, 41, 59, 0.4);
                    border-radius: 20px;
                    padding: 2rem;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    flex-direction: column;
                }
                .chart-section h3 { margin-top: 0; font-size: 1.1rem; margin-bottom: 2rem; opacity: 0.8; }
                .bar-chart {
                    height: 250px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-around;
                    gap: 1rem;
                    padding-top: 2rem;
                }
                .chart-bar-container {
                    flex: 1;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 0.8rem;
                }
                .bar-fill {
                    width: 40px;
                    background: linear-gradient(to top, #6366f1, #818cf8);
                    border-radius: 6px 6px 0 0;
                    min-height: 4px;
                    transition: height 1s ease-out;
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
                }
                .bar-fill:hover {
                    filter: brightness(1.2);
                    transform: scaleY(1.02);
                }
                .bar-value { font-size: 0.75rem; font-weight: 700; color: #818cf8; }
                .bar-label { font-size: 0.7rem; opacity: 0.5; }

                /* Side Cards */
                .side-stats { display: flex; flex-direction: column; gap: 1.5rem; }
                .grand-total-card {
                    background: linear-gradient(135deg, #10b981, #059669);
                    padding: 2rem;
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
                }
                .grand-total-card .label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; opacity: 0.9; }
                .grand-total-card .value { font-size: 2.2rem; font-weight: 800; margin-top: 0.5rem; }
                .ft-cost-badge {
                    margin-top: 0.6rem;
                    font-size: 0.75rem;
                    background: rgba(0,0,0,0.2);
                    padding: 4px 10px;
                    border-radius: 20px;
                    opacity: 0.9;
                    letter-spacing: 0.3px;
                }

                .ranking-card {
                    background: rgba(30, 41, 59, 0.4);
                    padding: 1.5rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .ranking-card h3 { font-size: 1rem; margin-top: 0; margin-bottom: 1.2rem; }
                .ranking-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.8rem 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .ranking-item:last-child { border: none; }
                .rank-name { display: flex; align-items: center; gap: 0.8rem; font-weight: 600; font-size: 0.9rem; }
                .rank-num {
                    background: rgba(99, 102, 241, 0.2);
                    color: #818cf8;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-size: 0.75rem;
                }
                .rank-cost { font-weight: 700; color: #10b981; font-size: 0.95rem; }

                /* Table Updates */
                .financial-card-full {
                    width: 100%;
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    overflow: hidden;
                }
                .table-header {
                    display: grid;
                    grid-template-columns: 0.9fr 1.5fr 0.6fr 0.5fr 0.8fr 1fr 1fr;
                    padding: 1.5rem 2rem;
                    background: rgba(15, 23, 42, 0.5);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    font-weight: 600;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .table-row {
                    display: grid;
                    grid-template-columns: 0.9fr 1.5fr 0.6fr 0.5fr 0.8fr 1fr 1fr;
                    padding: 1.2rem 2rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
                    align-items: center;
                    transition: background 0.2s;
                }
                .ft-job-row-fin {
                    background: rgba(99, 102, 241, 0.04);
                    border-left: 3px solid rgba(99, 102, 241, 0.4);
                }
                .ft-job-row-fin .agent-cell { color: #a78bfa; }
                .ft-job-row-fin .cost-cell { color: #a78bfa !important; }
                .date-cell, .agent-cell {
                    display: flex; align-items: center; gap: 0.8rem; font-weight: 500; font-size: 0.9rem;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .msg-cell { font-weight: 600; color: #e2e8f0; }
                .token-cell { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #818cf8; }
                .avg-cell { text-align: right; font-size: 0.9rem; font-weight: 600; color: #f59e0b; }
                .cost-cell { text-align: right; font-weight: 700; color: #10b981; }
                .loading-table { padding: 4rem; text-align: center; color: #6366f1; font-weight: 600; }

                .table-footer-pagination {
                    padding: 1.2rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(15, 23, 42, 0.3);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .rows-per-page {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    font-size: 0.85rem;
                    color: #94a3b8;
                }
                .rows-per-page select {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 0.3rem 0.6rem;
                    border-radius: 6px;
                    outline: none;
                    cursor: pointer;
                }
                .pagination-controls {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }
                .p-btn {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    color: #818cf8;
                    padding: 0.5rem 1.2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 700;
                    transition: all 0.2s;
                }
                .p-btn:hover:not(:disabled) {
                    background: #6366f1;
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .p-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                    filter: grayscale(1);
                }
                .p-info {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }
                .p-info strong { color: white; }
            `}</style>
        </div>
    );
}

export default Financeiro;
