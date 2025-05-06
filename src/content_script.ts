import { WorkflowWithContent } from './github_client';
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

// ワークフロー情報をDOM上に表示する関数
function displayWorkflowsOnDOM(data: WorkflowWithContent[]) {
    // データチェック
    if (!data) {
        return;
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

        listItem.appendChild(link);
        listItem.appendChild(stateBadge);
        listItem.appendChild(triggerBadge);
        list.appendChild(listItem);

        // トリガー詳細情報
        const triggerInfo = document.createElement('div');
        triggerInfo.style.fontSize = '12px';
        triggerInfo.style.color = '#57606a';
        triggerInfo.style.marginTop = '4px';
        triggerInfo.style.marginBottom = '12px';
        triggerInfo.style.marginLeft = '16px';

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

        list.appendChild(triggerInfo);
    });

    container.appendChild(list);

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
