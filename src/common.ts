// 共通関数

/**
 * GitHubのPRページかどうかを判定する
 * @param url 判定対象のURL
 * @returns GitHubのPRページの場合はtrue
 */
export function isGitHubPRPage(url: string): boolean {
    return !!url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
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

/**
 * PRのURLからowner、repo、PR番号を抽出
 * @param url GitHub PRのURL
 * @returns owner、repo、PR番号を含むオブジェクト、解析失敗時はnull
 */
export function parsePRUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
    const urlMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!urlMatch) {
        console.log("GitHub PRのURLの解析に失敗しました。");
        return null;
    }

    return {
        owner: urlMatch[1],
        repo: urlMatch[2],
        prNumber: parseInt(urlMatch[3], 10)
    };
}

/**
 * PRのURLからリポジトリのURLに変換
 * @param prUrl GitHub PRのURL
 * @returns リポジトリのURL、解析失敗時はnull
 */
export function convertPRUrlToRepoUrl(prUrl: string): string | null {
    const prInfo = parsePRUrl(prUrl);
    if (!prInfo) {
        return null;
    }

    return `https://github.com/${prInfo.owner}/${prInfo.repo}`;
}

