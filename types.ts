
export enum AppTab {
  DATA_SEARCH = 'DATA_SEARCH',
  TASK_MANAGEMENT = 'TASK_MANAGEMENT',
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
  error?: string; // New field for detailed error tracking
}

export interface SatelliteResult {
  id: string;
  thumbnail: string;
  date: string;
  cloudCover: number;
  tileId: string;
  bounds: number[][];
  metadata: {
    platform: string;
    dataLevel: string;
    resolution: string;
    bands: string;
    processingBaseline: string;
    orbitNumber: string;
    sensingTime: string;
    orbitDirection: string;
    relativeOrbit: string;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  payload?: any;
}
