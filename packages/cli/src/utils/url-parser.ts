export type UrlType = 'repo' | 'branch' | 'pr' | 'issue' | 'tag';

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

  // org/repo/releases/tag/v1.0.0 -> treat as tag
  if (typeSegment === 'releases' && parts[3] === 'tag' && parts.length >= 5) {
    const tagName = parts.slice(4).join('/');
    return { org, repo, type: 'tag', identifier: tagName };
  }

  return null;
}

export function getTargetDirectory(
  workspace: string,
  parsed: ParsedUrl,
  customBranch?: string,
  defaultBranch?: string
): string {
  const base = `${workspace}/${parsed.org}/${parsed.repo}`;
  const suffix = `-${parsed.repo}`;

  switch (parsed.type) {
    case 'repo':
      return `${base}/${defaultBranch || 'main'}${suffix}`;
    case 'branch':
      // Replace slashes in branch name with dashes for directory name
      const safeBranchName = parsed.identifier!.replace(/\//g, '-');
      return `${base}/${safeBranchName}${suffix}`;
    case 'pr':
      // Use custom branch (PR branch name) for directory name if provided
      if (customBranch) {
        const safeName = customBranch.replace(/\//g, '-');
        return `${base}/${safeName}${suffix}`;
      }
      return `${base}/pr-${parsed.identifier}${suffix}`;
    case 'issue':
      // Use custom branch for directory name if provided
      if (customBranch) {
        const safeName = customBranch.replace(/\//g, '-');
        return `${base}/${safeName}${suffix}`;
      }
      return `${base}/issue-${parsed.identifier}${suffix}`;
    case 'tag':
      // Tag directory: tag-{name}
      const safeTagName = parsed.identifier!.replace(/\//g, '-');
      return `${base}/tag-${safeTagName}${suffix}`;
  }
}
