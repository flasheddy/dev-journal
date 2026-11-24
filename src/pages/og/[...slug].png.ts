import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { formatDate, getPosts, postTags } from '../../lib/posts';
import { site } from '../../lib/site';

export const prerender = true;

const WIDTH = 1200;
const HEIGHT = 630;

type CardData = {
  title: string;
  description: string;
  tags: string[];
  date?: string;
};

type Style = Record<string, string | number>;
type Child = string | Element | null | undefined | Child[];
type Element = {
  type: string;
  props: {
    style: Style;
    children?: Child;
  };
};

function el(type: string, style: Style, children?: Child): Element {
  return { type, props: { style, children } };
}

function cardElement(card: CardData): Element {
  const isPost = Boolean(card.date);
  const titleSize = card.title.length > 96 ? 50 : card.title.length > 72 ? 56 : isPost ? 64 : 78;
  const tags = card.tags.slice(0, 4);

  return el(
    'div',
    {
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      padding: '54px 64px 46px 78px',
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      fontFamily: 'Inter',
    },
    [
      el('div', {
        position: 'absolute',
        top: '-160px',
        right: '-110px',
        width: '420px',
        height: '420px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(203, 166, 247, 0.09)',
      }),
      el('div', {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '8px',
        height: '100%',
        backgroundColor: '#cba6f7',
      }),
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        },
        [
          el('div', { display: 'flex', alignItems: 'center', gap: '14px' }, [
            el('div', {
              width: '12px',
              height: '12px',
              borderRadius: '9999px',
              backgroundColor: '#cba6f7',
            }),
            el(
              'div',
              {
                fontSize: '18px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#a6adc8',
              },
              site.title,
            ),
          ]),
          el(
            'div',
            {
              fontSize: '16px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#6c7086',
            },
            isPost ? 'Article' : 'Static site',
          ),
        ],
      ),
      el(
        'div',
        {
          display: 'flex',
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          gap: '18px',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            },
            [
              el('span', { color: '#cba6f7' }, isPost ? 'Field notes' : 'Engineering journal'),
              ...(card.date
                ? [
                    el('span', { color: '#585b70' }, '·'),
                    el('span', { color: '#a6adc8' }, card.date),
                  ]
                : []),
            ],
          ),
          el(
            'div',
            {
              display: 'block',
              fontSize: `${titleSize}px`,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#cdd6f4',
              lineClamp: 3,
              overflow: 'hidden',
            },
            card.title,
          ),
          el(
            'div',
            {
              display: 'block',
              fontSize: '24px',
              lineHeight: 1.45,
              color: '#a6adc8',
              lineClamp: 3,
              overflow: 'hidden',
            },
            card.description,
          ),
        ],
      ),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
        },
        [
          tags.length > 0
            ? el(
                'div',
                { display: 'flex', flexWrap: 'wrap', gap: '10px' },
                tags.map((tag) =>
                  el(
                    'div',
                    {
                      padding: '6px 13px',
                      border: '1px solid #45475a',
                      borderRadius: '9999px',
                      backgroundColor: '#313244',
                      fontSize: '16px',
                      color: '#cdd6f4',
                    },
                    tag,
                  ),
                ),
              )
            : null,
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '16px',
              borderTop: '1px solid #313244',
            },
            [
              el(
                'span',
                {
                  fontSize: '16px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#6c7086',
                },
                isPost ? 'Dev Journal · Article' : 'Dev Journal · Site',
              ),
              el('span', { fontSize: '18px', color: '#cba6f7' }, 'hech.dev'),
            ],
          ),
        ],
      ),
    ],
  );
}

let fontPromise: Promise<Buffer> | undefined;

function loadFont(): Promise<Buffer> {
  // Astro's build and dev commands run from the project root. Keeping the font
  // in-repo makes local, CI, and AI Studio builds produce identical cards.
  fontPromise ??= readFile(resolve(process.cwd(), 'src/assets/fonts/InterVariable.ttf'));
  return fontPromise;
}

export async function getStaticPaths() {
  const posts = await getPosts();

  return [
    {
      params: { slug: 'default' },
      props: {
        card: {
          title: site.title,
          description: site.description,
          tags: ['Rust', 'Python', 'Local-first'],
        },
      },
    },
    ...posts.map((post) => ({
      params: { slug: post.id },
      props: {
        card: {
          title: post.data.title,
          description: post.data.description,
          tags: postTags(post),
          date: formatDate(post.data.date, 'long'),
        },
      },
    })),
  ];
}

interface Props {
  card: CardData;
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as Props;
  const font = await loadFont();
  const svg = await satori(cardElement(card) as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Inter', data: font, weight: 400, style: 'normal' }],
  });
  const png = new Resvg(svg, {
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
    },
  });
};
