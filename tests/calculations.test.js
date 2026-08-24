const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSubtotal, calculateTotals } = require('../js/calculations.js');

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
}

test('calculates subtotal from quantity and unit price', () => {
  assert.equal(calculateSubtotal([
    { qty: 2, price: 25 },
    { qty: 3, price: 10 }
  ]), 80);
});

test('applies US tax after discount', () => {
  const totals = calculateTotals([
    { qty: 1, price: 100 }
  ], { region: 'us', taxPct: 10, discount: 20 });

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.taxableAmount, 80);
  assert.equal(totals.taxAmount, 8);
  assert.equal(totals.total, 88);
});

test('applies discount to the EU VAT base', () => {
  const totals = calculateTotals([
    { qty: 1, price: 100, vatPct: 20 }
  ], { region: 'eu', discount: 10 });

  assert.equal(totals.vatBreakdown[0].base, 90);
  assert.equal(totals.vatBreakdown[0].amount, 18);
  assert.equal(totals.total, 108);
});

test('allocates EU discount proportionally across VAT rates', () => {
  const totals = calculateTotals([
    { qty: 1, price: 100, vatPct: 10 },
    { qty: 1, price: 200, vatPct: 20 }
  ], { region: 'eu', discount: 30 });

  assert.deepEqual(totals.vatBreakdown.map(entry => entry.rate), [10, 20]);
  closeTo(totals.vatBreakdown[0].base, 90);
  closeTo(totals.vatBreakdown[0].amount, 9);
  closeTo(totals.vatBreakdown[1].base, 180);
  closeTo(totals.vatBreakdown[1].amount, 36);
  closeTo(totals.total, 315);
});

test('caps discount at subtotal', () => {
  const totals = calculateTotals([
    { qty: 1, price: 50, vatPct: 20 }
  ], { region: 'eu', discount: 100 });

  assert.equal(totals.discount, 50);
  assert.equal(totals.taxableAmount, 0);
  assert.equal(totals.taxAmount, 0);
  assert.equal(totals.total, 0);
});

test('handles empty and invalid values safely', () => {
  const totals = calculateTotals([
    { qty: -1, price: 20, vatPct: 20 },
    { qty: 'invalid', price: 10, vatPct: 10 }
  ], { region: 'eu', discount: -5 });

  assert.equal(totals.subtotal, 0);
  assert.equal(totals.discount, 0);
  assert.equal(totals.taxAmount, 0);
  assert.equal(totals.total, 0);
});
