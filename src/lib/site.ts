export const site = {
  title: 'Dev Journal',
  description:
    'Notes about extraction infrastructure, adversarial data pipelines, and local-first software with Rust and Python',
  url: 'https://hech.dev',
  githubUrl: 'https://github.com/flasheddy',
  email: 'chen@hech.dev',
  nav: [
    {
      label: 'Articles',
      href: '/blog/',
      external: false,
    },
    {
      label: 'Dotfiles',
      href: 'https://github.com/flasheddy/dotfiles',
      external: true,
    },
    {
      label: 'GitHub',
      href: 'https://github.com/flasheddy',
      external: true,
    },
    {
      label: 'Email',
      href: 'mailto:chen@hech.dev',
      external: false,
    },
  ],
  blog: {
    title: 'Articles',
    description:
      'Development notes, technical decisions, and lessons from building practical software.',
  },
  tags: {
    title: 'Tags',
    description: 'Topics collected across the journal.',
    context: 'Browse by topic',
  },
  projects: {
    title: 'Selected projects',
  },
} as const;
