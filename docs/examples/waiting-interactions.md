# Waiting for Interactions Examples

Examples demonstrating how to wait for elements to be ready for various interactions.

## Basic Interaction Waiting

### Example 1: Wait for Click Readiness

```typescript
async function clickWhenReady(element: Element) {
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      'click',
      5000 // 5 second timeout
    );
    
    console.log(`Element ready at (${hitPoint.x}, ${hitPoint.y})`);
    
    // Perform the click
    element.dispatchEvent(new MouseEvent('click', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true,
      cancelable: true
    }));
    
    return true;
  } catch (error) {
    console.error('Failed to click element:', error.message);
    return false;
  }
}
```

### Example 2: Wait for Type Readiness

```typescript
async function typeWhenReady(input: Element, text: string) {
  try {
    await inspector.waitForInteractionReady(input, 'type', 5000);
    
    // Type the text
    (input as HTMLInputElement).value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log(`✓ Typed "${text}" into input`);
    return true;
  } catch (error) {
    console.error('Failed to type into input:', error.message);
    return false;
  }
}
```

### Example 3: Wait for Hover Readiness

```typescript
async function hoverWhenReady(element: Element) {
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      'hover',
      3000
    );
    
    // Simulate hover
    element.dispatchEvent(new MouseEvent('mouseenter', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true
    }));
    
    element.dispatchEvent(new MouseEvent('mouseover', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true
    }));
    
    console.log('✓ Hovered over element');
    return true;
  } catch (error) {
    console.error('Failed to hover:', error.message);
    return false;
  }
}
```

## Advanced Waiting Patterns

### Example 4: Wait with Retry Logic

```typescript
async function clickWithRetry(
  element: Element,
  maxAttempts: number = 3,
  timeout: number = 5000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxAttempts}...`);
      
      const hitPoint = await inspector.waitForInteractionReady(
        element,
        'click',
        timeout
      );
      
      element.click();
      console.log('✓ Click successful');
      return true;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.error('✗ All attempts failed');
  return false;
}
```

### Example 5: Wait with Custom Offset

```typescript
async function clickWithOffset(
  element: Element,
  offsetX: number = 0,
  offsetY: number = 0
) {
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      'click',
      5000,
      { x: offsetX, y: offsetY }
    );
    
    console.log(`Click point with offset: (${hitPoint.x}, ${hitPoint.y})`);
    
    element.dispatchEvent(new MouseEvent('click', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true
    }));
    
    return true;
  } catch (error) {
    console.error('Failed to click with offset:', error.message);
    return false;
  }
}

