(function() {
  'use strict';

  const PAGE_TYPES = {
    ISSUE: /github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/,
    PR: /github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/,
    BRANCH: /github\.com\/[\w.-]+\/[\w.-]+\/tree\/[\w.\-\/]+/,
    REPO: /github\.com\/[\w.-]+\/[\w.-]+\/?$/,
    ISSUE_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/issues\/?(\?.*)?$/,
    PR_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/pulls\/?(\?.*)?$/,
    BRANCH_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/branches/,
    TAG_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/tags/,
    TAG_DETAIL: /github\.com\/[\w.-]+\/[\w.-]+\/releases\/tag\/[^/]+/
  };

  function getPageType() {
    const url = window.location.href;
    if (PAGE_TYPES.ISSUE.test(url)) return 'issue';
    if (PAGE_TYPES.PR.test(url)) return 'pr';
    if (PAGE_TYPES.ISSUE_LIST.test(url)) return 'issue_list';
    if (PAGE_TYPES.PR_LIST.test(url)) return 'pr_list';
    if (PAGE_TYPES.BRANCH_LIST.test(url)) return 'branch_list';
    if (PAGE_TYPES.TAG_LIST.test(url)) return 'tag_list';
    if (PAGE_TYPES.TAG_DETAIL.test(url)) return 'tag_detail';
    if (PAGE_TYPES.BRANCH.test(url)) return 'branch';
    if (PAGE_TYPES.REPO.test(url)) return 'repo';
    return null;
  }

  // Terminal icon SVG (simple, no border) - 16px
  const ICON_SIMPLE = `<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"></path>
  </svg>`;

  // Small icon for list items (12px)
  const ICON_SMALL = `<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"></path>
  </svg>`;

  // Medium icon (14px) for Create PR links
  const ICON_MEDIUM = `<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"></path>
  </svg>`;

  function createButton(pageType, isSimple = false) {
    const button = document.createElement('button');
    button.className = isSimple ? 'github-local-pilot-btn github-local-pilot-btn-simple' : 'btn btn-sm github-local-pilot-btn';
    button.type = 'button';
    
    const tooltips = {
      issue: 'Open this Issue locally',
      pr: 'Open this PR locally',
      branch: 'Open this branch locally',
      repo: 'Open this repo locally',
      tag_detail: 'Open this tag locally'
    };
    
    button.innerHTML = ICON_SIMPLE;
    button.title = tooltips[pageType] || 'Open locally';
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const protocolUrl = window.location.href.replace('https://', 'ghlp://');
      window.location.href = protocolUrl;
    });
    
    return button;
  }

  function createListIcon(url, size = 'small') {
    const link = document.createElement('a');
    link.className = 'github-local-pilot-list-icon';
    link.href = '#';
    link.title = 'Open locally';
    link.innerHTML = size === 'medium' ? ICON_MEDIUM : ICON_SMALL;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const protocolUrl = url.replace('https://', 'ghlp://');
      window.location.href = protocolUrl;
    });
    return link;
  }

  function injectButton() {
    if (document.querySelector('.github-local-pilot-btn')) return;

    const pageType = getPageType();
    if (!pageType) return;

    // Handle list pages separately
    if (pageType === 'issue_list' || pageType === 'pr_list') {
      injectListIcons();
      return;
    }
    
    if (pageType === 'branch_list') {
      injectBranchListIcons();
      return;
    }

    if (pageType === 'tag_list') {
      injectTagListIcons();
      return;
    }

    const isSimple = (pageType === 'repo' || pageType === 'branch' || pageType === 'tag_detail');
    const button = createButton(pageType, isSimple);
    
    if (pageType === 'issue' || pageType === 'pr') {
      // Try multiple possible locations for Issue/PR pages
      const targets = [
        // New GitHub UI (2024+) - find h1 containing issue/PR number
        () => {
          const url = window.location.href;
          const match = url.match(/\/(issues|pull)\/(\d+)/);
          if (match) {
            const number = '#' + match[2];
            const h1s = document.querySelectorAll('h1');
            const target = Array.from(h1s).find(h => h.textContent.includes(number));
            if (target) {
              button.style.marginLeft = '8px';
              target.appendChild(button);
              return true;
            }
          }
          return false;
        },
        // Classic header actions
        () => {
          const actions = document.querySelector('.gh-header-actions');
          if (actions) {
            actions.prepend(button);
            return true;
          }
          return false;
        },
        // Issue title area - insert after title
        () => {
          const title = document.querySelector('.gh-header-title');
          if (title) {
            button.style.marginLeft = '8px';
            button.style.verticalAlign = 'middle';
            title.appendChild(button);
            return true;
          }
          return false;
        }
      ];
      
      for (const tryInject of targets) {
        if (tryInject()) return;
      }
      
      setTimeout(injectButton, 500);
    } else if (pageType === 'tag_detail') {
      // Tag detail page - insert next to tag name in breadcrumb
      const targets = [
        // New GitHub UI - breadcrumb with selected item
        () => {
          const selectedItem = document.querySelector('.breadcrumb-item-selected');
          if (selectedItem) {
            button.style.marginLeft = '8px';
            button.style.verticalAlign = 'middle';
            selectedItem.appendChild(button);
            return true;
          }
          return false;
        },
        // Fallback: release header
        () => {
          const releaseHeader = document.querySelector('.release-header, [class*="release"]');
          if (releaseHeader) {
            const title = releaseHeader.querySelector('h1, .f1');
            if (title) {
              button.style.marginLeft = '8px';
              title.appendChild(button);
              return true;
            }
          }
          return false;
        },
        // Fallback: any h1
        () => {
          const h1 = document.querySelector('h1');
          if (h1 && h1.textContent) {
            button.style.marginLeft = '8px';
            h1.appendChild(button);
            return true;
          }
          return false;
        }
      ];
      
      for (const tryInject of targets) {
        if (tryInject()) return;
      }
      
      setTimeout(injectButton, 500);
    } else {
      // Branch/Repo pages - insert next to branch selector
      const targets = [
        () => {
          const branchBtn = document.querySelector('.overview-ref-selector');
          if (branchBtn) {
            const row = branchBtn.parentElement?.parentElement;
            if (row) {
              button.style.marginLeft = '8px';
              row.appendChild(button);
              return true;
            }
          }
          return false;
        },
        () => {
          const branchSelector = document.querySelector('[data-hotkey="w"]');
          if (branchSelector) {
            const container = branchSelector.closest('.file-navigation') || branchSelector.parentNode;
            if (container) {
              button.style.marginLeft = '8px';
              container.appendChild(button);
              return true;
            }
          }
          return false;
        }
      ];
      
      for (const tryInject of targets) {
        if (tryInject()) return;
      }
      
      setTimeout(injectButton, 500);
    }
  }

  function injectListIcons() {
    // New GitHub React UI (2024+) - issues/PRs list
    // Icon should be placed after the description line (e.g., "#35665 · author opened on date")
    
    // Method 1: React UI with data-testid - find description area
    document.querySelectorAll('a[data-testid="issue-pr-title-link"]').forEach(link => {
      const row = link.closest('[class*="IssueRow-module__row"]') || link.closest('li') || link.closest('[class*="ListItem"]');
      if (!row || row.querySelector('.github-local-pilot-list-icon')) return;
      
      const href = link.href;
      if (!href.match(/\/(issues|pull)\/\d+/)) return;
      
      const icon = createListIcon(href);
      icon.style.marginLeft = '8px';
      icon.style.flexShrink = '0';
      
      // Find description area - contains "#number · author opened"
      const descriptionArea = row.querySelector('[class*="Description-module"]') || 
                              row.querySelector('[data-testid="list-row-repo-name-and-number"]') ||
                              row.querySelector('[class*="descriptionItem"]');
      if (descriptionArea) {
        descriptionArea.style.display = 'inline-flex';
        descriptionArea.style.alignItems = 'center';
        descriptionArea.appendChild(icon);
        return;
      }
      
      // Fallback: insert after title container
      const titleContainer = link.closest('[class*="Title-module__container"]') || link.closest('h3')?.parentElement;
      if (titleContainer) {
        titleContainer.parentElement?.appendChild(icon);
      }
    });

    // Method 2: Find by data-id attribute (older React UI)
    document.querySelectorAll('[data-id]').forEach(el => {
      const id = el.getAttribute('data-id');
      if (!id || el.querySelector('.github-local-pilot-list-icon')) return;
      
      const link = el.querySelector('a[href*="/issues/"], a[href*="/pull/"]');
      if (!link) return;
      
      const href = link.href;
      if (!href.match(/\/(issues|pull)\/\d+/)) return;
      
      const icon = createListIcon(href);
      
      // Find description/meta area
      const meta = el.querySelector('.opened-by, .text-small, [class*="description"]');
      if (meta) {
        icon.style.marginLeft = '8px';
        meta.appendChild(icon);
      }
    });

    // Method 3: Classic selectors (legacy UI - PR list uses this)
    const selectors = [
      '[id^="issue_"]',
      '.js-issue-row'
    ];
    
    document.querySelectorAll(selectors.join(', ')).forEach(row => {
      if (row.querySelector('.github-local-pilot-list-icon')) return;
      
      const link = row.querySelector('a[href*="/issues/"], a[href*="/pull/"]');
      if (!link) return;
      
      const href = link.href;
      if (!href.match(/\/(issues|pull)\/\d+/)) return;
      
      const icon = createListIcon(href);
      icon.style.marginLeft = '8px';
      
      // Find the opened-by or meta area
      const meta = row.querySelector('.opened-by, .text-small');
      if (meta) {
        meta.appendChild(icon);
      }
    });
  }

  function injectBranchListIcons() {
    const branchRows = document.querySelectorAll('.branch-name, [class*="BranchName"], a[href*="/tree/"]');
    
    branchRows.forEach(branchElement => {
      const row = branchElement.closest('tr') || branchElement.closest('li') || branchElement.closest('div[class*="Box-row"]') || branchElement.parentElement;
      if (!row || row.querySelector('.github-local-pilot-list-icon')) return;
      
      let branchUrl;
      if (branchElement.tagName === 'A') {
        branchUrl = branchElement.href;
      } else {
        const link = row.querySelector('a[href*="/tree/"]');
        if (link) branchUrl = link.href;
      }
      
      if (!branchUrl || !branchUrl.includes('/tree/')) return;
      
      const icon = createListIcon(branchUrl);
      icon.style.marginLeft = '8px';
      
      if (branchElement.tagName === 'A') {
        branchElement.parentElement.appendChild(icon);
      } else {
        branchElement.appendChild(icon);
      }
    });
  }

  function injectTagListIcons() {
    // Find tag entries on tags page
    const tagLinks = document.querySelectorAll('a[href*="/releases/tag/"], a[href*="/tree/"]');
    
    tagLinks.forEach(link => {
      if (!link.href.includes('/releases/tag/') && !link.href.match(/\/tree\/v?\d/)) return;
      
      const row = link.closest('div[class*="Box-row"]') || link.closest('li') || link.closest('tr') || link.parentElement;
      if (!row || row.querySelector('.github-local-pilot-list-icon')) return;
      
      // Convert releases/tag URL to tree URL for the protocol
      let tagUrl = link.href;
      if (tagUrl.includes('/releases/tag/')) {
        tagUrl = tagUrl.replace('/releases/tag/', '/tree/');
      }
      
      const icon = createListIcon(tagUrl);
      icon.style.marginLeft = '8px';
      
      link.parentElement.appendChild(icon);
    });
  }

  function injectCreatePRIcons() {
    // Find all "Create PR" links in issue comments
    const createPRLinks = document.querySelectorAll('a[href*="/compare/"][href*="quick_pull=1"]');
    
    createPRLinks.forEach(link => {
      // Check if icon already exists after this link
      if (link.nextElementSibling?.classList?.contains('github-local-pilot-list-icon')) return;
      
      // Extract branch URL from compare URL
      const href = link.href;
      const match = href.match(/\/compare\/[^.]+\.\.\.([^?]+)/);
      if (!match) return;
      
      const branchName = decodeURIComponent(match[1]);
      const repoMatch = href.match(/github\.com\/([^/]+\/[^/]+)\/compare/);
      if (!repoMatch) return;
      
      const branchUrl = `https://github.com/${repoMatch[1]}/tree/${branchName}`;
      const icon = createListIcon(branchUrl, 'medium');
      icon.style.marginLeft = '8px';
      
      // Insert AFTER the "Create PR" link with a bullet separator
      const separator = document.createTextNode(' • ');
      link.parentElement.insertBefore(separator, link.nextSibling);
      link.parentElement.insertBefore(icon, separator.nextSibling);
    });
  }

  function init() {
    injectButton();
    injectCreatePRIcons();

    document.addEventListener('pjax:end', () => {
      injectButton();
      injectCreatePRIcons();
    });
    document.addEventListener('turbo:render', () => {
      injectButton();
      injectCreatePRIcons();
    });
    
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.github-local-pilot-btn')) {
        injectButton();
      }
      injectCreatePRIcons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
