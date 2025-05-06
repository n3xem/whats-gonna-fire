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
                const triggerAnalysis = item.triggerAnalysis;

                // リストアイテム作成
                const listItem = document.createElement('li');
                listItem.style.margin = '8px 0';
                listItem.style.display = 'flex';
                listItem.style.alignItems = 'center';
                listItem.style.gap = '8px';

                // リンク作成
                const link = document.createElement('a');
                link.href = workflow.html_url;
                link.textContent = workflow.path.split('/').pop(); // ファイル名部分のみ抽出
                link.target = '_blank';
                link.style.color = '#0969da';
                link.style.textDecoration = 'none';
                link.style.fontWeight = 'bold';
                link.style.flexShrink = '0';

                // 状態バッジ作成
                const stateBadge = document.createElement('span');
                stateBadge.textContent = workflow.state;
                stateBadge.style.padding = '2px 6px';
                stateBadge.style.borderRadius = '12px';
                stateBadge.style.fontSize = '12px';
                stateBadge.style.fontWeight = 'bold';
                stateBadge.style.flexShrink = '0';

                if (workflow.state === 'active') {
                    stateBadge.style.backgroundColor = '#2da44e';
                    stateBadge.style.color = 'white';
                } else {
                    stateBadge.style.backgroundColor = '#ccc';
                    stateBadge.style.color = '#555';
                }

                // トリガーバッジ作成
                const triggerBadge = document.createElement('span');
                if (triggerAnalysis && triggerAnalysis.isTriggeredOnDefaultBranch) {
                    triggerBadge.textContent = 'マージ時実行';
                    triggerBadge.style.backgroundColor = '#ff6b6b';
                    triggerBadge.style.color = 'white';
                } else {
                    triggerBadge.textContent = 'マージ時実行なし';
                    triggerBadge.style.backgroundColor = '#8d959f';
                    triggerBadge.style.color = 'white';
                }
                triggerBadge.style.padding = '2px 6px';
                triggerBadge.style.borderRadius = '12px';
                triggerBadge.style.fontSize = '12px';
                triggerBadge.style.fontWeight = 'bold';
                triggerBadge.style.flexShrink = '0';

                // トリガー詳細情報
                if (triggerAnalysis) {
                    const triggerInfo = document.createElement('div');
                    triggerInfo.style.fontSize = '12px';
                    triggerInfo.style.color = '#57606a';
                    triggerInfo.style.marginTop = '4px';

                    // イベント一覧
                    if (triggerAnalysis.triggerEvents.length > 0) {
                        const eventsText = document.createElement('div');
                        eventsText.textContent = `イベント: ${triggerAnalysis.triggerEvents.join(', ')}`;
                        triggerInfo.appendChild(eventsText);
                    }

                    // ブランチ一覧
                    if (triggerAnalysis.triggerBranches.length > 0) {
                        const branchesText = document.createElement('div');
                        branchesText.textContent = `ブランチ: ${triggerAnalysis.triggerBranches.join(', ')}`;
                        triggerInfo.appendChild(branchesText);
                    }

                    listItem.appendChild(link);
                    listItem.appendChild(stateBadge);
                    listItem.appendChild(triggerBadge);
                    list.appendChild(listItem);
                    list.appendChild(triggerInfo);
                } else {
                    listItem.appendChild(link);
                    listItem.appendChild(stateBadge);
                    list.appendChild(listItem);
                }
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
