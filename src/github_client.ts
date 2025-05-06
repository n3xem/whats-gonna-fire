// GitHub APIのインターフェース定義
import { WorkflowAnalyzer } from './workflow_analyzer';
import { parseRepoUrl } from './common';

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

export class GitHubClient {
    /**
     * リポジトリの情報を取得
     */
    static async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) {
            throw new Error(`GitHub API エラー: ${response.status}`);
        }
        return await response.json() as RepoInfo;
    }

    /**
     * ワークフロー一覧を取得
     */
    static async getWorkflows(owner: string, repo: string): Promise<WorkflowsResponse> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`);
        if (!response.ok) {
            throw new Error(`GitHub API エラー: ${response.status}`);
        }
        return await response.json() as WorkflowsResponse;
    }

    /**
     * .github/workflows内のワークフローだけをフィルタリング
     */
    static filterWorkflows(workflows: WorkflowsResponse): FilteredWorkflows {
        const filteredWorkflows: FilteredWorkflows = {
            total_count: 0,
            workflows: []
        };

        if (workflows.workflows && workflows.workflows.length > 0) {
            filteredWorkflows.workflows = workflows.workflows.filter(workflow =>
                workflow.path.startsWith('.github/workflows/')
            );
            filteredWorkflows.total_count = filteredWorkflows.workflows.length;
        }

        return filteredWorkflows;
    }

    /**
     * ワークフローファイルの内容を取得
     */
    static async getWorkflowContent(
        owner: string,
        repo: string,
        workflow: WorkflowData,
        defaultBranch: string,
        index: number
    ): Promise<WorkflowWithContent> {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${defaultBranch}/${workflow.path}`;

        try {
            const response = await fetch(rawUrl);
            if (!response.ok) {
                throw new Error(`ファイル取得エラー: ${response.status}`);
            }
            const content = await response.text();

            return {
                workflow,
                content,
                index
            };
        } catch (error) {
            // ファイル取得のエラーハンドリング
            return {
                workflow,
                content: `ファイル内容の取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
                index,
                error: true
            };
        }
    }

    /**
     * リポジトリ内のすべてのワークフローとその内容を取得
     */
    static async getAllWorkflowsWithContent(url: string): Promise<WorkflowWithContent[] | null> {
        const repoInfo = parseRepoUrl(url);
        if (!repoInfo) {
            return null;
        }

        const { owner, repo } = repoInfo;
        console.log(`リポジトリ: ${owner}/${repo}`);

        try {
            // リポジトリの情報を取得してデフォルトブランチを確認
            const repoData = await this.getRepoInfo(owner, repo);
            const defaultBranch = repoData.default_branch || 'main';
            console.log(`デフォルトブランチ: ${defaultBranch}`);

            // ワークフロー情報を取得
            const workflowsData = await this.getWorkflows(owner, repo);

            // ワークフローをフィルタリング
            const filteredWorkflows = this.filterWorkflows(workflowsData);
            console.log(".github/workflows内のワークフロー一覧:");
            console.log(filteredWorkflows);

            if (filteredWorkflows.total_count === 0) {
                console.log("このリポジトリには.github/workflows内にワークフローが存在しません。");
                return [];
            }

            console.log(`合計: ${filteredWorkflows.total_count}件のワークフロー`);

            // 各ワークフローファイルの内容を取得して表示する
            const workflowsWithContent = await Promise.all(
                filteredWorkflows.workflows.map((workflow, index) =>
                    this.getWorkflowContent(owner, repo, workflow, defaultBranch, index)
                )
            );

            // ワークフローの解析を行い、トリガー条件を追加
            return workflowsWithContent.map(workflow => {
                const triggerAnalysis = WorkflowAnalyzer.isTriggeredOnDefaultBranchMerge(workflow, defaultBranch);
                return {
                    ...workflow,
                    triggerAnalysis
                };
            });
        } catch (error) {
            console.error("ワークフロー取得エラー:", error);
            return null;
        }
    }
} 
