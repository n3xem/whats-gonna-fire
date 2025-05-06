// OpenAI APIとの通信を担当するサービス
import OpenAI from 'openai';

export class OpenAIService {
    /**
     * OpenAIクライアントを初期化
     */
    static async getClient(): Promise<OpenAI | null> {
        // APIキーが設定されているか確認
        const apiKeyResult = await chrome.storage.local.get(['openaiApiKey']);
        const apiKey = apiKeyResult.openaiApiKey;

        if (!apiKey) {
            console.log("OpenAI APIキーが設定されていません");
            return null;
        }

        // OpenAIクライアントの初期化
        return new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // ブラウザ環境で実行するために必要
        });
    }

    /**
     * ワークフローYAMLの内容を分析
     */
    static async analyzeWorkflowContent(content: string): Promise<string | undefined> {
        const client = await this.getClient();

        if (!client) {
            return undefined;
        }

        try {
            const response = await client.responses.create({
                model: "o3-mini",
                instructions: "あなたはGitHub Actionsのワークフローファイルを分析するエキスパートです。与えられたYAMLファイルを分析し、そのワークフローが何をするのか、どのような影響があるのかを3行程度で簡潔に要約してください。特に重要なステップや、デプロイ、データベース変更、環境への影響などがあれば強調してください。また、最終的にHTMLとして出力するので、改行やタグなどを適切に加えてください。また、必ず日本語で答えてください。",
                input: content,
            });

            return response.output_text;
        } catch (error) {
            console.error("OpenAI API呼び出しエラー:", error);
            return "分析中にエラーが発生しました";
        }
    }
} 
