# Installation

## Package Manager

Install Acquiescence using your preferred package manager:

::: code-group

```bash [npm]
npm install acquiescence
```

```bash [yarn]
yarn add acquiescence
```

```bash [pnpm]
pnpm add acquiescence
```

:::

## Requirements

- **Node.js**: Version 16 or higher (for build tools)
- **Browser**: Modern browsers with ES2020 support
  - Chrome/Edge 80+
  - Firefox 80+
  - Safari 14+

## Import Options

### ES Modules (Recommended)

```typescript
import { ElementStateInspector } from 'acquiescence';
```

### CommonJS

```javascript
const { ElementStateInspector } = require('acquiescence');
```

### Browser Bundle

If you need to use Acquiescence directly in a browser without a build step, you can use the browser bundle:

```html
<script src="node_modules/acquiescence/dist/acquiescence.browser.js"></script>
<script>
  const inspector = new Acquiescence.ElementStateInspector();
</script>
```

## TypeScript Support

Acquiescence is written in TypeScript and includes type definitions out of the box. No additional `@types` packages are needed.

```typescript
import { 
  ElementStateInspector,
  ElementState,
  ElementInteractionType,
  TimeoutWaiter
} from 'acquiescence';

// Full type safety and IntelliSense support
const inspector: ElementStateInspector = new ElementStateInspector();
```

## Verify Installation

Create a simple test to verify the installation:

```typescript
import { ElementStateInspector } from 'acquiescence';

const inspector = new ElementStateInspector();
const element = document.body;

inspector.queryElementState(element, 'visible').then(result => {
  console.log('Installation successful!', result);
});
```

## Next Steps

- [Getting Started Guide](/guide/getting-started)
- [Basic Usage Examples](/examples/basic-usage)

