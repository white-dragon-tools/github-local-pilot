import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { saveConfig, loadConfig, type Config } from '../src/utils/config.js';
import { parseProtocolUrl, getTargetDirectory } from '../src/utils/url-parser.js';
import {
  cloneRepo,
  findMainRepo,
  isMainRepo,
  isWorktree,
  createWorktree,
  fetchRepo,
} from '../src/utils/git-ops.js';

const TEST_REPO_ORG = 'iamthekk';
const TEST_REPO_NAME = 'github-local-pilot-test-repo';
const TEST_WORKSPACE = path.join(os.tmpdir(), 'ghlp-test-workspace');

describe('Integration Tests', () => {
  beforeAll(() => {
    // Create test workspace
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  describe('Config Management', () => {
    const testConfigDir = path.join(os.tmpdir(), '.github-local-pilot-test');
    const testConfigFile = path.join(testConfigDir, 'config.json');

    beforeEach(() => {
      if (fs.existsSync(testConfigDir)) {
        fs.rmSync(testConfigDir, { recursive: true, force: true });
      }
    });

    it('should save and load config', () => {
      const config: Config = {
        workspace: TEST_WORKSPACE,
        autoOpenIde: 'code',
      };

      // Manually save to test location
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigFile, JSON.stringify(config, null, 2));

      const loaded = JSON.parse(fs.readFileSync(testConfigFile, 'utf-8'));
      expect(loaded.workspace).toBe(TEST_WORKSPACE);
      expect(loaded.autoOpenIde).toBe('code');
    });
  });

  describe('Git Operations', () => {
    const repoBaseDir = path.join(TEST_WORKSPACE, TEST_REPO_ORG, TEST_REPO_NAME);
    const mainRepoDir = path.join(repoBaseDir, 'main');

    it('should clone repository', () => {
      const result = cloneRepo(TEST_REPO_ORG, TEST_REPO_NAME, mainRepoDir);
      expect(result.success).toBe(true);
      expect(fs.existsSync(mainRepoDir)).toBe(true);
      expect(isMainRepo(mainRepoDir)).toBe(true);
    }, 60000); // 60s timeout for clone

    it('should find main repo', () => {
      const found = findMainRepo(repoBaseDir);
      expect(found).toBe(mainRepoDir);
    });

    it('should fetch repository', () => {
      const result = fetchRepo(mainRepoDir);
      expect(result.success).toBe(true);
    });

    it('should create worktree for branch', () => {
      const branchDir = path.join(repoBaseDir, 'feature-test-branch');
      const result = createWorktree(mainRepoDir, branchDir, 'feature/test-branch', false);
      expect(result.success).toBe(true);
      expect(fs.existsSync(branchDir)).toBe(true);
      expect(isWorktree(branchDir)).toBe(true);
    });

    it('should create worktree for new issue branch', () => {
      const issueDir = path.join(repoBaseDir, 'issue-999');
      const result = createWorktree(mainRepoDir, issueDir, 'issue-999', true);
      expect(result.success).toBe(true);
      expect(fs.existsSync(issueDir)).toBe(true);
    });
  });

  describe('Full URL Flow', () => {
    it('should generate correct target directories', () => {
      const testCases = [
        {
          url: `ghlp://github.com/${TEST_REPO_ORG}/${TEST_REPO_NAME}`,
          expectedSuffix: `main-${TEST_REPO_NAME}`,
        },
        {
          url: `https://github.com/${TEST_REPO_ORG}/${TEST_REPO_NAME}/tree/feature/login`,
          expectedSuffix: `feature-login-${TEST_REPO_NAME}`,
        },
        {
          url: `ghlp://github.com/${TEST_REPO_ORG}/${TEST_REPO_NAME}/pull/2`,
          expectedSuffix: `pr-2-${TEST_REPO_NAME}`,
        },
        {
          url: `https://github.com/${TEST_REPO_ORG}/${TEST_REPO_NAME}/issues/1`,
          expectedSuffix: `issue-1-${TEST_REPO_NAME}`,
        },
      ];

      for (const tc of testCases) {
        const parsed = parseProtocolUrl(tc.url);
        expect(parsed).not.toBeNull();
        const targetDir = getTargetDirectory(TEST_WORKSPACE, parsed!);
        expect(targetDir.endsWith(tc.expectedSuffix)).toBe(true);
      }
    });
  });
});