// Click 10 pixels right of center
await clickWithOffset(button, 10, 0);
```

### Example 6: Wait and Verify

```typescript
async function waitAndVerify(element: Element, interactionType: ElementInteractionType) {
  // First, check current readiness without waiting
  const quickCheck = await inspector.isInteractionReady(element, interactionType);
  
  if (quickCheck.status === 'ready') {
    console.log('Element immediately ready');
    return quickCheck.interactionPoint;
  }
  
  console.log(`Element not immediately ready: ${quickCheck.status}`);
  console.log('Waiting...');
  
  // Now wait for readiness
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      interactionType,
      10000
    );
    
    console.log('✓ Element became ready');
    return hitPoint;
  } catch (error) {
    console.error('✗ Element never became ready:', error.message);
    throw error;
  }
}
```

## Interaction Sequences

### Example 7: Sequential Interactions

```typescript
async function performSequence() {
  const input = document.querySelector<HTMLInputElement>('#username');
  const button = document.querySelector<HTMLButtonElement>('#submit');
  
  if (!input || !button) {
    throw new Error('Elements not found');
  }
  
  try {
    // Step 1: Type in input
    console.log('Step 1: Typing username...');
    await inspector.waitForInteractionReady(input, 'type', 5000);
    input.value = 'testuser';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Step 2: Click submit button
    console.log('Step 2: Clicking submit...');
    await inspector.waitForInteractionReady(button, 'click', 5000);
    button.click();
    
    console.log('✓ Sequence completed successfully');
  } catch (error) {
    console.error('✗ Sequence failed:', error.message);
    throw error;
  }
}
```

### Example 8: Parallel Interaction Preparation

```typescript
async function prepareMultipleElements() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.action-button'));
  
  console.log(`Preparing ${buttons.length} buttons...`);
  
  // Wait for all buttons to be ready in parallel
  const results = await Promise.allSettled(
    buttons.map(button =>
      inspector.waitForInteractionReady(button, 'click', 5000)
    )
  );
  
  // Analyze results
  const ready = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  console.log(`✓ ${ready.length} buttons ready`);
  console.log(`✗ ${failed.length} buttons not ready`);
  
  return {
    ready: ready.map((r, i) => ({ button: buttons[i], hitPoint: r.value })),
    failed: failed.map((r, i) => ({ button: buttons[i], error: r.reason }))
  };
}
```

### Example 9: Form Filling

```typescript
async function fillForm(formData: Record<string, string>) {
  const errors: string[] = [];
  
  for (const [selector, value] of Object.entries(formData)) {
    const input = document.querySelector(selector);
    
    if (!input) {
      errors.push(`Element not found: ${selector}`);
      continue;
    }
    
    try {
      await inspector.waitForInteractionReady(input, 'type', 5000);
      (input as HTMLInputElement).value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      console.log(`✓ Filled ${selector}`);
    } catch (error) {
      errors.push(`Failed to fill ${selector}: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.error('Form filling errors:', errors);
    return { success: false, errors };
  }
  
  console.log('✓ Form filled successfully');
  return { success: true };
}

// Usage
await fillForm({
  '#username': 'john.doe',
  '#email': 'john@example.com',
  '#phone': '555-0123'
});
```

## Timeout Management

### Example 10: Dynamic Timeout Based on Element

```typescript
async function smartWait(element: Element, interactionType: ElementInteractionType) {
  // Determine appropriate timeout based on element and interaction
  let timeout: number;
  
  const tagName = element.tagName.toLowerCase();
  const hasLoadingClass = element.classList.contains('loading');
  
  if (hasLoadingClass) {
    timeout = 15000; // 15 seconds for loading elements
  } else if (tagName === 'button' && interactionType === 'click') {
    timeout = 5000; // 5 seconds for button clicks
  } else if (['input', 'textarea'].includes(tagName)) {
    timeout = 3000; // 3 seconds for input fields
  } else {
    timeout = 10000; // 10 seconds default
  }
  
  console.log(`Waiting up to ${timeout}ms for ${interactionType} on ${tagName}`);
  
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      interactionType,
      timeout
    );
    return { success: true, hitPoint };
  } catch (error) {
    return { success: false, error: error.message, timeout };
  }
}
```

### Example 11: Progressive Timeout

```typescript
async function waitWithProgressiveTimeout(element: Element) {
  const timeouts = [1000, 3000, 10000]; // Try with increasing timeouts
  
  for (let i = 0; i < timeouts.length; i++) {
    const timeout = timeouts[i];
    console.log(`Attempt ${i + 1}: waiting up to ${timeout}ms...`);
    
    try {
      const hitPoint = await inspector.waitForInteractionReady(
        element,
        'click',
        timeout
      );
      
      console.log(`✓ Ready after attempt ${i + 1}`);
      return hitPoint;
    } catch (error) {
      if (i === timeouts.length - 1) {
        // Last attempt failed
        throw new Error(`Element not ready after all attempts: ${error.message}`);
      }
      
      console.log(`Attempt ${i + 1} timed out, trying with longer timeout...`);
    }
  }
}
```

## Error Recovery

### Example 12: Fallback Strategy

```typescript
async function clickWithFallback(primarySelector: string, fallbackSelector: string) {
  // Try primary element first
  const primary = document.querySelector(primarySelector);
  
  if (primary) {
    try {
      await inspector.waitForInteractionReady(primary, 'click', 3000);
      primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      console.log('✓ Clicked primary element');
      return { clicked: 'primary' };
    } catch (error) {
      console.warn('Primary element not ready:', error.message);
    }
  }
  
  // Try fallback element
  const fallback = document.querySelector(fallbackSelector);
  
  if (!fallback) {
    throw new Error('Neither primary nor fallback element found');
  }
  
  try {
    await inspector.waitForInteractionReady(fallback, 'click', 3000);
    fallback.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    console.log('✓ Clicked fallback element');
    return { clicked: 'fallback' };
  } catch (error) {
    throw new Error(`Both primary and fallback failed: ${error.message}`);
  }
}
```

### Example 13: Auto-Scroll and Retry

```typescript
async function ensureInteractionReady(
  element: Element,
  interactionType: ElementInteractionType
) {
  try {
    // Try without manual intervention first
    return await inspector.waitForInteractionReady(
      element,
      interactionType,
      3000
    );
  } catch (error) {
    console.log('Initial attempt failed, trying recovery...');
    
    // Check if element needs scrolling
    const inView = await inspector.isElementInViewPort(element);
    
    if (!inView) {
      console.log('Scrolling element into view...');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Check if element is obscured
    try {
      const result = await inspector.isInteractionReady(element, interactionType);
      
      if (result.status === 'notready') {
        console.log('Element state changed, waiting again...');
      }
    } catch (checkError) {
      console.log('Element may be obscured:', checkError.message);
    }
    
    // Final attempt with longer timeout
    return await inspector.waitForInteractionReady(
      element,
      interactionType,
      10000
    );
  }
}
```

## Integration Patterns

### Example 14: Page Object Pattern

```typescript
class LoginPage {
  private inspector = new ElementStateInspector();
  
  private get usernameInput() {
    return document.querySelector<HTMLInputElement>('#username');
  }
  
  private get passwordInput() {
    return document.querySelector<HTMLInputElement>('#password');
  }
  
  private get submitButton() {
    return document.querySelector<HTMLButtonElement>('#submit');
  }
  
  async login(username: string, password: string) {
    // Fill username
    if (!this.usernameInput) throw new Error('Username input not found');
    await this.inspector.waitForInteractionReady(this.usernameInput, 'type', 5000);
    this.usernameInput.value = username;
    this.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Fill password
    if (!this.passwordInput) throw new Error('Password input not found');
    await this.inspector.waitForInteractionReady(this.passwordInput, 'type', 5000);
    this.passwordInput.value = password;
    this.passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Click submit
    if (!this.submitButton) throw new Error('Submit button not found');
    await this.inspector.waitForInteractionReady(this.submitButton, 'click', 5000);
    this.submitButton.click();
  }
  
  async isLoginFormReady(): Promise<boolean> {
    try {
      if (!this.usernameInput || !this.passwordInput || !this.submitButton) {
        return false;
      }
      
      await Promise.all([
        this.inspector.waitForInteractionReady(this.usernameInput, 'type', 2000),
        this.inspector.waitForInteractionReady(this.passwordInput, 'type', 2000),
        this.inspector.waitForInteractionReady(this.submitButton, 'click', 2000)
      ]);
      
      return true;
    } catch {
      return false;
    }
  }
}

// Usage
const loginPage = new LoginPage();
await loginPage.login('user@example.com', 'password123');
```

## Next Steps

- Explore [Advanced Patterns](/examples/advanced-patterns)
- Review [Best Practices](/guide/best-practices)
- See [Troubleshooting Guide](/guide/troubleshooting)

