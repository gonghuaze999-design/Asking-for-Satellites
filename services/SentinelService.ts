
import { LogEntry } from "../types";

interface SystemState {
  geeInitialized: boolean;
  projectId: string;
  lastError: any;
  networkStatus: string;
  origin: string;
}

export class SentinelService {
  private static logs: LogEntry[] = [];
  private static state: SystemState = {
    geeInitialized: false,
    projectId: '',
    lastError: null,
    networkStatus: 'STABLE',
    origin: window.location.origin
  };

  static log(level: LogEntry['level'], message: string, payload?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      payload
    };
    this.logs.push(entry);
    if (level === 'ERROR') {
      this.state.lastError = payload || message;
      this.state.networkStatus = 'CRITICAL';
    }
    console.debug(`[SENTINEL] ${level}: ${message}`, payload || '');
  }

  static updateState(updates: Partial<SystemState>) {
    this.state = { ...this.state, ...updates };
  }

  static generateFixPromptForAI(): string {
    const report = {
      issue: "GEE_AUTH_RUNTIME_FAILURE",
      current_origin: window.location.origin,
      project_id: this.state.projectId,
      is_https: window.location.protocol === 'https:',
      last_error: this.state.lastError,
      recent_logs: this.logs.slice(-10),
      lib_state: {
        window_ee: !!(window as any).ee,
        window_ee_data: !!((window as any).ee && (window as any).ee.data)
      }
    };

    return `### [DEVELOPER_REPAIR_PROTOCOL]
I am experiencing a persistent GEE authentication failure. 
Status: ${JSON.stringify(this.state.lastError)}

Diagnostic Context:
\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

Based on this:
1. If 'window_ee_data' is false, fix the script loading order in index.tsx.
2. If it's a 403 origin_mismatch, confirm the origin is whitelisted.
3. If it's a Project ID issue, check Earth Engine API status.
Please provide the corrected file (GeeService.ts or index.tsx).`;
  }

  static getHistory() { return this.logs; }
  static getState() { return this.state; }
}
