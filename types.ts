
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
}

export interface SatelliteResult {
  id: string;
  thumbnail: string;
  date: string;
  cloudCover: number;
  tileId: string;
  bounds: number[][];
  metadata: {
    platform: string;           // e.g. Sentinel-2A
    dataLevel: string;          // e.g. Level-2A (SR)
    resolution: string;         // e.g. 10m
    bands: string;              // e.g. B4, B3, B2 (RGB)
    processingBaseline: string; // e.g. 05.10
    orbitNumber: string;        // e.g. 105
    sensingTime: string;        // Detailed timestamp
    orbitDirection: string;     // DESCENDING / ASCENDING
    relativeOrbit: string;      // Relative orbit number
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  payload?: any;
}
