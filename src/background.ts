import { WorkflowWithContent, GitHubClient } from './github_client';
import { getCachedWorkflows, cacheWorkflows } from './cache';

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getWorkflowsData' && request.url) {
        // ワークフローデータを取得してレスポンスを返す
        getWorkflowsData(request.url)
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

// ワークフローデータを取得する関数（ストレージ→GitHubの順）
async function getWorkflowsData(repoUrl: string): Promise<WorkflowWithContent[]> {
    // ストレージからデータを取得
    const cachedData = await getCachedWorkflows(repoUrl);

    // キャッシュが有効な場合はそれを返す
    if (cachedData) {
        console.log("キャッシュからワークフローデータを取得しました");
        return cachedData.data;
    }

    // キャッシュがない場合はGitHubから取得
    console.log("GitHubからワークフローデータを取得します");
    const workflowsWithContent = await GitHubClient.getAllWorkflowsWithContent(repoUrl);

    // 取得したデータをストレージに保存（nullでない場合）
    if (workflowsWithContent) {
        await cacheWorkflows(repoUrl, workflowsWithContent);
    }

    // nullの場合は空配列を返す
    return workflowsWithContent || [];
}
