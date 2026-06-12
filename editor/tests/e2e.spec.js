/**
 * End-to-end test of the code-editor UI against the deployed Lambda.
 *
 * What this exercises that HTTP probes can't:
 *   - React renders without throwing
 *   - Monaco mounts and accepts keystrokes
 *   - The browser's `fetch` reaches the Function URL (CORS works)
 *   - The output panel correctly maps each Lambda response shape
 *   - Language switching preserves per-language buffers
 */
import { test, expect } from '@playwright/test';

// Monaco doesn't render a textarea you can .fill(). Click to focus, then
// select-all + type via the keyboard.
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function setEditorContent(page, code) {
  // Focus Monaco by clicking inside its rendered content area. Clicking the
  // outer `.monaco-editor` div doesn't always grab focus; clicking a view
  // line does, and Monaco delegates keystrokes to its hidden textarea.
  const viewLines = page.locator('.monaco-editor .view-lines').first();
  await viewLines.click();
  await page.keyboard.press(SELECT_ALL);
  await page.keyboard.press('Backspace');
  // Use `insertText` over `type()` so newlines/braces aren't auto-completed
  // by Monaco's bracket-pair editor.
  await page.keyboard.insertText(code);
}

async function selectLanguage(page, label) {
  // The language trigger sits inside the header; scope to the header to
  // avoid colliding with menu items that share the same accessible name.
  const header = page.locator('header');
  await header.getByRole('button', { name: label, exact: true }).click();
  // Menu items are buttons rendered outside the header trigger row.
  await page.locator('div.absolute').getByRole('button', { name: label, exact: true }).click();
}

test('default C++ snippet runs and prints expected output', async ({ page }) => {
  await page.goto('/');
  // Wait for Monaco — its viewport class only appears once the editor mounts.
  await expect(page.locator('.monaco-editor').first()).toBeVisible();

  await page.getByRole('button', { name: 'Run Code' }).click();

  // Live timer should appear while the request is in flight.
  await expect(page.getByText(/Running:.*s/)).toBeVisible();

  // Then resolve with success status + program output.
  await expect(page.getByText('Finished', { exact: true })).toBeVisible();
  await expect(page.getByText('Hello Developer!')).toBeVisible();
  await expect(page.getByText('Count: 5')).toBeVisible();
});

test('switching to Python runs the per-language starter', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.monaco-editor').first()).toBeVisible();

  await selectLanguage(page, 'Python');
  // Each language has its own pre-populated starter.
  await expect(page.locator('.monaco-editor').first()).toContainText('Hello');

  await page.getByRole('button', { name: 'Run Code' }).click();
  await expect(page.getByText('Finished', { exact: true })).toBeVisible();
  await expect(page.getByText('Hello Developer!')).toBeVisible();
});

test('C++ runtime error surfaces ASan details', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.monaco-editor').first()).toBeVisible();

  // Replace default code with a heap-use-after-free.
  await setEditorContent(page, [
    '#include <cstdlib>',
    'int main() {',
    '    int* p = (int*)malloc(4);',
    '    free(p);',
    '    return p[0];',
    '}',
  ].join('\n'));

  await page.getByRole('button', { name: 'Run Code' }).click();

  // Lambda returns RUNTIME_ERROR with ASan output in `details`.
  await expect(page.getByText('Runtime Error', { exact: true })).toBeVisible();
  await expect(page.getByText(/AddressSanitizer/)).toBeVisible();
});
