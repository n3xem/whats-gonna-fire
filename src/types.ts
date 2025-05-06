// GitHub APIの型定義

export interface WorkflowData {
    name: string;
    path: string;
    state: string;
    created_at: string;
    updated_at: string;
    html_url: string;
}

export interface WorkflowsResponse {
    total_count: number;
    workflows: WorkflowData[];
}

export interface RepoInfo {
    default_branch: string;
}

export interface FilteredWorkflows {
    total_count: number;
    workflows: WorkflowData[];
}

export interface WorkflowWithContent {
    workflow: WorkflowData;
    content: string;
    index: number;
    error?: boolean;
    triggerAnalysis?: WorkflowTriggerAnalysis;
    analysis?: string; // OpenAIによる分析結果
}

/**
 * ワークフローのトリガー条件の解析結果
 */
export interface WorkflowTriggerAnalysis {
    isTriggeredOnDefaultBranch: boolean;
    triggerEvents: string[];
    triggerBranches: string[];
    triggerPaths: string[];
} 
