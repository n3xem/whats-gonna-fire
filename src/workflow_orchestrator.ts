// 各サービスを調整するオーケストレーターファサード
import { parseRepoUrl } from './common';
import { GitHubApiService } from './github_api_service';
import { WorkflowFilter } from './workflow_filter';
import { WorkflowRepository } from './workflow_repository';
import { WorkflowAnalyzer } from './workflow_analyzer';
import { WorkflowWithContent } from './types';
import OpenAI from 'openai';

/**
 * GitHub Workflowに関する操作を統合的に管理するオーケストレーター
 */
export class WorkflowOrchestrator {
    /**
     * リポジトリ内のすべてのワークフローとその内容を取得
     */
    static async getAllWorkflowsWithContent(url: string): Promise<WorkflowWithContent[] | null> {
        const repoInfo = parseRepoUrl(url);
        if (!repoInfo) {
            return null;
        }

        const { owner, repo } = repoInfo;
        console.log(`リポジトリ: ${owner}/${repo}`);

        try {
            // リポジトリの情報を取得してデフォルトブランチを確認
            const repoData = await GitHubApiService.getRepoInfo(owner, repo);
            const defaultBranch = repoData.default_branch || 'main';
            console.log(`デフォルトブランチ: ${defaultBranch}`);

            // ワークフロー情報を取得
            const workflowsData = await GitHubApiService.getWorkflows(owner, repo);

            // ワークフローをフィルタリング
            const filteredWorkflows = WorkflowFilter.filterGitHubWorkflows(workflowsData);
            console.log(".github/workflows内のワークフロー一覧:");
            console.log(filteredWorkflows);

            if (filteredWorkflows.total_count === 0) {
                console.log("このリポジトリには.github/workflows内にワークフローが存在しません。");
                return [];
            }

            console.log(`合計: ${filteredWorkflows.total_count}件のワークフロー`);

            // 各ワークフローファイルの内容を取得して表示する
            const workflowsWithContent = await Promise.all(
                filteredWorkflows.workflows.map((workflow, index) =>
                    WorkflowRepository.getWorkflowContent(owner, repo, workflow, defaultBranch, index)
                )
            );

            // ワークフローの解析を行い、トリガー条件を追加
            const analyzedWorkflows = workflowsWithContent.map(workflow => {
                const triggerAnalysis = WorkflowAnalyzer.isTriggeredOnDefaultBranchMerge(workflow, defaultBranch);
                return {
                    ...workflow,
                    triggerAnalysis
                };
            });

            // OpenAIによるワークフロー内容の分析
            return await this.analyzeWorkflowsWithOpenAI(analyzedWorkflows);
        } catch (error) {
            console.error("ワークフロー取得エラー:", error);
            return null;
        }
    }

    /**
     * OpenAIを使用してワークフローの内容を分析する
     */
    private static async analyzeWorkflowsWithOpenAI(workflows: WorkflowWithContent[]): Promise<WorkflowWithContent[]> {
        // APIキーが設定されているか確認
        const apiKeyResult = await chrome.storage.local.get(['openaiApiKey']);
        const apiKey = apiKeyResult.openaiApiKey;

        if (!apiKey) {
            console.log("OpenAI APIキーが設定されていません");
            return workflows; // APIキーがない場合は元のデータをそのまま返す
        }

        // OpenAIクライアントの初期化
        const client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // ブラウザ環境で実行するために必要
        });

        // 各ワークフローの内容を分析
        const analyzedWorkflows = await Promise.all(workflows.map(async (workflow) => {
            try {
                // ワークフローの内容がある場合のみ分析
                if (workflow.content) {
                    const response = await client.responses.create({
                        model: "o3-mini",
                        instructions: "あなたはGitHub Actionsのワークフローファイルを分析するエキスパートです。与えられたYAMLファイルを分析し、そのワークフローが何をするのか、どのような影響があるのかを3行程度で簡潔に要約してください。特に重要なステップや、デプロイ、データベース変更、環境への影響などがあれば強調してください。また、最終的にHTMLとして出力するので、改行やタグなどを適切に加えてください。また、必ず日本語で答えてください。",
                        input: workflow.content,
                    });

                    // 分析結果を追加
                    return {
                        ...workflow,
                        analysis: response.output_text
                    };
                }
                return workflow;
            } catch (error) {
                console.error(`ワークフロー「${workflow.workflow.path}」の分析中にエラーが発生しました:`, error);
                return {
                    ...workflow,
                    analysis: "分析中にエラーが発生しました"
                };
            }
        }));

        return analyzedWorkflows;
    }
} 
