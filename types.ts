
export enum AppTab {
  DATA_SEARCH = 'DATA_SEARCH',
  TASK_MANAGEMENT = 'TASK_MANAGEMENT',
  AI_PROCESS = 'AI_PROCESS',
  API_CONSOLE = 'API_CONSOLE'
}

export interface Task {
  id: string;
  name: string;
  type: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING';
  progress: number;
  startTime: string;
  estRemaining?: string;
  error?: string;
}

export interface SatelliteResult {
  id: string;
  thumbnail: string;
  date: string;
  cloudCover: number;
  tileId: string;
  bounds: number[][];
  localPath?: string;
  metadata: {
    platform: string;
    sensingTime: string;
    dataLevel?: string;
    resolution?: string;
    bands?: string;
    processingBaseline?: string;
    orbitNumber?: string;
    orbitDirection?: string;
    relativeOrbit?: string;
    fullId?: string;
    cloudCover?: string;
    mgrs?: string;
    dataDate?: string;
    sunAzimuth?: number;
    sunElevation?: number;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  payload?: any;
}

export interface AIWorkflowNode {
  id: string;
  label: string;
  type: 'INPUT' | 'PROCESS' | 'ANALYSIS' | 'OUTPUT';
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  linkedAlgoId?: string;
  customOutputPath?: string;
}

export interface AIProcessTask {
  id: string;
  name: string;
  nodes: AIWorkflowNode[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: string;
}
