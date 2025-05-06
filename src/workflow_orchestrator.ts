// 各サービスを調整するオーケストレーターファサード
import { parseRepoUrl } from './common';
import { GitHubApiService } from './github_api_service';
import { WorkflowFilter } from './workflow_filter';
import { WorkflowRepository } from './workflow_repository';
import { WorkflowAnalyzer } from './workflow_analyzer';
import { WorkflowWithContent } from './types';

/**
 * GitHub Workflowに関する操作を統合的に管理するオーケストレーター
 */
export class WorkflowOrchestrator {
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
            const repoData = await GitHubApiService.getRepoInfo(owner, repo);
            const defaultBranch = repoData.default_branch || 'main';
            console.log(`デフォルトブランチ: ${defaultBranch}`);

            // ワークフロー情報を取得
            const workflowsData = await GitHubApiService.getWorkflows(owner, repo);

            // ワークフローをフィルタリング
            const filteredWorkflows = WorkflowFilter.filterGitHubWorkflows(workflowsData);
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
                    WorkflowRepository.getWorkflowContent(owner, repo, workflow, defaultBranch, index)
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
