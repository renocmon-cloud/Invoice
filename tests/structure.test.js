const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

test('every static label is associated with a form control', () => {
  const labels = html.match(/<label\b[^>]*>/g) || [];
  assert.ok(labels.length > 0);
  labels.forEach(label => assert.match(label, /\sfor="[^"]+"/));
});

test('every static button has an explicit type', () => {
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length > 0);
  buttons.forEach(button => assert.match(button, /\stype="button"/));
});

test('remove item control has an accessible name and button type', () => {
  assert.match(app, /removeButton\.type = 'button'/);
  assert.match(app, /removeButton\.setAttribute\('aria-label', 'Remove item'\)/);
});

test('keyboard focus is visibly styled', () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /outline:/);
});

test('main page loads separated styles and scripts', () => {
  assert.doesNotMatch(html, /<style\b/);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="js\/calculations\.js"/);
  assert.match(html, /src="js\/export\.js"/);
  assert.match(html, /src="js\/app\.js"/);
});
