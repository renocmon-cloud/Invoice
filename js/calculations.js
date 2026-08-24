(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InvoiceCalculations = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function calculateSubtotal(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      return sum + Math.max(0, safeNumber(item.qty)) * Math.max(0, safeNumber(item.price));
    }, 0);
  }

  function calculateTotals(items, options = {}) {
    const subtotal = calculateSubtotal(items);
    const requestedDiscount = Math.max(0, safeNumber(options.discount));
    const discount = Math.min(requestedDiscount, subtotal);

    if (options.region === 'eu') {
      const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
      const vatGroups = new Map();

      (Array.isArray(items) ? items : []).forEach(item => {
        const amount = Math.max(0, safeNumber(item.qty)) * Math.max(0, safeNumber(item.price));
        const rate = Math.max(0, safeNumber(item.vatPct));
        vatGroups.set(rate, (vatGroups.get(rate) || 0) + amount);
      });

      const vatBreakdown = Array.from(vatGroups, ([rate, grossBase]) => {
        const base = grossBase * discountFactor;
        return { rate, base, amount: base * rate / 100 };
      }).sort((a, b) => a.rate - b.rate);
      const taxAmount = vatBreakdown.reduce((sum, entry) => sum + entry.amount, 0);

      return {
        subtotal,
        discount,
        taxableAmount: subtotal - discount,
        vatBreakdown,
        taxAmount,
        total: subtotal - discount + taxAmount
      };
    }

    const taxableAmount = subtotal - discount;
    const taxRate = Math.max(0, safeNumber(options.taxPct));
    const taxAmount = taxableAmount * taxRate / 100;
    return {
      subtotal,
      discount,
      taxableAmount,
      vatBreakdown: [],
      taxAmount,
      total: taxableAmount + taxAmount
    };
  }

  return { calculateSubtotal, calculateTotals };
});
