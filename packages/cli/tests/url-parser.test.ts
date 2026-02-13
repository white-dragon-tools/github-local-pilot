import { describe, it, expect } from 'vitest';
import { parseProtocolUrl, getTargetDirectory, ParsedUrl } from '../src/utils/url-parser.js';

describe('parseProtocolUrl', () => {
  describe('ghlp://github.com/ protocol', () => {
    it('should parse basic repo URL', () => {
      const result = parseProtocolUrl('ghlp://github.com/iamthekk/github-local-pilot-test-repo');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'github-local-pilot-test-repo',
        type: 'repo',
      });
    });

    it('should parse branch URL', () => {
      const result = parseProtocolUrl('ghlp://github.com/iamthekk/repo/tree/feature/test-branch');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'branch',
        identifier: 'feature/test-branch',
      });
    });

    it('should parse PR URL', () => {
      const result = parseProtocolUrl('ghlp://github.com/iamthekk/repo/pull/123');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'pr',
        identifier: '123',
      });
    });

    it('should parse Issue URL', () => {
      const result = parseProtocolUrl('ghlp://github.com/iamthekk/repo/issues/456');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'issue',
        identifier: '456',
      });
    });
  });

  describe('https://github.com/ URLs', () => {
    it('should parse basic repo URL', () => {
      const result = parseProtocolUrl('https://github.com/iamthekk/github-local-pilot-test-repo');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'github-local-pilot-test-repo',
        type: 'repo',
      });
    });

    it('should parse branch URL', () => {
      const result = parseProtocolUrl('https://github.com/iamthekk/repo/tree/feature/test-branch');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'branch',
        identifier: 'feature/test-branch',
      });
    });

    it('should parse simple branch URL', () => {
      const result = parseProtocolUrl('https://github.com/org/repo/tree/main');
      expect(result).toEqual({
        org: 'org',
        repo: 'repo',
        type: 'branch',
        identifier: 'main',
      });
    });

    it('should parse PR URL', () => {
      const result = parseProtocolUrl('https://github.com/iamthekk/repo/pull/123');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'pr',
        identifier: '123',
      });
    });

    it('should parse Issue URL', () => {
      const result = parseProtocolUrl('https://github.com/iamthekk/repo/issues/456');
      expect(result).toEqual({
        org: 'iamthekk',
        repo: 'repo',
        type: 'issue',
        identifier: '456',
      });
    });
  });

  describe('invalid URLs', () => {
    it('should return null for empty URL', () => {
      expect(parseProtocolUrl('')).toBeNull();
      expect(parseProtocolUrl('ghlp://github.com/')).toBeNull();
      expect(parseProtocolUrl('https://github.com/')).toBeNull();
    });

    it('should return null for URL with only org', () => {
      expect(parseProtocolUrl('ghlp://github.com/org')).toBeNull();
      expect(parseProtocolUrl('https://github.com/org')).toBeNull();
    });

    it('should return null for unknown type', () => {
      expect(parseProtocolUrl('ghlp://github.com/org/repo/unknown/123')).toBeNull();
      expect(parseProtocolUrl('https://github.com/org/repo/unknown/123')).toBeNull();
    });

    it('should return null for non-numeric PR number', () => {
      expect(parseProtocolUrl('ghlp://github.com/org/repo/pull/abc')).toBeNull();
      expect(parseProtocolUrl('https://github.com/org/repo/pull/abc')).toBeNull();
    });

    it('should return null for non-numeric Issue number', () => {
      expect(parseProtocolUrl('ghlp://github.com/org/repo/issues/abc')).toBeNull();
      expect(parseProtocolUrl('https://github.com/org/repo/issues/abc')).toBeNull();
    });

    it('should return null for unsupported protocols', () => {
      expect(parseProtocolUrl('http://github.com/org/repo')).toBeNull();
      expect(parseProtocolUrl('ftp://github.com/org/repo')).toBeNull();
      expect(parseProtocolUrl('ghlp://org/repo')).toBeNull(); // missing github.com
      expect(parseProtocolUrl('org/repo')).toBeNull();
    });
  });
});

describe('getTargetDirectory', () => {
  const workspace = 'D:/workspace';

  it('should generate directory for repo', () => {
    const parsed: ParsedUrl = { org: 'iamthekk', repo: 'test-repo', type: 'repo' };
    expect(getTargetDirectory(workspace, parsed)).toBe('D:/workspace/iamthekk/test-repo/main-test-repo');
  });

  it('should generate directory for branch', () => {
    const parsed: ParsedUrl = { org: 'iamthekk', repo: 'test-repo', type: 'branch', identifier: 'feature/login' };
    expect(getTargetDirectory(workspace, parsed)).toBe('D:/workspace/iamthekk/test-repo/feature-login-test-repo');
  });

  it('should generate directory for PR', () => {
    const parsed: ParsedUrl = { org: 'iamthekk', repo: 'test-repo', type: 'pr', identifier: '123' };
    expect(getTargetDirectory(workspace, parsed)).toBe('D:/workspace/iamthekk/test-repo/pr-123-test-repo');
  });

  it('should generate directory for Issue', () => {
    const parsed: ParsedUrl = { org: 'iamthekk', repo: 'test-repo', type: 'issue', identifier: '456' };
    expect(getTargetDirectory(workspace, parsed)).toBe('D:/workspace/iamthekk/test-repo/issue-456-test-repo');
  });
});
