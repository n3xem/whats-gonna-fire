// 共通関数

/**
 * GitHubのリポジトリページまたはPRページかどうかを判定する
 * @param url 判定対象のURL
 * @returns GitHubのリポジトリページまたはPRページの場合はtrue
 */
export function isGitHubRepoOrPRPage(url: string): boolean {
    return !!url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/pull\/(\d+))?/);
} 
