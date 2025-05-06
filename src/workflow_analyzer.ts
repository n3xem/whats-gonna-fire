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
            return this.createEmptyTriggerAnalysis();
        }

        try {
            // YAMLを解析
            const workflowYaml = yaml.load(workflow.content) as any;
            if (!workflowYaml || !workflowYaml.on) {
                return this.createEmptyTriggerAnalysis();
            }

            const result = this.createEmptyTriggerAnalysis();
            const onTrigger = workflowYaml.on;

            // トリガーイベントの解析
            if (typeof onTrigger === 'string') {
                this.handleStringEventType(onTrigger, result);
            } else if (Array.isArray(onTrigger)) {
                this.handleArrayEventType(onTrigger, result);
            } else if (typeof onTrigger === 'object') {
                this.handleObjectEventType(onTrigger, result, defaultBranch);
            }

            return result;
        } catch (error) {
            console.error(`ワークフロー解析エラー (${workflow.workflow.name}):`, error);
            return this.createEmptyTriggerAnalysis();
        }
    }

    /**
     * 空のトリガー解析結果を作成
     */
    private static createEmptyTriggerAnalysis(): WorkflowTriggerAnalysis {
        return {
            isTriggeredOnDefaultBranch: false,
            triggerEvents: [],
            triggerBranches: [],
            triggerPaths: []
        };
    }

    /**
     * 文字列形式のイベント（例: on: push）を処理
     */
    private static handleStringEventType(
        eventType: string,
        result: WorkflowTriggerAnalysis,
    ): void {
        result.triggerEvents.push(eventType);

        // 単純なpushの場合はすべてのブランチが対象なのでデフォルトブランチも含まれる
        if (eventType === 'push') {
            result.isTriggeredOnDefaultBranch = true;
            result.triggerBranches.push('*');
            result.triggerPaths.push('*'); // すべてのパスが対象
        }
    }

    /**
     * 配列形式のイベント（例: on: [push, pull_request]）を処理
     */
    private static handleArrayEventType(
        eventTypes: string[],
        result: WorkflowTriggerAnalysis,
    ): void {
        eventTypes.forEach(eventType => {
            result.triggerEvents.push(eventType);

            // 配列内の単純なpushイベントもすべてのブランチが対象
            if (eventType === 'push') {
                result.isTriggeredOnDefaultBranch = true;
                result.triggerBranches.push('*');
                result.triggerPaths.push('*'); // すべてのパスが対象
            }
        });
    }

    /**
     * オブジェクト形式のイベント（例: on: { push: { branches: [main] } }）を処理
     */
    private static handleObjectEventType(
        eventObject: any,
        result: WorkflowTriggerAnalysis,
        defaultBranch: string
    ): void {
        // 各イベントタイプを処理
        for (const eventType in eventObject) {
            result.triggerEvents.push(eventType);
            const eventConfig = eventObject[eventType];

            if (eventType === 'pull_request' || eventType === 'pull_request_target') {
                this.handlePullRequestEvent(eventConfig, result, defaultBranch);
            } else if (eventType === 'push') {
                this.handlePushEvent(eventConfig, result, defaultBranch);
            }
        }
    }

    /**
     * pull_request系イベントの処理
     */
    private static handlePullRequestEvent(
        eventConfig: any,
        result: WorkflowTriggerAnalysis,
        defaultBranch: string
    ): void {
        if (this.checkBranchesInConfig(eventConfig, defaultBranch, result.triggerBranches)) {
            result.isTriggeredOnDefaultBranch = true;
            this.checkPathsInConfig(eventConfig, result.triggerPaths);
        }
    }

    /**
     * pushイベントの処理
     */
    private static handlePushEvent(
        eventConfig: any,
        result: WorkflowTriggerAnalysis,
        defaultBranch: string
    ): void {
        // 設定がない場合はすべてのブランチが対象
        if (!eventConfig) {
            result.isTriggeredOnDefaultBranch = true;
            result.triggerBranches.push('*');
            result.triggerPaths.push('*'); // すべてのパスが対象
            return;
        }

        // ブランチ指定がある場合
        if (this.checkBranchesInConfig(eventConfig, defaultBranch, result.triggerBranches)) {
            result.isTriggeredOnDefaultBranch = true;
            this.checkPathsInConfig(eventConfig, result.triggerPaths);
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
                if (this.isWildcardMatch(pattern, defaultBranch)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * ワイルドカードパターンがデフォルトブランチにマッチするか確認
     */
    private static isWildcardMatch(pattern: string, defaultBranch: string): boolean {
        return (
            pattern === '*' ||
            pattern === '**' ||
            pattern.endsWith('/**') ||
            (pattern.includes('*') && this.matchWildcard(defaultBranch, pattern))
        );
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

        this.handlePathsInclude(eventConfig, triggerPaths);
        this.handlePathsIgnore(eventConfig, triggerPaths);
    }

    /**
     * paths指定の処理
     */
    private static handlePathsInclude(
        eventConfig: any,
        triggerPaths: string[]
    ): void {
        // paths指定がある場合
        if (eventConfig.paths) {
            const paths = this.normalizePathsConfig(eventConfig.paths);
            paths.forEach(path => triggerPaths.push(path));
        } else if (!eventConfig.paths && !eventConfig['paths-ignore']) {
            // paths指定もpaths-ignore指定もない場合はすべてのパスが対象
            triggerPaths.push('*');
        }
    }

    /**
     * paths-ignore指定の処理
     */
    private static handlePathsIgnore(
        eventConfig: any,
        triggerPaths: string[]
    ): void {
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
