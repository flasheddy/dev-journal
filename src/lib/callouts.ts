import type { Element, ElementContent, Properties } from 'hast';
import type { HastPluginDefinition, HastVisitorContext } from 'satteri';

export type CalloutKind = 'note' | 'tip' | 'warning' | 'danger';

type CalloutContent = Element['children'];

type CalloutMarker = {
  kind: CalloutKind;
  rest: string;
};

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
};

const CALLOUT_MARKER =
  /^[ \t]{0,3}\[!(NOTE|TIP|WARNING|DANGER)\](?=[ \t\r\n]|$)[ \t]*(?:\r?\n[ \t]*)?/;

function isWhitespaceText(node: ElementContent | undefined): boolean {
  return node?.type === 'text' && node.value.trim() === '';
}

/**
 * Read a GitHub-style callout marker from the beginning of a paragraph.
 * Only the four supported, uppercase markers match. The returned `rest` value
 * is the paragraph text with the marker and its trailing break removed.
 */
export function readCalloutMarker(text: string): CalloutMarker | undefined {
  const match = CALLOUT_MARKER.exec(text);
  if (!match) return undefined;

  return {
    kind: match[1].toLowerCase() as CalloutKind,
    rest: text.slice(match[0].length),
  };
}

/** Strip a leading callout marker while preserving the remaining prose. */
export function stripCalloutMarker(text: string): string {
  return readCalloutMarker(text)?.rest ?? text;
}

function firstContentElement(blockquote: Element): Element | undefined {
  for (const child of blockquote.children) {
    if (isWhitespaceText(child)) continue;
    return child.type === 'element' ? child : undefined;
  }
  return undefined;
}

function trimFormattingWhitespace(children: CalloutContent): CalloutContent {
  let start = 0;
  let end = children.length;

  while (start < end && isWhitespaceText(children[start])) start += 1;
  while (end > start && isWhitespaceText(children[end - 1])) end -= 1;

  return children.slice(start, end);
}

function replaceMarkerParagraph(paragraph: Element, marker: CalloutMarker): Element | undefined {
  const firstChild = paragraph.children[0];
  if (firstChild?.type !== 'text') return paragraph;

  const children = [...paragraph.children];
  if (marker.rest === '') {
    children.shift();
  } else {
    children[0] = { ...firstChild, value: marker.rest };
  }

  if (children.every((child) => child.type === 'text' && child.value.trim() === '')) {
    return undefined;
  }

  return { ...paragraph, children };
}

/**
 * Build the callout body from a blockquote. Returns `undefined` when the
 * blockquote does not begin with a supported marker, so ordinary quotes keep
 * their native semantics.
 */
export function extractCallout(
  blockquote: Element,
): { kind: CalloutKind; children: CalloutContent } | undefined {
  if (blockquote.tagName !== 'blockquote') return undefined;

  const paragraph = firstContentElement(blockquote);
  if (!paragraph || paragraph.tagName !== 'p') return undefined;

  const firstChild = paragraph.children[0];
  if (firstChild?.type !== 'text') return undefined;

  const marker = readCalloutMarker(firstChild.value);
  if (!marker) return undefined;

  const bodyParagraph = replaceMarkerParagraph(paragraph, marker);
  const children = blockquote.children
    .map((child) => (child === paragraph ? bodyParagraph : child))
    .filter((child): child is ElementContent => child !== undefined);

  return {
    kind: marker.kind,
    children: trimFormattingWhitespace(children),
  };
}

function iconPaths(kind: CalloutKind): CalloutContent {
  if (kind === 'note') {
    return [
      {
        type: 'element',
        tagName: 'circle',
        properties: { cx: '12', cy: '12', r: '9' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M12 11v5' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M12 8h.01' },
        children: [],
      },
    ];
  }

  if (kind === 'tip') {
    return [
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M12 3a6 6 0 0 0-3.6 10.8V16h7.2v-2.2A6 6 0 0 0 12 3z' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M9.5 19h5' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M10.5 22h3' },
        children: [],
      },
    ];
  }

  if (kind === 'warning') {
    return [
      {
        type: 'element',
        tagName: 'path',
        properties: {
          d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
        },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M12 9v4' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M12 17h.01' },
        children: [],
      },
    ];
  }

  return [
    {
      type: 'element',
      tagName: 'path',
      properties: { d: 'M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9L7.9 2z' },
      children: [],
    },
    {
      type: 'element',
      tagName: 'path',
      properties: { d: 'M12 8v5' },
      children: [],
    },
    {
      type: 'element',
      tagName: 'path',
      properties: { d: 'M12 16.5h.01' },
      children: [],
    },
  ];
}

function createIcon(kind: CalloutKind): Element {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: ['callout__icon'],
      viewBox: '0 0 24 24',
      width: '16',
      height: '16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ariaHidden: 'true',
    },
    children: iconPaths(kind),
  };
}

function createTitle(kind: CalloutKind, id: string): Element {
  return {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout__title'], id },
    children: [
      createIcon(kind),
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['callout__label'] },
        children: [{ type: 'text', value: CALLOUT_LABELS[kind] }],
      },
    ],
  };
}

export function createCallout(kind: CalloutKind, id: string, body: CalloutContent): Element {
  return {
    type: 'element',
    tagName: 'aside',
    properties: {
      className: ['callout', `callout--${kind}`],
      role: 'note',
      'aria-labelledby': id,
    } as Properties,
    children: [
      createTitle(kind, id),
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['callout__body'] },
        children: body,
      },
    ],
  };
}

function nextCalloutId(ctx: HastVisitorContext, kind: CalloutKind): string {
  const data = ctx.data as {
    calloutCounts?: Partial<Record<CalloutKind, number>>;
  };
  const counts = (data.calloutCounts ??= {});
  const count = (counts[kind] ?? 0) + 1;
  counts[kind] = count;

  return `callout-${kind}-${count}`;
}

/**
 * Astro 7 runs Sätteri for Markdown. Its HAST plugins use the same tree shapes
 * as rehype, so callouts stay a build-time transform with no client cost.
 */
export const calloutPlugin: HastPluginDefinition = {
  name: 'callouts',
  element: {
    filter: ['blockquote'],
    visit(node, ctx) {
      const marker = extractCallout(node);
      if (!marker) return;

      return createCallout(marker.kind, nextCalloutId(ctx, marker.kind), marker.children);
    },
  },
};

/** Wrap tables so wide Markdown tables scroll inside the reading column. */
export const tableWrapperPlugin: HastPluginDefinition = {
  name: 'table-wrappers',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      ctx.wrapNode(node, {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-wrapper'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: 'Scrollable table',
        },
        children: [],
      });
    },
  },
};
