# Checking States Examples

This page demonstrates various patterns for checking element states.

## Single State Checks

### Example 1: Check Visibility

```typescript
async function checkVisibility(element: Element) {
  const result = await inspector.queryElementState(element, 'visible');
  
  console.log('Matches expected state:', result.matches);
  console.log('Actual state:', result.received); // 'visible' or 'hidden'
  
  return result.matches;
}
```

### Example 2: Check Enabled/Disabled

```typescript
async function checkEnabled(element: Element) {
  const result = await inspector.queryElementState(element, 'enabled');
  
  if (result.matches) {
    console.log('Element is enabled');
  } else {
    console.log(`Element is ${result.received}`); // 'disabled'
  }
  
  return result.matches;
}
```

### Example 3: Check Viewport Position

```typescript
async function checkViewportPosition(element: Element) {
  const result = await inspector.queryElementState(element, 'inview');
  
  console.log('Matches:', result.matches);
  console.log('State:', result.received);
  // Possible states: 'inview', 'notinview', 'unviewable'
  
  if (result.received === 'unviewable') {
    console.log('Element cannot be scrolled into view (hidden by overflow)');
  } else if (result.received === 'notinview') {
    console.log('Element can be scrolled into view');
  } else {
    console.log('Element is currently in viewport');
  }
}
```

## Multiple State Checks

### Example 4: Check Button Ready State

```typescript
async function isButtonReady(button: Element) {
  const result = await inspector.queryElementStates(
    button,
    ['visible', 'enabled', 'stable']
  );
  
  if (result.status === 'success') {
    console.log('✓ Button is ready for interaction');
    return true;
  } else if (result.status === 'failure') {
    console.log(`✗ Button is not ready: ${result.missingState}`);
    return false;
  } else {
    console.log(`✗ Error checking button: ${result.message}`);
    return false;
  }
}
```

### Example 5: Check Input Ready for Typing

```typescript
async function isInputReady(input: Element) {
  const result = await inspector.queryElementStates(
    input,
    ['visible', 'enabled', 'editable']
  );
  
  switch (result.status) {
    case 'success':
      console.log('✓ Input is ready for typing');
      return true;
      
    case 'failure':
      console.log(`✗ Input is not ready: ${result.missingState}`);
      return false;
      
    case 'error':
      console.log(`✗ Error: ${result.message}`);
      return false;
  }
}
```

### Example 6: Comprehensive Element Check

```typescript
async function comprehensiveCheck(element: Element) {
  // Check all possible states
  const states = ['visible', 'enabled', 'stable', 'inview'] as const;
  const result = await inspector.queryElementStates(element, states);
  
  if (result.status === 'success') {
    console.log('✓ All states passed');
    return { ready: true };
  } else if (result.status === 'failure') {
    console.log(`✗ Missing state: ${result.missingState}`);
    return { ready: false, missingState: result.missingState };
  } else {
    console.log(`✗ Error: ${result.message}`);
    return { ready: false, error: result.message };
  }
}
```

## Conditional State Checks

### Example 7: Check States Based on Element Type

```typescript
async function checkElementReady(element: Element) {
  const tagName = element.tagName.toLowerCase();
  
  let states: ElementState[];
  
  if (['input', 'textarea'].includes(tagName)) {
    // For inputs, check if editable
    states = ['visible', 'enabled', 'editable'];
  } else if (['button', 'a'].includes(tagName)) {
    // For buttons and links, just check if clickable
    states = ['visible', 'enabled'];
  } else {
    // For other elements, just check visibility
    states = ['visible'];
  }
  
  const result = await inspector.queryElementStates(element, states);
  
  return {
    ready: result.status === 'success',
    states,
    result
  };
}
```

### Example 8: Progressive State Checking

```typescript
async function progressiveCheck(element: Element) {
  // Check states one by one for detailed feedback
  
  console.log('Checking visibility...');
  const visibleResult = await inspector.queryElementState(element, 'visible');
  if (!visibleResult.matches) {
    return { ready: false, failedAt: 'visible' };
  }
  
  console.log('✓ Visible - Checking enabled...');
  const enabledResult = await inspector.queryElementState(element, 'enabled');
  if (!enabledResult.matches) {
    return { ready: false, failedAt: 'enabled' };
  }
  
  console.log('✓ Enabled - Checking viewport...');
  const inviewResult = await inspector.queryElementState(element, 'inview');
  if (!inviewResult.matches) {
    return { ready: false, failedAt: 'inview', state: inviewResult.received };
  }
  
  console.log('✓ In viewport - Checking stability...');
  const stableResult = await inspector.queryElementStates(element, ['stable']);
  if (stableResult.status !== 'success') {
    return { ready: false, failedAt: 'stable' };
  }
  
  console.log('✓ All checks passed');
  return { ready: true };
}
```

