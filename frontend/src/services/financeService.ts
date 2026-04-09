/**
 * Finance Service - API client for cost analysis endpoints.
 */
import { API_URL } from '../config';

const BASE = `${API_URL}/v1/finance`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface FinanceSummary {
  total_cost: number;
  total_tokens: number;
  by_service: Array<{ service: string; cost: number; token_count: number }>;
  daily_trend: Array<{ date: string; cost: number }>;
}

export interface AgentCostDetail {
  agent_id: string;
  agent_name: string;
  cost_by_skill: Array<{
    skill_id: string;
    skill_name: string;
    type: string;
    token_count: number;
    estimated_cost: number;
  }>;
  total_cost: number;
}

export async function getFinanceSummary(startDate: string, endDate: string): Promise<FinanceSummary> {
  const res = await fetch(`${BASE}/summary?start_date=${startDate}&end_date=${endDate}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch finance summary');
  return res.json();
}

export async function getAgentCostDetail(agentId: string, startDate: string, endDate: string): Promise<AgentCostDetail> {
  const res = await fetch(`${BASE}/agent/${agentId}?start_date=${startDate}&end_date=${endDate}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch agent cost detail');
  return res.json();
}

export async function exportFinanceCSV(startDate: string, endDate: string, agentId?: string): Promise<Blob> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (agentId) params.set('agent_id', agentId);
  const res = await fetch(`${BASE}/export?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to export CSV');
  return res.blob();
}
