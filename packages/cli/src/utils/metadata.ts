import * as fs from 'node:fs';
import * as path from 'node:path';

export type OriginType = 'pr' | 'issue' | 'branch' | 'tag' | 'repo' | 'external';

export interface GhlpMetadata {
  originalUrl: string;        // 原始输入的 URL
  originType: OriginType;     // 原始 URL 的类型（根据原始 URL 推断）
  mapped: boolean;            // 是否经过映射
  mappedUrl?: string;         // 映射后的 URL（如果有映射）
  type: 'repo' | 'branch' | 'pr' | 'issue' | 'tag';
  org: string;
  repo: string;
  identifier?: string;        // issue/pr 编号或分支名
  branch: string;             // 实际创建的分支名
  createdAt: string;          // ISO 时间戳
}

export function writeMetadata(targetDir: string, metadata: GhlpMetadata): void {
  const metadataPath = path.join(targetDir, '.ghlp-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export function inferOriginType(url: string): OriginType {
  // Normalize URL
  let normalized = url;
  if (url.startsWith('ghlp://')) {
    normalized = url.replace('ghlp://', 'https://');
  }
  
  // Check if it's a GitHub URL
  if (!normalized.includes('github.com/')) {
    return 'external';
  }
  
  // Parse GitHub URL patterns
  if (/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/.test(normalized)) {
    return 'pr';
  }
  if (/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/.test(normalized)) {
    return 'issue';
  }
  if (/github\.com\/[\w.-]+\/[\w.-]+\/releases\/tag\//.test(normalized)) {
    return 'tag';
  }
  if (/github\.com\/[\w.-]+\/[\w.-]+\/tree\//.test(normalized)) {
    return 'branch';
  }
  if (/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(normalized)) {
    return 'repo';
  }
  
  return 'external';
}
