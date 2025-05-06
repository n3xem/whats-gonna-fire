import * as yaml from 'js-yaml';
import { WorkflowWithContent, WorkflowTriggerAnalysis } from './github_client';

export class WorkflowAnalyzer {
    /**
     * ワークフローのYAMLを解析し、デフォルトブランチへのマージでトリガーされるか検証する
     * @param workflow ワークフローとその内容
     * @param defaultBranch デフォルトブランチ名
     * @returns トリガー条件の解析結果
     */
    static isTriggeredOnDefaultBranchMerge(
        workflow: WorkflowWithContent,
        defaultBranch: string
    ): WorkflowTriggerAnalysis {
        // エラーがある場合は解析不可
        if (workflow.error) {
            return {
                isTriggeredOnDefaultBranch: false,
                triggerEvents: [],
                triggerBranches: [],
                triggerPaths: []
            };
        }

        try {
            // YAMLを解析
            const workflowYaml = yaml.load(workflow.content) as any;
            if (!workflowYaml || !workflowYaml.on) {
                return {
                    isTriggeredOnDefaultBranch: false,
                    triggerEvents: [],
                    triggerBranches: [],
                    triggerPaths: []
                };
            }

            const triggerEvents: string[] = [];
            const triggerBranches: string[] = [];
            const triggerPaths: string[] = [];
            let isTriggeredOnDefaultBranch = false;

            // トリガーイベントの解析
            const onTrigger = workflowYaml.on;

            // 文字列の場合（例: on: push）
            if (typeof onTrigger === 'string') {
                triggerEvents.push(onTrigger);
                // 単純なpushの場合はすべてのブランチが対象なのでデフォルトブランチも含まれる
                if (onTrigger === 'push') {
                    isTriggeredOnDefaultBranch = true;
                    triggerBranches.push('*');
                    triggerPaths.push('*'); // すべてのパスが対象
                }
            }
            // 配列の場合（例: on: [push, pull_request]）
            else if (Array.isArray(onTrigger)) {
                onTrigger.forEach(event => {
                    triggerEvents.push(event);
                    // 配列内の単純なpushイベントもすべてのブランチが対象
                    if (event === 'push') {
                        isTriggeredOnDefaultBranch = true;
                        triggerBranches.push('*');
                        triggerPaths.push('*'); // すべてのパスが対象
                    }
                });
            }
            // オブジェクトの場合（例: on: { push: { branches: [main] } }）
            else if (typeof onTrigger === 'object') {
                // 各イベントタイプを処理
                for (const eventType in onTrigger) {
                    triggerEvents.push(eventType);
                    const eventConfig = onTrigger[eventType];

                    // pull_request系イベントの処理
                    if (
                        (eventType === 'pull_request' ||
                            eventType === 'pull_request_target') &&
                        this.checkBranchesInConfig(eventConfig, defaultBranch, triggerBranches)
                    ) {
                        isTriggeredOnDefaultBranch = true;
                        // パス情報も取得
                        this.checkPathsInConfig(eventConfig, triggerPaths);
                    }

                    // pushイベントの処理
                    if (eventType === 'push') {
                        // 設定がない場合はすべてのブランチが対象
                        if (!eventConfig) {
                            isTriggeredOnDefaultBranch = true;
                            triggerBranches.push('*');
                            triggerPaths.push('*'); // すべてのパスが対象
                            continue;
                        }

                        // ブランチ指定がある場合
                        if (this.checkBranchesInConfig(eventConfig, defaultBranch, triggerBranches)) {
                            isTriggeredOnDefaultBranch = true;
                            // パス情報も取得
                            this.checkPathsInConfig(eventConfig, triggerPaths);
                        }
                    }
                }
            }

            return {
                isTriggeredOnDefaultBranch,
                triggerEvents,
                triggerBranches,
                triggerPaths
            };
        } catch (error) {
            console.error(`ワークフロー解析エラー (${workflow.workflow.name}):`, error);
            return {
                isTriggeredOnDefaultBranch: false,
                triggerEvents: [],
                triggerBranches: [],
                triggerPaths: []
            };
        }
    }

    /**
     * イベント設定内のブランチ指定を確認
     * @param eventConfig イベント設定オブジェクト
     * @param defaultBranch デフォルトブランチ名
     * @param triggerBranches 検出したブランチ名を格納する配列（副作用）
     * @returns デフォルトブランチが含まれるかどうか
     */
    private static checkBranchesInConfig(
        eventConfig: any,
        defaultBranch: string,
        triggerBranches: string[]
    ): boolean {
        // 設定がない場合
        if (!eventConfig) {
            return false;
        }

        // branches指定がある場合
        if (eventConfig.branches) {
            const branches = this.normalizeBranchesConfig(eventConfig.branches);
            branches.forEach(branch => triggerBranches.push(branch));

            // デフォルトブランチが明示的に含まれているか
            if (branches.includes(defaultBranch)) {
                return true;
            }

            // ワイルドカードパターンの確認
            for (const pattern of branches) {
                if (
                    pattern === '*' ||
                    pattern === '**' ||
                    pattern.endsWith('/**') ||
                    (pattern.includes('*') && this.matchWildcard(defaultBranch, pattern))
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * イベント設定内のパス指定を確認して取得
     * @param eventConfig イベント設定オブジェクト
     * @param triggerPaths 検出したパスパターンを格納する配列（副作用）
     */
    private static checkPathsInConfig(
        eventConfig: any,
        triggerPaths: string[]
    ): void {
        // 設定がない場合
        if (!eventConfig) {
            triggerPaths.push('*'); // デフォルトはすべてのパス
            return;
        }

        // paths指定がある場合
        if (eventConfig.paths) {
            const paths = this.normalizePathsConfig(eventConfig.paths);
            paths.forEach(path => triggerPaths.push(path));
        } else if (!eventConfig.paths && !eventConfig['paths-ignore']) {
            // paths指定もpaths-ignore指定もない場合はすべてのパスが対象
            triggerPaths.push('*');
        }

        // paths-ignore指定がある場合
        if (eventConfig['paths-ignore']) {
            const ignorePaths = this.normalizePathsConfig(eventConfig['paths-ignore']);
            ignorePaths.forEach(path => triggerPaths.push(`!${path}`)); // 除外パスには!をつける
        }
    }

    /**
     * パス設定を正規化（文字列または配列に変換）
     */
    private static normalizePathsConfig(paths: any): string[] {
        if (typeof paths === 'string') {
            return [paths];
        } else if (Array.isArray(paths)) {
            return paths;
        }
        return [];
    }

    /**
     * ブランチ設定を正規化（文字列または配列に変換）
     */
    private static normalizeBranchesConfig(branches: any): string[] {
        if (typeof branches === 'string') {
            return [branches];
        } else if (Array.isArray(branches)) {
            return branches;
        }
        return [];
    }

    /**
     * 簡易的なワイルドカードマッチング
     */
    private static matchWildcard(str: string, pattern: string): boolean {
        // GitHubのワイルドカードパターンを正規表現に変換
        const regexPattern = pattern
            .replace(/\*/g, '.*')  // * を .* に変換
            .replace(/\?/g, '.')   // ? を . に変換

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(str);
    }
} 
