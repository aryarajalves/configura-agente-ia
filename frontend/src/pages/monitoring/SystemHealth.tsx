import React, { useState, useEffect, useCallback } from 'react';
import { getSystemMetrics, getSystemSettings, updateSystemSettings } from '../../services/monitoringService';

/**
 * T024 [US1]: System health and retention settings dashboard.
 */

const REFRESH_INTERVAL = 30000; // 30s auto-refresh

const SystemHealth = () => {
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editRetention, setEditRetention] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([getSystemMetrics(), getSystemSettings()]);
      setMetrics(m);
      if (s.data) {
        setSettings(s.data);
        setEditRetention(String(s.data.retention_period_days));
        setEditThreshold(String(s.data.storage_threshold_alert));
      } else {
        setSettings(s);
        setEditRetention(String(s.retention_period_days));
        setEditThreshold(String(s.storage_threshold_alert));
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await updateSystemSettings({
        retention_period_days: parseInt(editRetention, 10),
        storage_threshold_alert: parseInt(editThreshold, 10),
      });
      const updated = res.data || res;
      setSettings(updated);
      setSaveMessage('✅ Configurações salvas com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('❌ Erro ao salvar: ' + (err.message || 'Desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const getUsageColor = (percent) => {
    if (percent >= 90) return '#ef4444';
    if (percent >= 70) return '#f59e0b';
    return '#22c55e';
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrapper}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Carregando métricas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
          <button style={styles.retryBtn} onClick={fetchData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🖥️ Saúde do Sistema</h1>
        <p style={styles.subtitle}>Monitoramento em tempo real do contêiner Docker</p>
      </div>

      {/* Metrics Cards */}
      <div style={styles.metricsGrid}>
        {metrics && (
          <>
            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricIcon}>💾</span>
                <span style={styles.metricLabel}>Disco</span>
              </div>
              <div style={styles.metricValue}>
                <span style={{ color: getUsageColor(metrics.disk_usage_percent) }}>
                  {metrics.disk_usage_percent.toFixed(1)}%
                </span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.min(metrics.disk_usage_percent, 100)}%`,
                    backgroundColor: getUsageColor(metrics.disk_usage_percent),
                  }}
                />
              </div>
              <p style={styles.metricDetail}>
                Disponível: {formatBytes(metrics.disk_available_bytes)}
              </p>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricIcon}>🧠</span>
                <span style={styles.metricLabel}>Memória</span>
              </div>
              <div style={styles.metricValue}>
                <span style={{ color: getUsageColor(metrics.memory_usage_percent) }}>
                  {metrics.memory_usage_percent.toFixed(1)}%
                </span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.min(metrics.memory_usage_percent, 100)}%`,
                    backgroundColor: getUsageColor(metrics.memory_usage_percent),
                  }}
                />
              </div>
              <p style={styles.metricDetail}>
                Disponível: {formatBytes(metrics.memory_available_bytes)}
              </p>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricIcon}>🕒</span>
                <span style={styles.metricLabel}>Última Atualização</span>
              </div>
              <div style={styles.metricValueSmall}>
                {metrics.timestamp ? new Date(metrics.timestamp).toLocaleString('pt-BR') : '—'}
              </div>
              <p style={styles.metricDetail}>Atualização automática a cada 30s</p>
            </div>
          </>
        )}
      </div>

      {/* Settings Form */}
      <div style={styles.settingsCard}>
        <h2 style={styles.settingsTitle}>⚙️ Políticas de Governança</h2>
        <div style={styles.settingsGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Período de Retenção (dias)</label>
            <input
              type="number"
              min="1"
              value={editRetention}
              onChange={(e) => setEditRetention(e.target.value)}
              style={styles.input}
            />
            <p style={styles.hint}>
              Logs de auditoria e dados temporários mais antigos serão removidos automaticamente.
            </p>
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Alerta de Armazenamento (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={editThreshold}
              onChange={(e) => setEditThreshold(e.target.value)}
              style={styles.input}
            />
            <p style={styles.hint}>
              Alerta será gerado quando o uso de disco atingir este percentual.
            </p>
          </div>
        </div>
        <div style={styles.settingsFooter}>
          <button
            style={saving ? { ...styles.saveBtn, opacity: 0.6 } : styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          {saveMessage && <span style={styles.saveMessage}>{saveMessage}</span>}
        </div>

        {settings && settings.last_cleanup_timestamp && (
          <div style={styles.cleanupInfo}>
            <span style={styles.cleanupIcon}>🧹</span>
            Última limpeza: {new Date(settings.last_cleanup_timestamp).toLocaleString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Inline styles ---
const styles = {
  container: { padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { marginBottom: '32px' },
  title: { fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },
  loadingWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' },
  spinner: { width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { marginTop: '16px', color: '#64748b', fontSize: '14px' },
  errorBanner: { padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b' },
  errorIcon: { fontSize: '20px' },
  retryBtn: { marginLeft: 'auto', padding: '6px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' },
  metricCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  metricHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  metricIcon: { fontSize: '22px' },
  metricLabel: { fontSize: '14px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  metricValue: { fontSize: '36px', fontWeight: '700', marginBottom: '12px' },
  metricValueSmall: { fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' },
  progressBar: { height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' },
  metricDetail: { fontSize: '13px', color: '#94a3b8', margin: 0 },
  settingsCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  settingsTitle: { fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' },
  settingsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '14px', fontWeight: '600', color: '#334155' },
  input: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' },
  hint: { fontSize: '12px', color: '#94a3b8', margin: 0 },
  settingsFooter: { display: 'flex', alignItems: 'center', gap: '16px' },
  saveBtn: { padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' },
  saveMessage: { fontSize: '14px', fontWeight: '500' },
  cleanupInfo: { marginTop: '20px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' },
  cleanupIcon: { fontSize: '16px' },
};

export default SystemHealth;
