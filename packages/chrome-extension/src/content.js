(function() {
  'use strict';

  const PAGE_TYPES = {
    ISSUE: /github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/,
    PR: /github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/,
    BRANCH: /github\.com\/[\w.-]+\/[\w.-]+\/tree\/[\w.\-\/]+/,
    REPO: /github\.com\/[\w.-]+\/[\w.-]+\/?$/,
    ISSUE_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/issues\/?(\?.*)?$/,
    PR_LIST: /github\.com\/[\w.-]+\/[\w.-]+\/pulls\/?(\?.*)?$/
  };

  function getPageType() {
    const url = window.location.href;
    if (PAGE_TYPES.ISSUE.test(url)) return 'issue';
    if (PAGE_TYPES.PR.test(url)) return 'pr';
    if (PAGE_TYPES.ISSUE_LIST.test(url)) return 'issue_list';
    if (PAGE_TYPES.PR_LIST.test(url)) return 'pr_list';
    if (PAGE_TYPES.BRANCH.test(url)) return 'branch';
    if (PAGE_TYPES.REPO.test(url)) return 'repo';
    return null;
  }

  // Terminal icon SVG (simple, no border)
  const ICON_SIMPLE = `<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"></path>
  </svg>`;

  // Small icon for list items (12px)
  const ICON_SMALL = `<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"></path>
  </svg>`;

  function waitForElement(selector, callback, maxAttempts = 50) {
    let attempts = 0;
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        callback(element);
      } else if (++attempts >= maxAttempts) {
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    const element = document.querySelector(selector);
    if (element) {
      observer.disconnect();
      callback(element);
    }
  }

  function createButton(pageType, isSimple = false) {
    const button = document.createElement('button');
    button.className = isSimple ? 'github-local-pilot-btn github-local-pilot-btn-simple' : 'btn btn-sm github-local-pilot-btn';
    button.type = 'button';
    
    const tooltips = {
      issue: 'Open this Issue locally',
      pr: 'Open this PR locally',
      branch: 'Open this branch locally',
      repo: 'Open this repo locally'
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

  function createListIcon(url) {
    const link = document.createElement('a');
    link.className = 'github-local-pilot-list-icon';
    link.href = '#';
    link.title = 'Open locally';
    link.innerHTML = ICON_SMALL;
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

    const isSimple = (pageType === 'repo' || pageType === 'branch');
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
      
      // If nothing found, wait and retry
      setTimeout(injectButton, 500);
    } else {
      // Branch/Repo pages - insert next to branch selector
      const targets = [
        // New GitHub UI - overview-ref-selector
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
        // Classic file-navigation
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
    // Find all issue/PR rows that don't have icons yet
    const rows = document.querySelectorAll('[data-testid="issue-row"], [id^="issue_"]');
    rows.forEach(row => {
      if (row.querySelector('.github-local-pilot-list-icon')) return;
      
      // Find the link to the issue/PR
      const link = row.querySelector('a[href*="/issues/"], a[href*="/pull/"]');
      if (!link) return;
      
      const url = link.href;
      const icon = createListIcon(url);
      
      // Find the metadata area (opened by xxx)
      const meta = row.querySelector('.opened-by, [class*="ItemMetadata"], .text-small');
      if (meta) {
        meta.appendChild(icon);
      }
    });
  }

  function init() {
    injectButton();

    document.addEventListener('pjax:end', injectButton);
    document.addEventListener('turbo:render', injectButton);
    
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.github-local-pilot-btn')) {
        injectButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
