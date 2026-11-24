const copyIconMarkup =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const checkIconMarkup =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

async function copyText(text: string): Promise<void> {
  // The Clipboard API is available on localhost and HTTPS.
  await navigator.clipboard.writeText(text);
}

function enhanceCodeBlocks(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');

  document
    .querySelectorAll<HTMLPreElement>('.prose pre:not([data-copy-enhanced])')
    .forEach((pre) => {
      pre.dataset.copyEnhanced = 'true';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.before(wrapper);
      wrapper.append(pre);

      const button = document.createElement('button');
      button.className = 'copy-button';
      button.type = 'button';
      button.setAttribute('aria-label', 'Copy code');
      button.innerHTML = copyIconMarkup;
      wrapper.append(button);

      let resetTimer: number | undefined;

      button.addEventListener('click', async () => {
        try {
          await copyText(pre.innerText);
          button.dataset.copied = 'true';
          button.innerHTML = checkIconMarkup;
          button.setAttribute('aria-label', 'Code copied');
          if (status) status.textContent = 'Code copied to clipboard';
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            delete button.dataset.copied;
            button.innerHTML = copyIconMarkup;
            button.setAttribute('aria-label', 'Copy code');
          }, 1800);
        } catch {
          if (status) status.textContent = 'Unable to copy code';
          button.setAttribute('aria-label', 'Unable to copy code');
        }
      });
    });
}

function enhanceHeadingAnchors(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');

  document
    .querySelectorAll<HTMLHeadingElement>(
      '.prose h2[id]:not([data-anchor-enhanced]), .prose h3[id]:not([data-anchor-enhanced])',
    )
    .forEach((heading) => {
      heading.dataset.anchorEnhanced = 'true';
      const title = heading.textContent?.trim() ?? '';

      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${heading.id}`;
      anchor.textContent = '#';
      anchor.setAttribute(
        'aria-label',
        title ? `Copy link to section: ${title}` : 'Copy section link',
      );

      let resetTimer: number | undefined;

      anchor.addEventListener('click', async () => {
        try {
          const shareUrl = new URL(`#${heading.id}`, window.location.href).href;
          await copyText(shareUrl);
          anchor.dataset.copied = 'true';
          if (status) status.textContent = 'Section link copied to clipboard';
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            delete anchor.dataset.copied;
          }, 1600);
        } catch {
          // Hash navigation still succeeds if clipboard access is unavailable.
        }
      });

      heading.append(anchor);
    });
}

export function initContentEnhancements(): void {
  enhanceCodeBlocks();
  enhanceHeadingAnchors();
}
