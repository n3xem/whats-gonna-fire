import { WorkflowWithContent } from './github_client';

// キャッシュの有効期限（ミリ秒）- 1時間
export const CACHE_EXPIRATION = 60 * 60 * 1000;

// ストレージからワークフローデータを取得
export async function getCachedWorkflows(repoUrl: string): Promise<{ data: WorkflowWithContent[], timestamp: number } | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get([repoUrl], (result) => {
            const cachedData = result[repoUrl];

            // キャッシュがない、または期限切れの場合はnullを返す
            if (!cachedData || Date.now() - cachedData.timestamp > CACHE_EXPIRATION) {
                resolve(null);
                return;
            }

            resolve(cachedData);
        });
    });
}

// ワークフローデータをストレージに保存
export async function cacheWorkflows(repoUrl: string, data: WorkflowWithContent[]): Promise<void> {
    return new Promise((resolve) => {
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };

        chrome.storage.local.set({ [repoUrl]: cacheData }, () => {
            console.log("ワークフローデータをキャッシュしました");
            resolve();
        });
    });
} 
