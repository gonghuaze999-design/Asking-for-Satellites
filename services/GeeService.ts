import { SatelliteResult } from "../types";
import { SentinelService } from "./SentinelService";

const API = '/api';

export class GeeService {
  private static initialized = false;
  private static currentProjectId = '';

  static isInitialized(): boolean {
    return this.initialized;
  }

  static async authenticateManual(token: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    SentinelService.log('INFO', 'Connecting to GEE Backend...');
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    if (data.status === 'ready') {
      this.initialized = true;
      SentinelService.log('SUCCESS', 'GEE Backend Connected.');
    } else {
      throw new Error('GEE Backend not ready');
    }
  }

  static async authenticate(clientId: string, projectId: string): Promise<void> {
    return this.authenticateManual('', projectId);
  }

  static async searchSentinel2(
    geometry: any,
    maxCloud: number,
    minCoverage: number,
    dateStart: string,
    dateEnd: string,
    logger?: (m: string) => void
  ): Promise<SatelliteResult[]> {
    if (!this.initialized) throw new Error("GEE Backend not connected.");
    logger?.('Querying Sentinel-2 via backend...');
    const res = await fetch(`${API}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geometry, cloudCover: maxCloud, minCoverage, dateStart, dateEnd })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Search failed');
    }
    const results = await res.json();
    logger?.(`Found ${results.length} scenes.`);
    return results;
  }

  static getOverlayMapId(imageId: string): Promise<string> {
    return fetch(`${API}/tile?id=${encodeURIComponent(imageId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        return data.tileUrl;
      });
  }

  static async generateSingleLocalUrl(
    imageId: string,
    sensingDate: string,
    algoId: string,
    geometry: any,
    experimentName: string
  ): Promise<{ url: string, fileName: string }> {
    if (!this.initialized) throw new Error("GEE Backend not connected.");
    const res = await fetch(`${API}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: imageId, geometry, algoId, experimentName, sensingDate })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Download failed');
    }
    return res.json();
  }

  static async startBatchExport(
    imageIds: string[],
    algoId: string,
    geometry: any,
    type: string,
    taskPrefix: string,
    onStepLog?: (msg: string) => void
  ): Promise<string[]> {
    if (!this.initialized) throw new Error("GEE Backend not connected.");
    const taskIds: string[] = [];
    for (const id of imageIds) {
      onStepLog?.(`Submitting export: ${id.split('/').pop()}`);
      const res = await fetch(`${API}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, geometry, algoId, type,
          projectId: this.currentProjectId,
          description: `${taskPrefix}_${id.split('/').pop()?.substring(0, 40)}`
        })
      });
      if (!res.ok) {
        const err = await res.json();
        onStepLog?.(`!! Export failed: ${err.error}`);
        continue;
      }
      const data = await res.json();
      onStepLog?.(`Task queued: ${data.taskId}`);
      taskIds.push(data.taskId);
      await new Promise(r => setTimeout(r, 500));
    }
    return taskIds;
  }
}
