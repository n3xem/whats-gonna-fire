// DOM要素の取得
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const clearStorageButton = document.getElementById('clearStorageButton') as HTMLButtonElement;

// 保存されたAPIキーを読み込む
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['openaiApiKey'], (result) => {
        if (result.openaiApiKey) {
            // APIキーの一部を隠して表示
            const key = result.openaiApiKey;
            const maskedKey = key.substring(0, 3) + '...' + key.substring(key.length - 4);
            apiKeyInput.value = maskedKey;
            apiKeyInput.dataset.masked = 'true';
            showStatus('APIキーが設定されています', 'success');
        }
    });
});

// APIキー入力フィールドがフォーカスされたとき、マスクされている場合は空にする
apiKeyInput.addEventListener('focus', () => {
    if (apiKeyInput.dataset.masked === 'true') {
        apiKeyInput.value = '';
        apiKeyInput.dataset.masked = 'false';
    }
});

// 保存ボタンのクリックイベント
saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus('APIキーを入力してください', 'error');
        return;
    }

    // APIキーの形式を簡易チェック
    if (!apiKey.startsWith('sk-')) {
        showStatus('有効なAPIキーを入力してください', 'error');
        return;
    }

    // APIキーを保存
    chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
        showStatus('APIキーを保存しました', 'success');

        // APIキーの一部を隠して表示
        const maskedKey = apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4);
        apiKeyInput.value = maskedKey;
        apiKeyInput.dataset.masked = 'true';
    });
});

// ストレージクリアボタンのクリックイベント
clearStorageButton.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
        // 入力フィールドをクリア
        apiKeyInput.value = '';
        apiKeyInput.dataset.masked = 'false';

        showStatus('すべてのストレージデータをクリアしました', 'success');
    });
});

// ステータスメッセージを表示する関数
function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';

    // 3秒後に成功メッセージを非表示にする（エラーメッセージは表示したまま）
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
} 
