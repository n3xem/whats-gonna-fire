// 共通関数

/**
 * GitHubのリポジトリページまたはPRページかどうかを判定する
 * @param url 判定対象のURL
 * @returns GitHubのリポジトリページまたはPRページの場合はtrue
 */
export function isGitHubRepoOrPRPage(url: string): boolean {
    return !!url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/pull\/(\d+))?/);
}

/**
 * リポジトリURLからownerとrepo名を抽出
 * @param url GitHubリポジトリのURL
 * @returns ownerとrepo名を含むオブジェクト、解析失敗時はnull
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const urlMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
        console.log("GitHubリポジトリURLの解析に失敗しました。");
        return null;
    }

    return {
        owner: urlMatch[1],
        repo: urlMatch[2]
    };
} 
