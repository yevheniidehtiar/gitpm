import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://gitpm-docs.pages.dev',
  integrations: [
    starlight({
      title: 'GitPM',
      description:
        'Git-native project management. Roadmaps, epics, and stories as files in your repo, synced with GitHub, GitLab, and Jira.',
      lastUpdated: true,
      editLink: {
        baseUrl: 'https://github.com/yevheniidehtiar/gitpm/edit/master/docs-site/',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/yevheniidehtiar/gitpm',
        },
      ],
      sidebar: [
        { label: 'Getting Started', autogenerate: { directory: 'start' } },
        { label: 'Guides', autogenerate: { directory: 'guides' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
        { label: 'Contributing', autogenerate: { directory: 'contributing' } },
      ],
    }),
  ],
});
