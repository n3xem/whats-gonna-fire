// アクションボタンがクリックされたときの処理
chrome.action.onClicked.addListener((tab) => {
    // GitHubのリポジトリページにいることを確認
    if (tab.url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)/)) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getWorkflows,
        });
    } else {
        console.log("このページはGitHubリポジトリページではありません。");
    }
});

// ワークフローを取得する関数
function getWorkflows() {
    // URLからリポジトリ情報を抽出
    const urlMatch = window.location.href.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
        console.log("GitHubリポジトリURLの解析に失敗しました。");
        return;
    }

    const owner = urlMatch[1];
    const repo = urlMatch[2];

    console.log(`リポジトリ: ${owner}/${repo}`);

    // 最初にリポジトリの情報を取得してデフォルトブランチを確認
    fetch(`https://api.github.com/repos/${owner}/${repo}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API エラー: ${response.status}`);
            }
            return response.json();
        })
        .then(repoInfo => {
            const defaultBranch = repoInfo.default_branch || 'main';
            console.log(`デフォルトブランチ: ${defaultBranch}`);

            // ワークフロー情報を取得
            return fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`GitHub API エラー: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // ブランチ情報を含めて返す
                    return {
                        workflows: data,
                        defaultBranch: defaultBranch
                    };
                });
        })
        .then(data => {
            // .github/workflows 内のワークフローだけをフィルタリング
            const filteredWorkflows = {
                total_count: 0,
                workflows: []
            };

            if (data.workflows.workflows && data.workflows.workflows.length > 0) {
                filteredWorkflows.workflows = data.workflows.workflows.filter(workflow =>
                    workflow.path.startsWith('.github/workflows/')
                );
                filteredWorkflows.total_count = filteredWorkflows.workflows.length;
            }

            console.log(".github/workflows内のワークフロー一覧:");
            console.log(filteredWorkflows);

            // コンテンツスクリプトにフィルタリングされたワークフロー情報を直接表示
            console.log("===== GitHub .github/workflows内のワークフロー一覧と内容 =====");

            if (filteredWorkflows.total_count === 0) {
                console.log("このリポジトリには.github/workflows内にワークフローが存在しません。");
                return;
            }

            console.log(`合計: ${filteredWorkflows.total_count}件のワークフロー`);

            // 各ワークフローファイルの内容を取得して表示する
            return Promise.all(filteredWorkflows.workflows.map((workflow, index) => {
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${data.defaultBranch}/${workflow.path}`;

                return fetch(rawUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`ファイル取得エラー: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(content => {
                        // ワークフロー情報と内容をセットで返す
                        return {
                            workflow: workflow,
                            content: content,
                            index: index
                        };
                    })
                    .catch(error => {
                        // ファイル取得のエラーハンドリング
                        return {
                            workflow: workflow,
                            content: `ファイル内容の取得に失敗しました: ${error.message}`,
                            index: index,
                            error: true
                        };
                    });
            }));
        })
        .then(workflowsWithContent => {
            // ワークフロー情報と内容を表示
            if (workflowsWithContent) {
                workflowsWithContent.forEach(item => {
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
            }
        })
        .catch(error => {
            console.error("ワークフロー取得エラー:", error);
        });
} 
