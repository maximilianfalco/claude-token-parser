export interface RawJSONLLine {
  parentUuid: string;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  slug?: string;
  type: "user" | "assistant" | "system" | "progress" | "file-history-snapshot" | "queue-operation";
  message: Record<string, unknown>;
  uuid: string;
  timestamp: string;
  agentId?: string;
}

export interface AssistantUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
  service_tier: string;
  inference_geo?: string;
}

export interface ParsedSession {
  sessionId: string;
  project: string;
  model: string;
  startedAt: string;
  endedAt: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  messageCount: number;
}

export interface DailyUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  sessionCount: number;
}

export interface WeeklyUsage {
  weekStart: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  sessionCount: number;
}

export interface MonthlyUsage {
  month: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  sessionCount: number;
}

export interface ProjectUsage {
  projectName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  sessionCount: number;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  sessionCount: number;
  daily: DailyUsage[];
  weekly: WeeklyUsage[];
  monthly: MonthlyUsage[];
  byProject: ProjectUsage[];
  byModel: ModelUsage[];
}

export interface DateRange {
  from: Date;
  to: Date;
}
