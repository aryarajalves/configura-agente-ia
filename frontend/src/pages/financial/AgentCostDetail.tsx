import React, { useState, useEffect, useCallback } from 'react';
import { getFinanceSummary, getAgentCostDetail, exportFinanceCSV } from '../../services/financeService';

/**
 * T028/T029 [US2]: Finance dashboard with summary, agent detail, and CSV export.
 */

const formatCurrency = (val) => {
  if (val == null) return '$0.00';
  return `$${Number(val).toFixed(4)}`;
};

const formatNumber = (val) => {
  if (val == null) return '0';
  return Number(val).toLocaleString('pt-BR');
};

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

const SERVICE_COLORS = {
  chat: '#6366f1',
  fine_tuning: '#f59e0b',
  ingestion: '#22c55e',
};

const AgentCostDetail = () => {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [summary, setSummary] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentDetail, setAgentDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFinanceSummary(startDate, endDate);
      setSummary(res.data || res);
    } catch (err) {
      setError(err.message || 'Erro ao carregar resumo financeiro');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleAgentSelect = async (agentId) => {
    setSelectedAgent(agentId);
    setDetailLoading(true);
    try {
      const res = await getAgentCostDetail(agentId, startDate, endDate);
      setAgentDetail(res.data || res);
    } catch (err) {
      setAgentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportFinanceCSV(startDate, endDate, selectedAgent || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance_export_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar CSV: ' + (err.message || 'Desconhecido'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrapper}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button style={styles.retryBtn} onClick={fetchSummary}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>💰 Análise de Custos</h1>
          <p style={styles.subtitle}>Dashboard financeiro granular por agente e tipo de serviço</p>
        </div>
        <button
          style={exporting ? { ...styles.exportBtn, opacity: 0.6 } : styles.exportBtn}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? '⏳ Exportando...' : '📥 Exportar CSV'}
        </button>
      </div>

      {/* Date Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <button style={styles.filterBtn} onClick={fetchSummary}>🔍 Filtrar</button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <>
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, borderTop: '4px solid #6366f1' }}>
              <p style={styles.cardLabel}>Custo Total</p>
              <p style={styles.cardValue}>{formatCurrency(summary.total_cost)}</p>
            </div>
            <div style={{ ...styles.summaryCard, borderTop: '4px solid #22c55e' }}>
              <p style={styles.cardLabel}>Total de Tokens</p>
              <p style={styles.cardValue}>{formatNumber(summary.total_tokens)}</p>
            </div>
            <div style={{ ...styles.summaryCard, borderTop: '4px solid #f59e0b' }}>
              <p style={styles.cardLabel}>Serviços Ativos</p>
              <p style={styles.cardValue}>{summary.by_service?.length || 0}</p>
            </div>
          </div>

          {/* Service Breakdown */}
          {summary.by_service && summary.by_service.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📊 Distribuição por Serviço</h2>
              <div style={styles.serviceGrid}>
                {summary.by_service.map((svc, idx) => (
                  <div key={idx} style={styles.serviceCard}>
                    <div style={styles.serviceHeader}>
                      <div
                        style={{
                          ...styles.serviceDot,
                          backgroundColor: SERVICE_COLORS[svc.service] || '#94a3b8',
                        }}
                      />
                      <span style={styles.serviceName}>
                        {svc.service === 'chat' ? '💬 Chat' :
                         svc.service === 'fine_tuning' ? '🔧 Fine-Tuning' :
                         svc.service === 'ingestion' ? '📥 Ingestão' : svc.service}
                      </span>
                    </div>
                    <p style={styles.serviceCost}>{formatCurrency(svc.cost)}</p>
                    <p style={styles.serviceTokens}>{formatNumber(svc.token_count)} tokens</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Trend */}
          {summary.daily_trend && summary.daily_trend.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📈 Tendência Diária</h2>
              <div style={styles.trendTable}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Data</th>
                      <th style={styles.th}>Custo</th>
                      <th style={styles.th}>Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.daily_trend.map((day, idx) => {
                      const maxCost = Math.max(...summary.daily_trend.map(d => d.cost));
                      const pct = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                      return (
                        <tr key={idx} style={styles.tr}>
                          <td style={styles.td}>{day.date}</td>
                          <td style={styles.td}>{formatCurrency(day.cost)}</td>
                          <td style={styles.td}>
                            <div style={styles.trendBar}>
                              <div
                                style={{
                                  ...styles.trendBarFill,
                                  width: `${pct}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!summary.by_service || summary.by_service.length === 0) && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📭</span>
              <p style={styles.emptyText}>
                Nenhum registro financeiro encontrado para o período selecionado.
              </p>
            </div>
          )}
        </>
      )}

      {/* Agent Detail Modal/Section */}
      {agentDetail && (
        <div style={styles.section}>
          <div style={styles.detailHeader}>
            <h2 style={styles.sectionTitle}>🤖 Detalhe do Agente</h2>
            <button style={styles.closeBtn} onClick={() => { setAgentDetail(null); setSelectedAgent(null); }}>✕</button>
          </div>
          <p style={styles.detailSummary}>
            Custo total: <strong>{formatCurrency(agentDetail.total_cost)}</strong>
          </p>
          {agentDetail.cost_by_skill && agentDetail.cost_by_skill.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Habilidade</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Tokens</th>
                  <th style={styles.th}>Custo</th>
                </tr>
              </thead>
              <tbody>
                {agentDetail.cost_by_skill.map((skill, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{skill.skill_name || skill.skill_id || '—'}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.typeBadge,
                        backgroundColor: SERVICE_COLORS[skill.type] ? `${SERVICE_COLORS[skill.type]}22` : '#f1f5f9',
                        color: SERVICE_COLORS[skill.type] || '#64748b',
                      }}>
                        {skill.type}
                      </span>
                    </td>
                    <td style={styles.td}>{formatNumber(skill.token_count)}</td>
                    <td style={styles.td}>{formatCurrency(skill.estimated_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.emptyText}>Nenhum dado de custo por habilidade nesse período.</p>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },
  exportBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  filters: { display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '28px', flexWrap: 'wrap', background: '#f8fafc', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel: { fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  dateInput: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  filterBtn: { padding: '9px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' },
  summaryCard: { background: '#fff', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  cardLabel: { fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' },
  cardValue: { fontSize: '30px', fontWeight: '700', color: '#1e293b', margin: 0 },
  section: { background: '#fff', borderRadius: '14px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' },
  serviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  serviceCard: { padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' },
  serviceHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  serviceDot: { width: '10px', height: '10px', borderRadius: '50%' },
  serviceName: { fontSize: '14px', fontWeight: '600', color: '#334155' },
  serviceCost: { fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: '0 0 2px' },
  serviceTokens: { fontSize: '13px', color: '#94a3b8', margin: 0 },
  trendTable: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', fontSize: '14px', color: '#334155' },
  trendBar: { height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', minWidth: '100px' },
  trendBarFill: { height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '4px', transition: 'width 0.4s ease' },
  loadingWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' },
  spinner: { width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { marginTop: '16px', color: '#64748b', fontSize: '14px' },
  errorBanner: { padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b', justifyContent: 'space-between' },
  retryBtn: { padding: '6px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyText: { fontSize: '15px', color: '#94a3b8', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: '#64748b' },
  detailSummary: { fontSize: '15px', color: '#334155', marginBottom: '16px' },
  typeBadge: { padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' },
};

export default AgentCostDetail;
