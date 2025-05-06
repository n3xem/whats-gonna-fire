import { WorkflowWithContent } from './types';
import { isGitHubRepoOrPRPage } from './common';

// ページの読み込みが完全に終わった時に実行
window.onload = async () => {
    // PRページかどうかをチェック
    const isPRPage = window.location.href.includes('/pull/');
    if (!isPRPage) {
        return; // PRページでない場合は処理しない
    }

    // 現在のURLがGitHubリポジトリページかPRページかチェック
    if (!isGitHubRepoOrPRPage(window.location.href)) {
        return;
    }

    try {
        // バックグラウンドスクリプトにデータリクエストを送信
        chrome.runtime.sendMessage(
            { action: 'getWorkflowsData', url: window.location.href },
            (response) => {
                if (response && response.data) {
                    // データを受け取ったらDOMに表示
                    displayWorkflowsOnDOM(response.data);
                }
            }
        );
    } catch (error) {
        console.error('ワークフロー表示エラー:', error);
    }
};

/*
// GitHubのDOM変更を監視（PR詳細ページ内の動的な変更に対応）
const observer = new MutationObserver((mutations) => {
    // マージボックスが読み込まれた場合など、DOMが大きく変わった場合に再実行
    const mergeboxElement = document.querySelector('[data-testid="mergebox-partial"]');
    if (mergeboxElement) {
        // 既存の表示があれば更新しない（重複防止）
        if (!document.querySelector('.workflow-files-container')) {
            console.log('マージボックスが読み込まれたのでワークフロー情報を取得します');
            chrome.runtime.sendMessage(
                { action: 'getWorkflowsData', url: window.location.href },
                (response) => {
                    if (response && response.data) {
                        displayWorkflowsOnDOM(response.data);
                    }
                }
            );
        }
    }
});

// DOM監視の開始
observer.observe(document.body, {
    childList: true,
    subtree: true
});

*/

