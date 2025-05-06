// GitHub APIのインターフェース定義
import * as yaml from 'js-yaml';

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
}

export class GitHubClient {
    /**
     * リポジトリURLからownerとrepo名を抽出
     */
    static parseRepoUrl(url: string): { owner: string; repo: string } | null {
        const urlMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!urlMatch) {
            console.log("GitHubリポジトリURLの解析に失敗しました。");
            return null;
        }

        return {
            owner: urlMatch[1],
            repo: urlMatch[2]
        };
    }

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
        const repoInfo = this.parseRepoUrl(url);
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
                const triggerAnalysis = this.isTriggeredOnDefaultBranchMerge(workflow, defaultBranch);
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

    /**
     * ワークフローのYAMLを解析し、デフォルトブランチへのマージでトリガーされるか検証する
     * @param workflow ワークフローとその内容
     * @param defaultBranch デフォルトブランチ名
     * @returns トリガー条件の解析結果
     */
    static isTriggeredOnDefaultBranchMerge(
        workflow: WorkflowWithContent,
        defaultBranch: string
    ): WorkflowTriggerAnalysis {
        // エラーがある場合は解析不可
        if (workflow.error) {
            return {
                isTriggeredOnDefaultBranch: false,
                triggerEvents: [],
                triggerBranches: []
            };
        }

        try {
            // YAMLを解析
            const workflowYaml = yaml.load(workflow.content) as any;
            if (!workflowYaml || !workflowYaml.on) {
                return {
                    isTriggeredOnDefaultBranch: false,
                    triggerEvents: [],
                    triggerBranches: []
                };
            }

            const triggerEvents: string[] = [];
            const triggerBranches: string[] = [];
            let isTriggeredOnDefaultBranch = false;

            // トリガーイベントの解析
            const onTrigger = workflowYaml.on;

            // 文字列の場合（例: on: push）
            if (typeof onTrigger === 'string') {
                triggerEvents.push(onTrigger);
                // 単純なpushの場合はすべてのブランチが対象なのでデフォルトブランチも含まれる
                if (onTrigger === 'push') {
                    isTriggeredOnDefaultBranch = true;
                    triggerBranches.push('*');
                }
            }
            // 配列の場合（例: on: [push, pull_request]）
            else if (Array.isArray(onTrigger)) {
                onTrigger.forEach(event => {
                    triggerEvents.push(event);
                    // 配列内の単純なpushイベントもすべてのブランチが対象
                    if (event === 'push') {
                        isTriggeredOnDefaultBranch = true;
                        triggerBranches.push('*');
                    }
                });
            }
            // オブジェクトの場合（例: on: { push: { branches: [main] } }）
            else if (typeof onTrigger === 'object') {
                // 各イベントタイプを処理
                for (const eventType in onTrigger) {
                    triggerEvents.push(eventType);
                    const eventConfig = onTrigger[eventType];

                    // pull_request系イベントの処理
                    if (
                        (eventType === 'pull_request' ||
                            eventType === 'pull_request_target') &&
                        this.checkBranchesInConfig(eventConfig, defaultBranch, triggerBranches)
                    ) {
                        isTriggeredOnDefaultBranch = true;
                    }

                    // pushイベントの処理
                    if (eventType === 'push') {
                        // 設定がない場合はすべてのブランチが対象
                        if (!eventConfig) {
                            isTriggeredOnDefaultBranch = true;
                            triggerBranches.push('*');
                            continue;
                        }

                        // ブランチ指定がある場合
                        if (this.checkBranchesInConfig(eventConfig, defaultBranch, triggerBranches)) {
                            isTriggeredOnDefaultBranch = true;
                        }
                    }
                }
            }

            return {
                isTriggeredOnDefaultBranch,
                triggerEvents,
                triggerBranches
            };
        } catch (error) {
            console.error(`ワークフロー解析エラー (${workflow.workflow.name}):`, error);
            return {
                isTriggeredOnDefaultBranch: false,
                triggerEvents: [],
                triggerBranches: []
            };
        }
    }

    /**
     * イベント設定内のブランチ指定を確認
     * @param eventConfig イベント設定オブジェクト
     * @param defaultBranch デフォルトブランチ名
     * @param triggerBranches 検出したブランチ名を格納する配列（副作用）
     * @returns デフォルトブランチが含まれるかどうか
     */
    private static checkBranchesInConfig(
        eventConfig: any,
        defaultBranch: string,
        triggerBranches: string[]
    ): boolean {
        // 設定がない場合
        if (!eventConfig) {
            return false;
        }

        // branches指定がある場合
        if (eventConfig.branches) {
            const branches = this.normalizeBranchesConfig(eventConfig.branches);
            branches.forEach(branch => triggerBranches.push(branch));

            // デフォルトブランチが明示的に含まれているか
            if (branches.includes(defaultBranch)) {
                return true;
            }

            // ワイルドカードパターンの確認
            for (const pattern of branches) {
                if (
                    pattern === '*' ||
                    pattern === '**' ||
                    pattern.endsWith('/**') ||
                    (pattern.includes('*') && this.matchWildcard(defaultBranch, pattern))
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * ブランチ設定を正規化（文字列または配列に変換）
     */
    private static normalizeBranchesConfig(branches: any): string[] {
        if (typeof branches === 'string') {
            return [branches];
        } else if (Array.isArray(branches)) {
            return branches;
        }
        return [];
    }

    /**
     * 簡易的なワイルドカードマッチング
     */
    private static matchWildcard(str: string, pattern: string): boolean {
        // GitHubのワイルドカードパターンを正規表現に変換
        const regexPattern = pattern
            .replace(/\*/g, '.*')  // * を .* に変換
            .replace(/\?/g, '.')   // ? を . に変換

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(str);
    }
} 
