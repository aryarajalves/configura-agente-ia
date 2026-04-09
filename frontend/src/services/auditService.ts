/**
 * Audit Service - API client for audit log endpoints.
 */
import { API_URL } from '../config';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuditLogEntry {
  id: string;
  agent_id: string;
  superadmin_id: string;
  action: string;
  target_entity_type: string;
  target_entity_id: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  timestamp: string;
  deleted_user_display: string | null;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface AuditLogFilters {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.action) params.set('action', filters.action);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const res = await fetch(`${API_URL}/v1/audit?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}