// ワークフロー情報をDOM上に表示する関数
function displayWorkflowsOnDOM(data: WorkflowWithContent[]) {
    // データチェック
    if (!data) {
        return;
    }

    /**
     * イベントタイプに応じた動詞を生成
     * @param events イベントタイプの配列
     * @returns イベントに応じた動詞句
     */
    function getEventVerbsForBranch(events: string[]): string {
        // マージ時に実行されるのはpushとpull_requestのみを考慮
        const hasPush = events.includes('push');
        const hasPR = events.includes('pull_request') || events.includes('pull_request_target');

        if (hasPush && hasPR) {
            return 'へのプッシュまたはプルリクエストで';
        } else if (hasPush) {
            return 'へのプッシュで';
        } else if (hasPR) {
            return 'へのプルリクエストで';
        } else {
            // その他のケース（通常はここには来ない）
            return 'に関連する操作で';
        }
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
    title.textContent = 'マージ時に実行されるワークフロー';
    title.style.marginTop = '0';
    title.style.color = '#24292f';
    container.appendChild(title);

    // 説明追加
    const description = document.createElement('p');

    // 実行されるワークフローがない場合はその旨を表示
    if (data.length === 0) {
        description.textContent = 'このPRをマージしても実行されるワークフローはありません';
        description.style.fontSize = '14px';
        description.style.color = '#57606a';
        description.style.margin = '8px 0';
        container.appendChild(description);

        // ページに挿入
        insertContainerIntoDOM(container);
        return;
    }

    description.textContent = `このPRをマージすると ${data.length} 件のワークフローが実行される可能性があります`;
    description.style.fontSize = '14px';
    description.style.color = '#57606a';
    description.style.margin = '8px 0 16px';
    container.appendChild(description);

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
        listItem.style.flexWrap = 'wrap';

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
        triggerBadge.textContent = 'マージ時実行';
        triggerBadge.style.backgroundColor = '#ff6b6b';
        triggerBadge.style.color = 'white';
        triggerBadge.style.padding = '2px 6px';
        triggerBadge.style.borderRadius = '12px';
        triggerBadge.style.fontSize = '12px';
        triggerBadge.style.fontWeight = 'bold';
        triggerBadge.style.flexShrink = '0';

        // 展開/折りたたみボタン作成
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '詳細を表示';
        toggleButton.style.marginLeft = 'auto';
        toggleButton.style.padding = '2px 8px';
        toggleButton.style.fontSize = '12px';
        toggleButton.style.backgroundColor = '#f6f8fa';
        toggleButton.style.border = '1px solid #d0d7de';
        toggleButton.style.borderRadius = '6px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.color = '#24292f';

        listItem.appendChild(link);
        listItem.appendChild(stateBadge);
        listItem.appendChild(triggerBadge);
        listItem.appendChild(toggleButton);
        list.appendChild(listItem);

        // トリガー詳細情報
        const triggerInfo = document.createElement('div');
        triggerInfo.style.fontSize = '12px';
        triggerInfo.style.color = '#57606a';
        triggerInfo.style.marginTop = '4px';
        triggerInfo.style.marginBottom = '12px';
        triggerInfo.style.marginLeft = '16px';
        triggerInfo.style.width = '100%';
        triggerInfo.style.display = 'none'; // 初期状態では非表示

        if (triggerAnalysis.triggerBranches.length > 0) {
            const branchesText = document.createElement('div');

            // イベントタイプに応じた動詞を選択
            const eventVerbs = getEventVerbsForBranch(triggerAnalysis.triggerEvents);

            // ブランチが「*」のみの場合は全てのブランチが対象
            if (triggerAnalysis.triggerBranches.length === 1 && triggerAnalysis.triggerBranches[0] === '*') {
                branchesText.textContent = `すべてのブランチ${eventVerbs}トリガーされます`;
            } else {
                // ワイルドカードを含むブランチ名を特別扱い
                const hasWildcard = triggerAnalysis.triggerBranches.some((branch: string) =>
                    branch.includes('*') || branch.includes('**'));

                if (hasWildcard) {
                    branchesText.textContent = `「${triggerAnalysis.triggerBranches.join('」、「')}」のパターンに一致するブランチ${eventVerbs}トリガーされます`;
                } else {
                    branchesText.textContent = `「${triggerAnalysis.triggerBranches.join('」、「')}」ブランチ${eventVerbs}トリガーされます`;
                }
            }

            triggerInfo.appendChild(branchesText);
        }

        // パス一覧
        if (triggerAnalysis.triggerPaths && triggerAnalysis.triggerPaths.length > 0) {
            const pathsText = document.createElement('div');

            // パスが「*」のみの場合は全てのファイルが対象
            if (triggerAnalysis.triggerPaths.length === 1 && triggerAnalysis.triggerPaths[0] === '*') {
                pathsText.textContent = 'すべてのファイルの変更でトリガーされます';
            } else {
                // 通常のパスと除外パス（!で始まるもの）を分ける
                const includePaths = triggerAnalysis.triggerPaths.filter((path: string) => !path.startsWith('!'));
                const excludePaths = triggerAnalysis.triggerPaths
                    .filter((path: string) => path.startsWith('!'))
                    .map((path: string) => path.substring(1)); // 先頭の!を除去

                // 表示用のテキスト作成
                let pathDescription = '';

                if (includePaths.length > 0) {
                    pathDescription += `「${includePaths.join('」、「')}」のパスが差分に含まれている場合にトリガーされます`;
                }

                if (excludePaths.length > 0) {
                    if (pathDescription) {
                        pathDescription += '。また、';
                    }
                    pathDescription += `「${excludePaths.join('」、「')}」のパスが差分に含まれていない場合にトリガーされます`;
                }

                pathsText.textContent = pathDescription;
            }

            triggerInfo.appendChild(pathsText);
        }

        // OpenAIによる分析結果を表示（存在する場合）
        if (item.analysis) {
            const analysisContainer = document.createElement('div');
            analysisContainer.style.marginTop = '8px';
            analysisContainer.style.padding = '8px';
            analysisContainer.style.backgroundColor = '#f0f6ff';
            analysisContainer.style.borderRadius = '4px';
            analysisContainer.style.borderLeft = '3px solid #0969da';

            const analysisTitle = document.createElement('div');
            analysisTitle.textContent = 'ワークフロー分析:';
            analysisTitle.style.fontWeight = 'bold';
            analysisTitle.style.marginBottom = '4px';
            analysisTitle.style.color = '#24292f';

            const analysisText = document.createElement('div');
            analysisText.innerHTML = item.analysis || '';
            analysisText.style.color = '#24292f';

            analysisContainer.appendChild(analysisTitle);
            analysisContainer.appendChild(analysisText);
            triggerInfo.appendChild(analysisContainer);
        }

        listItem.appendChild(triggerInfo);

        // 展開/折りたたみボタンのクリックイベント
        toggleButton.addEventListener('click', () => {
            if (triggerInfo.style.display === 'none') {
                triggerInfo.style.display = 'block';
                toggleButton.textContent = '詳細を隠す';
            } else {
                triggerInfo.style.display = 'none';
                toggleButton.textContent = '詳細を表示';
            }
        });
    });

    container.appendChild(list);

    // APIキーが設定されていない場合の通知
    const apiKeyNotice = document.createElement('div');
    apiKeyNotice.style.marginTop = '16px';
    apiKeyNotice.style.fontSize = '12px';
    apiKeyNotice.style.color = '#57606a';
    apiKeyNotice.style.padding = '8px';
    apiKeyNotice.style.backgroundColor = '#ffebe9';
    apiKeyNotice.style.borderRadius = '4px';
    apiKeyNotice.style.display = 'none';

    // 分析結果がない場合はAPIキー設定を促す
    if (!data.some(item => item.analysis)) {
        apiKeyNotice.textContent = 'ワークフロー分析を表示するには、拡張機能のアイコンをクリックしてOpenAI APIキーを設定してください。';
        apiKeyNotice.style.display = 'block';
    }

    container.appendChild(apiKeyNotice);

    // ページに挿入
    insertContainerIntoDOM(container);
}

// DOMにコンテナを挿入する関数
function insertContainerIntoDOM(container: HTMLElement) {
    const mergeboxElement = document.querySelector('[data-testid="mergebox-partial"]');
    if (mergeboxElement) {
        // mergeboxの中の一番下に挿入
        mergeboxElement.appendChild(container);
    }
} 
