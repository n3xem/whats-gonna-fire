import { WorkflowWithContent, GitHubClient } from './github_client';

// アクションボタンがクリックされたときの処理
chrome.action.onClicked.addListener(handleActionClick);

// アクションボタンクリック時のメイン関数
async function handleActionClick(tab: chrome.tabs.Tab) {
    if (!tab.url || !tab.id || !isGitHubRepoOrPRPage(tab.url)) {
        console.log("このページはGitHubリポジトリページまたはPRページではありません。");
        return;
    }

    try {
        const workflowsWithContent = await GitHubClient.getAllWorkflowsWithContent(tab.url);

        // コンソールに出力
        executeScriptForConsoleLog(tab.id, workflowsWithContent);

        // DOM上に表示
        executeScriptForDOMDisplay(tab.id, workflowsWithContent);
    } catch (error) {
        console.error("ワークフロー取得エラー:", error);
    }
}

// URL判定関数
function isGitHubRepoOrPRPage(url: string): boolean {
    return !!url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/pull\/(\d+))?/);
}

// コンソールログ用のスクリプト実行
function executeScriptForConsoleLog(tabId: number, data: WorkflowWithContent[] | null) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (data) => {
            console.log("===== GitHub .github/workflows内のワークフロー一覧と内容 =====");

            if (!data || data.length === 0) {
                console.log("このリポジトリには.github/workflows内にワークフローが存在しないか、取得に失敗しました。");
                return;
            }

            data.forEach((item: any, index: number) => {
                const { workflow, content, error } = item;

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
        args: [data]
    });
}

// DOM表示用のスクリプト実行
function executeScriptForDOMDisplay(tabId: number, data: WorkflowWithContent[] | null) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (data) => {
            // データチェック
            if (!data || data.length === 0) {
                return;
            }

            // PRページチェック
            const isPRPage = window.location.href.includes('/pull/');
            if (!isPRPage) {
                return; // PRページでない場合は処理しない
            }

            // 既存要素の削除
            const existingContainer = document.querySelector('.workflow-files-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            // ワークフローコンテナ作成
            const container = document.createElement('div');
            container.className = 'workflow-files-container';
            container.style.padding = '16px';
            container.style.margin = '10px 0';
            container.style.border = '1px solid #d0d7de';
            container.style.borderRadius = '6px';
            container.style.backgroundColor = '#f6f8fa';

            // タイトル追加
            const title = document.createElement('h3');
            title.textContent = 'ワークフローファイル一覧';
            title.style.marginTop = '0';
            container.appendChild(title);

            // リスト作成
            const list = document.createElement('ul');
            list.style.padding = '0';
            list.style.listStyle = 'none';

            // 各ワークフローのリストアイテムを追加
            data.forEach((item: any) => {
                const workflow = item.workflow;

                // リストアイテム作成
                const listItem = document.createElement('li');
                listItem.style.margin = '8px 0';

                // リンク作成
                const link = document.createElement('a');
                link.href = workflow.html_url;
                link.textContent = workflow.path.split('/').pop(); // ファイル名部分のみ抽出
                link.target = '_blank';
                link.style.color = '#0969da';
                link.style.textDecoration = 'none';
                link.style.fontWeight = 'bold';

                // バッジ作成
                const badge = document.createElement('span');
                badge.textContent = workflow.state;
                badge.style.marginLeft = '8px';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '12px';
                badge.style.fontWeight = 'bold';

                if (workflow.state === 'active') {
                    badge.style.backgroundColor = '#2da44e';
                    badge.style.color = 'white';
                } else {
                    badge.style.backgroundColor = '#ccc';
                    badge.style.color = '#555';
                }

                listItem.appendChild(link);
                listItem.appendChild(badge);
                list.appendChild(listItem);
            });

            container.appendChild(list);

            // ページに挿入
            const targetElement = document.querySelector('.TimelineItem-body');
            if (targetElement) {
                // 最初のTimelineItem-bodyの上に挿入
                targetElement.parentNode?.insertBefore(container, targetElement);
            } else {
                // 代替位置を探す
                const prTitleElement = document.querySelector('.gh-header-title');
                if (prTitleElement) {
                    prTitleElement.parentNode?.insertBefore(container, prTitleElement.nextSibling);
                }
            }
        },
        args: [data]
    });
} 
