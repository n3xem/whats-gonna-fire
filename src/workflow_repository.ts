// ワークフローデータの取得と管理を担当するリポジトリクラス
import { GitHubApiService } from './github_api_service';
import { WorkflowData, WorkflowWithContent } from './types';

export class WorkflowRepository {
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
        try {
            const content = await GitHubApiService.getRawFileContent(
                owner,
                repo,
                workflow.path,
                defaultBranch
            );

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
} 
