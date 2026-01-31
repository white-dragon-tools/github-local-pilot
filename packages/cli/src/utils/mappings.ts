import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { OriginType } from './metadata.js';

export interface UrlMapping {
  from: string;           // 正则表达式
  to: string;             // 目标 URL 模板，支持 $1, $2 等
  branch?: string;        // 可选：自定义分支名模板
  originType?: OriginType; // 可选：指定原始 URL 的类型，默认 'external'
}

// Workspace config (stored in {workspace}/.ghlp/config.yaml)
export interface WorkspaceConfig {
  autoOpenIde?: string;
  mappings?: UrlMapping[];
}

export function getWorkspaceConfigPath(workspace: string): string {
  return path.join(workspace, '.ghlp', 'config.yaml');
}

export function loadWorkspaceConfig(workspace: string): WorkspaceConfig {
  const configPath = getWorkspaceConfigPath(workspace);
  
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    if (!content.trim()) {
      return {};
    }
    const config = parseYaml(content) as WorkspaceConfig;
    return config || {};
  } catch (err) {
    // File exists but failed to parse - return empty config
    return {};
  }
}

export interface MappingResult {
  url: string;
  branch?: string;
  originType?: OriginType;
}

export function applyMappings(url: string, mappings: UrlMapping[] | undefined): MappingResult {
  if (!mappings || mappings.length === 0) {
    return { url };
  }

  // Normalize ghlp:// to https:// for matching
  let normalizedUrl = url;
  if (url.startsWith('ghlp://github.com/')) {
    normalizedUrl = url.replace('ghlp://github.com/', 'https://github.com/');
  }

  for (const mapping of mappings) {
    try {
      const regex = new RegExp(mapping.from);
      const match = normalizedUrl.match(regex);
      
      if (match) {
        // 替换 $1, $2 等捕获组
        let targetUrl = mapping.to;
        let targetBranch = mapping.branch;
        
        for (let i = 1; i < match.length; i++) {
          const placeholder = `$${i}`;
          targetUrl = targetUrl.replace(placeholder, match[i]);
          if (targetBranch) {
            targetBranch = targetBranch.replace(placeholder, match[i]);
          }
        }
        
        return {
          url: targetUrl,
          branch: targetBranch,
          originType: mapping.originType || 'external',
        };
      }
    } catch (err) {
      // Invalid regex, skip
      continue;
    }
  }
  
  // No mapping matched, return original
  return { url };
}
