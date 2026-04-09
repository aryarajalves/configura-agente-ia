import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '../../services/auditService';

/**
 * T034/T035 [US3]: Filterable, paginated audit log view with deleted-user preservation.
 */

const ACTION_LABELS = {
  UPDATE_CONFIG: '⚙️ Configuração',
  LOCK_AGENT: '🔒 Bloquear',
  UNLOCK_AGENT: '🔓 Desbloquear',
  CREATE_AGENT: '➕ Criar Agente',
  DELETE_AGENT: '🗑️ Excluir Agente',
  UPDATE_SKILL: '🧠 Atualizar Habilidade',
  DELETE_USER: '👤 Excluir Usuário',
  UPDATE_SETTINGS: '⚙️ Config. Sistema',
};

const PAGE_SIZE = 20;

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        limit: PAGE_SIZE,
        offset,
      };
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      if (userId.trim()) filters.user_id = userId.trim();
      if (actionFilter) filters.action = actionFilter;

      const res = await getAuditLogs(filters);
      const responseData = res.data || res;

      setLogs(responseData.data || []);
      setPagination(responseData.pagination || { limit: PAGE_SIZE, offset, total: 0 });
    } catch (err) {
      setError(err.message || 'Erro ao carregar logs de auditoria');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userId, actionFilter]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const handleFilter = () => {
    fetchLogs(0);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setUserId('');
    setActionFilter('');
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, pagination.offset - PAGE_SIZE);
    fetchLogs(newOffset);
  };

  const handleNext = () => {
    const newOffset = pagination.offset + PAGE_SIZE;
    if (newOffset < pagination.total) {
      fetchLogs(newOffset);
    }
  };

  const currentPage = Math.floor(pagination.offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(pagination.total / PAGE_SIZE) || 1;

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const getActionBadge = (action) => {
    const label = ACTION_LABELS[action] || action;
    const colors = {
      UPDATE_CONFIG: { bg: '#ede9fe', color: '#6d28d9' },
      LOCK_AGENT: { bg: '#fee2e2', color: '#991b1b' },
      UNLOCK_AGENT: { bg: '#d1fae5', color: '#065f46' },
      CREATE_AGENT: { bg: '#dbeafe', color: '#1e40af' },
      DELETE_AGENT: { bg: '#fef2f2', color: '#b91c1c' },
      DELETE_USER: { bg: '#fef2f2', color: '#b91c1c' },
      UPDATE_SKILL: { bg: '#fef3c7', color: '#92400e' },
      UPDATE_SETTINGS: { bg: '#e0e7ff', color: '#3730a3' },
    };
    const c = colors[action] || { bg: '#f1f5f9', color: '#475569' };
    return (
      <span style={{ ...styles.badge, backgroundColor: c.bg, color: c.color }}>
        {label}
      </span>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📋 Logs de Auditoria</h1>
        <p style={styles.subtitle}>Registro cronológico de ações da equipe com filtros avançados</p>
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>ID do Usuário</label>
          <input
            type="text"
            placeholder="UUID..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Ação</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={styles.filterInput}
          >
            <option value="">Todas</option>
            <option value="UPDATE_CONFIG">Configuração</option>
            <option value="LOCK_AGENT">Bloquear</option>
            <option value="UNLOCK_AGENT">Desbloquear</option>
            <option value="CREATE_AGENT">Criar Agente</option>
            <option value="DELETE_AGENT">Excluir Agente</option>
            <option value="UPDATE_SKILL">Atualizar Habilidade</option>
            <option value="DELETE_USER">Excluir Usuário</option>
            <option value="UPDATE_SETTINGS">Config. Sistema</option>
          </select>
        </div>
        <div style={styles.filterActions}>
          <button style={styles.filterBtn} onClick={handleFilter}>🔍 Filtrar</button>
          <button style={styles.clearBtn} onClick={handleClearFilters}>Limpar</button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button style={styles.retryBtn} onClick={() => fetchLogs(0)}>Tentar novamente</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={styles.loadingWrapper}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Carregando logs...</p>
        </div>
      )}

      {/* Table */}
      {!loading && logs.length > 0 && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data/Hora</th>
                <th style={styles.th}>Usuário</th>
                <th style={styles.th}>Ação</th>
                <th style={styles.th}>Entidade</th>
                <th style={styles.th}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.id || idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>
                    <span style={styles.timestamp}>{formatTimestamp(log.timestamp)}</span>
                  </td>
                  <td style={styles.td}>
                    {/* T035: Deleted-user display preservation */}
                    {log.deleted_user_display ? (
                      <span style={styles.deletedUser}>
                        {log.deleted_user_display}
                      </span>
                    ) : (
                      <span style={styles.userId}>
                        {log.superadmin_id ? log.superadmin_id.substring(0, 8) + '...' : '—'}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {getActionBadge(log.action)}
                  </td>
                  <td style={styles.td}>
                    <div>
                      {log.target_entity_type && (
                        <span style={styles.entityType}>{log.target_entity_type}</span>
                      )}
                      {log.target_entity_id && (
                        <span style={styles.entityId}>
                          {log.target_entity_id.substring(0, 8)}...
                        </span>
                      )}
                      {!log.target_entity_type && !log.agent_id && '—'}
                      {!log.target_entity_type && log.agent_id && (
                        <span style={styles.entityId}>Agente: {log.agent_id.substring(0, 8)}...</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {(log.previous_state || log.new_state) ? (
                      <details style={styles.details}>
                        <summary style={styles.detailsSummary}>Ver alterações</summary>
                        <div style={styles.stateContainer}>
                          {log.previous_state && (
                            <div style={styles.stateBlock}>
                              <span style={styles.stateLabel}>Anterior:</span>
                              <pre style={styles.statePre}>
                                {JSON.stringify(log.previous_state, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_state && (
                            <div style={styles.stateBlock}>
                              <span style={styles.stateLabel}>Novo:</span>
                              <pre style={styles.statePre}>
                                {JSON.stringify(log.new_state, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <span style={styles.noDetails}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State (T035) */}
      {!loading && logs.length === 0 && !error && (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🔍</span>
          <p style={styles.emptyTitle}>Nenhum registro encontrado</p>
          <p style={styles.emptyText}>
            {(startDate || endDate || userId || actionFilter)
              ? 'Tente ajustar os filtros ou limpar a busca para ver todos os logs.'
              : 'Ainda não há ações registradas no sistema de auditoria.'}
          </p>
          {(startDate || endDate || userId || actionFilter) && (
            <button style={styles.clearBtn} onClick={handleClearFilters}>Limpar Filtros</button>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.total > 0 && (
        <div style={styles.pagination}>
          <button
            style={pagination.offset <= 0 ? { ...styles.pageBtn, opacity: 0.4 } : styles.pageBtn}
            onClick={handlePrev}
            disabled={pagination.offset <= 0}
          >
            ← Anterior
          </button>
          <span style={styles.pageInfo}>
            Página {currentPage} de {totalPages} ({pagination.total} registros)
          </span>
          <button
            style={pagination.offset + PAGE_SIZE >= pagination.total ? { ...styles.pageBtn, opacity: 0.4 } : styles.pageBtn}
            onClick={handleNext}
            disabled={pagination.offset + PAGE_SIZE >= pagination.total}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },

  filterBar: { display: 'flex', alignItems: 'flex-end', gap: '14px', marginBottom: '24px', padding: '16px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' },
  filterLabel: { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' },
  filterInput: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff' },
  filterActions: { display: 'flex', gap: '8px', alignItems: 'flex-end' },
  filterBtn: { padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  clearBtn: { padding: '8px 14px', background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },

  errorBanner: { padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b', marginBottom: '16px', justifyContent: 'space-between' },
  retryBtn: { padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },

  loadingWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' },
  spinner: { width: '36px', height: '36px', border: '4px solid #e2e8f0', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { marginTop: '14px', color: '#64748b', fontSize: '14px' },

  tableWrapper: { overflowX: 'auto', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' },
  trEven: { borderBottom: '1px solid #f1f5f9' },
  trOdd: { borderBottom: '1px solid #f1f5f9', background: '#fafbfc' },
  td: { padding: '12px 16px', fontSize: '13px', color: '#334155', verticalAlign: 'top' },

  timestamp: { fontSize: '13px', color: '#475569', fontFamily: "'JetBrains Mono', monospace" },
  userId: { fontSize: '12px', color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace" },
  deletedUser: { fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '2px 8px', borderRadius: '4px', fontStyle: 'italic' },
  badge: { padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  entityType: { fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', marginRight: '6px', textTransform: 'capitalize' },
  entityId: { fontSize: '11px', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" },

  details: { cursor: 'pointer' },
  detailsSummary: { fontSize: '12px', color: '#6366f1', fontWeight: '600', cursor: 'pointer', userSelect: 'none' },
  stateContainer: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' },
  stateBlock: { display: 'flex', flexDirection: 'column', gap: '2px' },
  stateLabel: { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  statePre: { fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '8px', borderRadius: '6px', margin: 0, overflow: 'auto', maxHeight: '120px', border: '1px solid #e2e8f0' },
  noDetails: { color: '#cbd5e1' },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 6px' },
  emptyText: { fontSize: '14px', color: '#94a3b8', textAlign: 'center', maxWidth: '420px', margin: '0 0 16px' },

  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', padding: '16px' },
  pageBtn: { padding: '8px 18px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  pageInfo: { fontSize: '13px', color: '#64748b' },
};

export default AuditLogPage;
