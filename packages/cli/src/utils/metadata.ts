import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GhlpMetadata {
  originalUrl: string;        // 原始输入的 URL
  mapped: boolean;            // 是否经过映射
  mappedUrl?: string;         // 映射后的 URL（如果有映射）
  type: 'repo' | 'branch' | 'pr' | 'issue';
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
