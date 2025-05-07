import { WorkflowWithContent } from './types';
import { WorkflowOrchestrator } from './workflow_orchestrator';
import { getCachedWorkflows, cacheWorkflows } from './cache';
import { convertPRUrlToRepoUrl } from './common';

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getWorkflowsData' && request.url) {
        // ワークフローデータを取得してレスポンスを返す
        getMergeTriggeredWorkflowsData(request.url)
            .then(data => {
                sendResponse({ data });
            })
            .catch(error => {
                console.error("ワークフロー取得エラー:", error);
                sendResponse({ error: error.message });
            });

        // 非同期レスポンスのために true を返す
        return true;
    }
});

// マージ時に実行されるワークフローデータを取得する関数（ストレージ→GitHubの順）
async function getMergeTriggeredWorkflowsData(prUrl: string): Promise<WorkflowWithContent[]> {
    // ストレージからデータを取得
    const repoUrl = convertPRUrlToRepoUrl(prUrl);
    if (!repoUrl) {
        throw new Error("リポジトリURLの解析に失敗しました");
    }
    const cachedData = await getCachedWorkflows(repoUrl);

    // キャッシュが有効な場合はそれを返す
    if (cachedData) {
        console.log("キャッシュからワークフローデータを取得しました");
        // マージ時に実行されるワークフローのみをフィルタリング
        return cachedData.data.filter(item =>
            item.triggerAnalysis && item.triggerAnalysis.isTriggeredOnDefaultBranch
        );
    }

    // キャッシュがない場合はGitHubから取得
    console.log("GitHubからワークフローデータを取得します");
    const workflowsWithContent = await WorkflowOrchestrator.getAllWorkflowsWithContent(prUrl);


    // 取得したデータをストレージに保存（nullでない場合）
    if (workflowsWithContent) {
        await cacheWorkflows(repoUrl, workflowsWithContent);
    }

    // nullの場合は空配列を返す、そうでない場合はマージ時に実行されるワークフローのみをフィルタリング
    return workflowsWithContent ?
        workflowsWithContent.filter(item =>
            item.triggerAnalysis && item.triggerAnalysis.isTriggeredOnDefaultBranch
        ) : [];
}
