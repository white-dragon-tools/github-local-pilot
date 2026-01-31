export type UrlType = 'repo' | 'branch' | 'pr' | 'issue';

export interface ParsedUrl {
  org: string;
  repo: string;
  type: UrlType;
  identifier?: string; // branch name, PR number, or Issue number
}

export function parseProtocolUrl(url: string): ParsedUrl | null {
  // Normalize URL: support both ghlp://github.com/ and https://github.com/
  let normalized = url;
  if (url.startsWith('https://github.com/')) {
    normalized = url.replace('https://github.com/', '');
  } else if (url.startsWith('ghlp://github.com/')) {
    normalized = url.replace('ghlp://github.com/', '');
  } else {
    return null;
  }
  
  if (!normalized) {
    return null;
  }

  const parts = normalized.split('/');
  
  if (parts.length < 2) {
    return null;
  }

  const org = parts[0];
  const repo = parts[1];

  if (!org || !repo) {
    return null;
  }

  // org/repo
  if (parts.length === 2) {
    return { org, repo, type: 'repo' };
  }

  const typeSegment = parts[2];

  // org/repo/tree/branch-name
  if (typeSegment === 'tree' && parts.length >= 4) {
    const branchName = parts.slice(3).join('/');
    return { org, repo, type: 'branch', identifier: branchName };
  }

  // org/repo/pull/123
  if (typeSegment === 'pull' && parts.length === 4) {
    const prNumber = parts[3];
    if (!/^\d+$/.test(prNumber)) {
      return null;
    }
    return { org, repo, type: 'pr', identifier: prNumber };
  }

  // org/repo/issues/123
  if (typeSegment === 'issues' && parts.length === 4) {
    const issueNumber = parts[3];
    if (!/^\d+$/.test(issueNumber)) {
      return null;
    }
    return { org, repo, type: 'issue', identifier: issueNumber };
  }

  return null;
}

export function getTargetDirectory(
  workspace: string,
  parsed: ParsedUrl,
  customBranch?: string
): string {
  const base = `${workspace}/${parsed.org}/${parsed.repo}`;

  switch (parsed.type) {
    case 'repo':
      return `${base}/main`;
    case 'branch':
      // Replace slashes in branch name with dashes for directory name
      const safeBranchName = parsed.identifier!.replace(/\//g, '-');
      return `${base}/${safeBranchName}`;
    case 'pr':
      return `${base}/pr-${parsed.identifier}`;
    case 'issue':
      // Use custom branch for directory name if provided
      if (customBranch) {
        const safeName = customBranch.replace(/\//g, '-');
        return `${base}/${safeName}`;
      }
      return `${base}/issue-${parsed.identifier}`;
  }
}
