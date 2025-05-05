import { WorkflowWithContent, GitHubClient } from './github_client';

// アクションボタンがクリックされたときの処理
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
    // GitHubのリポジトリページにいることを確認
    if (tab.url && tab.url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)/)) {
        try {
            // バックグラウンドスクリプト自身でGitHubClientを使用
            const workflowsWithContent = await GitHubClient.getAllWorkflowsWithContent(tab.url);

            // タブにメッセージを送信して結果を表示
            if (tab.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (data) => {
                        console.log("===== GitHub .github/workflows内のワークフロー一覧と内容 =====");

                        if (!data || data.length === 0) {
                            console.log("このリポジトリには.github/workflows内にワークフローが存在しないか、取得に失敗しました。");
                            return;
                        }

                        data.forEach((item: any) => {
                            const { workflow, content, index, error } = item;

                            console.log(`\n--- ワークフロー ${index + 1} ---`);
                            console.log(`名前: ${workflow.name}`);
                            console.log(`パス: ${workflow.path}`);
                            console.log(`状態: ${workflow.state}`);
                            console.log(`作成日: ${new Date(workflow.created_at).toLocaleString()}`);
                            console.log(`更新日: ${new Date(workflow.updated_at).toLocaleString()}`);
                            console.log(`URL: ${workflow.html_url}`);

                            console.log(`\nワークフローファイルの内容:`);
                            if (error) {
                                console.error(content);
                            } else {
                                console.log(`\`\`\`yaml\n${content}\n\`\`\``);
                            }
                        });
                    },
                    args: [workflowsWithContent]
                });
            }
        } catch (error) {
            console.error("ワークフロー取得エラー:", error);
        }
    } else {
        console.log("このページはGitHubリポジトリページではありません。");
    }
}); 
