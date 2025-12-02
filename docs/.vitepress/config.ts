import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Acquiescence',
  description: 'Library for querying and waiting for element states',
  base: '/acquiescence/',
  ignoreDeadLinks: [
    // Ignore links to TypeDoc generated documentation
    /^\/api-reference\//
  ],
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Examples', link: '/examples/basic-usage' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Element States', link: '/guide/element-states' },
            { text: 'Interactions', link: '/guide/interactions' },
            { text: 'Stability Detection', link: '/guide/stability' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Best Practices', link: '/guide/best-practices' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Usage', link: '/examples/basic-usage' },
            { text: 'Checking States', link: '/examples/checking-states' },
            { text: 'Waiting for Interactions', link: '/examples/waiting-interactions' },
            { text: 'Advanced Patterns', link: '/examples/advanced-patterns' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Full API Docs (TypeDoc)', link: '/api-reference/index.html', target: '_blank' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jimevans/acquiescence' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the Apache License 2.0.',
      copyright: 'Copyright © 2025'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
});

