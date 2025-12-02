# Acquiescence Documentation

This directory contains the documentation for the Acquiescence library.

## Structure

```
docs/
├── .vitepress/         # VitePress configuration
│   └── config.ts       # Site configuration
├── guide/              # User guides and tutorials
│   ├── getting-started.md
│   ├── installation.md
│   ├── element-states.md
│   ├── interactions.md
│   ├── stability.md
│   ├── best-practices.md
│   └── troubleshooting.md
├── examples/           # Code examples
│   ├── basic-usage.md
│   ├── checking-states.md
│   ├── waiting-interactions.md
│   └── advanced-patterns.md
├── api/                # API reference (manual overview)
│   └── index.md        # API overview
├── public/             # Static files (copied as-is)
│   └── api-reference/  # TypeDoc generated HTML
└── index.md            # Documentation home page
```

## Development

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run docs:dev
```

This will start the VitePress development server at `http://localhost:5173`.

### Build Documentation

```bash
npm run docs:build
```

This will:
1. Generate API documentation from TypeScript source using TypeDoc
2. Build the static site with VitePress

Output will be in `docs/.vitepress/dist/`.

### Preview Built Documentation

```bash
npm run docs:preview
```

### Generate API Documentation Only

```bash
npm run docs:api
```

This runs TypeDoc to generate API documentation from the TypeScript source code.

## Writing Documentation

### Markdown Features

VitePress supports enhanced markdown features:

#### Code Blocks with Syntax Highlighting

````
```typescript
const inspector = new ElementStateInspector();
```
````

#### Custom Containers

```markdown
::: tip
This is a tip
:::

::: warning
This is a warning
:::

::: danger
This is a danger message
:::

::: info
This is an info message
:::
```

#### Code Groups

````markdown
::: code-group

```bash [npm]
npm install acquiescence
```

```bash [yarn]
yarn add acquiescence
```

:::
````

### Adding New Pages

1. Create a new `.md` file in the appropriate directory
2. Update the sidebar configuration in `docs/.vitepress/config.ts`
3. Add internal links using relative paths: `[Link Text](/guide/page-name)`

## Deployment

### GitHub Pages

The documentation can be deployed to GitHub Pages using GitHub Actions. A workflow file has been created at `.github/workflows/docs.yml`.

The workflow:
- Runs on push to main/master branch
- Builds the documentation
- Deploys to GitHub Pages

You'll need to enable GitHub Pages in your repository settings and set the source to "GitHub Actions".

### Other Platforms

- **Netlify**: Point to `docs/.vitepress/dist` as publish directory, build command: `npm run docs:build`
- **Vercel**: Same as Netlify
- **Cloudflare Pages**: Build command: `npm run docs:build`, build output: `docs/.vitepress/dist`

## Configuration

### Site Configuration

Edit `docs/.vitepress/config.ts` to customize:

- Site title and description
- Navigation menu
- Sidebar structure
- Social links
- Theme colors
- Search settings

### TypeDoc Configuration

Edit `typedoc.json` to customize API documentation generation:

- Entry points
- Output directory
- Excluded files
- Formatting options

## Resources

- [VitePress Documentation](https://vitepress.dev/)
- [TypeDoc Documentation](https://typedoc.org/)
- [Markdown Guide](https://www.markdownguide.org/)