## State Monitoring

### Example 9: Monitor State Changes

```typescript
async function monitorElementState(
  element: Element,
  duration: number = 5000
) {
  const start = Date.now();
  const history: Array<{ time: number; visible: boolean; enabled: boolean }> = [];
  
  while (Date.now() - start < duration) {
    const visible = inspector.isElementVisible(element);
    const enabled = !inspector.isElementDisabled(element);
    
    history.push({
      time: Date.now() - start,
      visible,
      enabled
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('State history:', history);
  
  // Analyze stability
  const changes = history.filter((state, i) => {
    if (i === 0) return false;
    const prev = history[i - 1];
    return state.visible !== prev.visible || state.enabled !== prev.enabled;
  });
  
  console.log(`State changed ${changes.length} times in ${duration}ms`);
  
  return { history, changes };
}
```

### Example 10: Wait for State Change

```typescript
async function waitForStateChange(
  element: Element,
  expectedState: 'visible' | 'hidden',
  timeout: number = 5000
) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const result = await inspector.queryElementState(element, expectedState);
    
    if (result.matches) {
      const elapsed = Date.now() - start;
      console.log(`✓ Element became ${expectedState} after ${elapsed}ms`);
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✗ Element did not become ${expectedState} within ${timeout}ms`);
  return false;
}

// Usage
await waitForStateChange(element, 'visible', 3000);
```

## Batch State Checks

### Example 11: Check Multiple Elements' States

```typescript
async function batchStateCheck(
  elements: Element[],
  requiredStates: ElementState[]
) {
  const results = await Promise.all(
    elements.map(async (element, index) => {
      const result = await inspector.queryElementStates(element, requiredStates);
      
      return {
        index,
        element,
        ready: result.status === 'success',
        missingState: result.status === 'failure' ? result.missingState : null,
        error: result.status === 'error' ? result.message : null
      };
    })
  );
  
  const readyCount = results.filter(r => r.ready).length;
  console.log(`${readyCount}/${elements.length} elements are ready`);
  
  return results;
}

// Usage
const buttons = Array.from(document.querySelectorAll('.action-button'));
const results = await batchStateCheck(buttons, ['visible', 'enabled']);
```

### Example 12: Find First Ready Element

```typescript
async function findFirstReady(
  selectors: string[],
  requiredStates: ElementState[]
): Promise<Element | null> {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    
    const result = await inspector.queryElementStates(element, requiredStates);
    
    if (result.status === 'success') {
      console.log(`✓ Found ready element: ${selector}`);
      return element;
    }
  }
  
  console.log('✗ No ready elements found');
  return null;
}

// Usage
const button = await findFirstReady(
  ['#primary-button', '#secondary-button', '#fallback-button'],
  ['visible', 'enabled']
);
```

## Error Handling

### Example 13: Robust State Checking

```typescript
async function robustStateCheck(element: Element) {
  try {
    const result = await inspector.queryElementStates(
      element,
      ['visible', 'enabled', 'stable']
    );
    
    if (result.status === 'success') {
      return { success: true };
    } else if (result.status === 'failure') {
      return {
        success: false,
        reason: 'missing_state',
        missingState: result.missingState
      };
    } else {
      return {
        success: false,
        reason: 'error',
        message: result.message
      };
    }
  } catch (error) {
    console.error('Unexpected error during state check:', error);
    return {
      success: false,
      reason: 'exception',
      error
    };
  }
}
```

### Example 14: Validate Editable State Safely

```typescript
async function safeEditableCheck(element: Element) {
  const tagName = element.tagName.toLowerCase();
  const isContentEditable = element.hasAttribute('contenteditable');
  
  // Only check editable for appropriate elements
  if (!['input', 'textarea', 'select'].includes(tagName) && !isContentEditable) {
    return {
      editable: false,
      reason: 'Element type does not support editable state'
    };
  }
  
  try {
    const result = await inspector.queryElementState(element, 'editable');
    return {
      editable: result.matches,
      state: result.received
    };
  } catch (error) {
    return {
      editable: false,
      reason: 'Error checking editable state',
      error
    };
  }
}
```

## Next Steps

- See [Waiting for Interactions](/examples/waiting-interactions)
- Explore [Advanced Patterns](/examples/advanced-patterns)
- Review [Best Practices](/guide/best-practices)

