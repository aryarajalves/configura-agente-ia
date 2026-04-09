/**
 * Monitoring Service - API client for system health and settings endpoints.
 */
import { API_URL } from '../config';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SystemMetrics {
  disk_usage_percent: number;
  memory_usage_percent: number;
  disk_available_bytes: number;
  memory_available_bytes: number;
  timestamp: string;
}

export interface SystemSettings {
  retention_period_days: number;
  storage_threshold_alert: number;
  last_cleanup_timestamp: string;
  updated_by: string;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  retention_period_days?: number;
  storage_threshold_alert?: number;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${API_URL}/v1/system/metrics`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch system metrics');
  return res.json();
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_URL}/v1/system/settings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch system settings');
  return res.json();
}

export async function updateSystemSettings(data: SystemSettingsUpdate): Promise<{ success: boolean; data: SystemSettings }> {
  const res = await fetch(`${API_URL}/v1/system/settings`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update system settings');
  return res.json();
}
