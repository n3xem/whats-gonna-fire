// GitHub APIとの通信を担当するサービス
import { RepoInfo, WorkflowsResponse, PullRequestFile } from './types';

export class GitHubApiService {
    /**
     * リポジトリの情報を取得
     */
    static async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) {
            throw new Error(`GitHub API エラー: ${response.status}`);
        }
        return await response.json() as RepoInfo;
    }

    /**
     * ワークフロー一覧を取得
     */
    static async getWorkflows(owner: string, repo: string): Promise<WorkflowsResponse> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`);
        if (!response.ok) {
            throw new Error(`GitHub API エラー: ${response.status}`);
        }
        return await response.json() as WorkflowsResponse;
    }

    /**
     * 生のファイル内容を取得
     */
    static async getRawFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}`;
        const response = await fetch(rawUrl);

        if (!response.ok) {
            throw new Error(`ファイル取得エラー: ${response.status}`);
        }

        return await response.text();
    }

    /**
     * PRの差分ファイル一覧を取得
     */
    static async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<PullRequestFile[]> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
        if (!response.ok) {
            throw new Error(`GitHub API エラー: ${response.status}`);
        }
        return await response.json() as PullRequestFile[];
    }
} 
