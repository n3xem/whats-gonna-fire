import { WorkflowWithContent, GitHubClient } from './github_client';

// アクションボタンがクリックされたときの処理
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
    // GitHubのリポジトリページまたはPRページにいることを確認
    if (tab.url && tab.url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/pull\/(\d+))?/)) {
        try {
            // バックグラウンドスクリプト自身でGitHubClientを使用
            const workflowsWithContent = await GitHubClient.getAllWorkflowsWithContent(tab.url);

            // タブにメッセージを送信して結果を表示
            if (tab.id) {
                // コンソールに出力
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

                // DOM上に表示
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (data) => {
                        // データがない場合は何もしない
                        if (!data || data.length === 0) {
                            return;
                        }

                        // PRページかどうか確認
                        const isPRPage = window.location.href.includes('/pull/');
                        if (!isPRPage) {
                            return; // PRページでない場合は処理しない
                        }

                        // すでに挿入済みなら削除
                        const existingContainer = document.querySelector('.workflow-files-container');
                        if (existingContainer) {
                            existingContainer.remove();
                        }

                        // ワークフロー情報表示用のコンテナを作成
                        const container = document.createElement('div');
                        container.className = 'workflow-files-container';
                        container.style.padding = '16px';
                        container.style.margin = '10px 0';
                        container.style.border = '1px solid #d0d7de';
                        container.style.borderRadius = '6px';
                        container.style.backgroundColor = '#f6f8fa';

                        // タイトル
                        const title = document.createElement('h3');
                        title.textContent = 'ワークフローファイル一覧';
                        title.style.marginTop = '0';
                        container.appendChild(title);

                        // ワークフローリスト
                        const list = document.createElement('ul');
                        list.style.padding = '0';
                        list.style.listStyle = 'none';

                        data.forEach((item: any) => {
                            const { workflow } = item;
                            const listItem = document.createElement('li');
                            listItem.style.margin = '8px 0';

                            // ファイル名（リンク付き）
                            const link = document.createElement('a');
                            link.href = workflow.html_url;
                            link.textContent = workflow.path.split('/').pop(); // ファイル名部分のみ抽出
                            link.target = '_blank';
                            link.style.color = '#0969da';
                            link.style.textDecoration = 'none';
                            link.style.fontWeight = 'bold';

                            // ステータスバッジ
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

                        // PRページの適切な位置に挿入
                        const targetElement = document.querySelector('.TimelineItem-body');
                        if (targetElement) {
                            // 最初のTimelineItem-bodyの上に挿入
                            targetElement.parentNode?.insertBefore(container, targetElement);
                        } else {
                            // 適切な場所が見つからない場合はPRタイトルの後ろに挿入
                            const prTitleElement = document.querySelector('.gh-header-title');
                            if (prTitleElement) {
                                prTitleElement.parentNode?.insertBefore(container, prTitleElement.nextSibling);
                            }
                        }
                    },
                    args: [workflowsWithContent]
                });
            }
        } catch (error) {
            console.error("ワークフロー取得エラー:", error);
        }
    } else {
        console.log("このページはGitHubリポジトリページまたはPRページではありません。");
    }
}); 
