export interface SkillStatusResponse {
  skill_id: string;
  status: 'draft' | 'active' | 'archived';
  active_version_id?: string;
  version_status?: 'processing' | 'active' | 'attention' | 'error';
  last_processed_at?: string;
}

export const skillStatusService = {
  /**
   * Polls the skill status endpoint
   * @param skillId UUID of the skill
   */
  async getStatus(skillId: string): Promise<SkillStatusResponse> {
    const response = await fetch(`/api/v1/skills/${skillId}/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch skill status');
    }
    return response.json();
  },

  /**
   * Sets up an interval to poll skill status
   */
  subscribeToStatus(
    skillId: string, 
    onUpdate: (status: SkillStatusResponse) => void,
    onError: (error: any) => void,
    intervalMs: number = 3000
  ): () => void {
    const interval = setInterval(async () => {
      try {
        const status = await this.getStatus(skillId);
        onUpdate(status);
        // Stop polling if we reached a terminal state
        if (status.version_status === 'active' || status.version_status === 'error' || status.version_status === 'attention') {
          clearInterval(interval);
        }
      } catch (err) {
        onError(err);
      }
    }, intervalMs);

    // Initial fetch
    this.getStatus(skillId).then(onUpdate).catch(onError);

    return () => clearInterval(interval);
  }
};
