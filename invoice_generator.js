(function(){
  const $ = id => document.getElementById(id);
  const escapeHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const toDateInputValue = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateValue = () => toDateInputValue(new Date());

  const addDaysDateValue = days => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toDateInputValue(date);
  };

  const formatDisplayDate = dateValue => {
    const parts = dateValue.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return '';

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day, 12);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return '';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  function formatCurrency(amount, currencySymbol) {
    if (currencySymbol === '₿') {
      return '₿' + parseFloat(amount).toFixed(8);
    }

    const formatted = parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return currencySymbol + formatted;
  }

  function showNotification(message, type = 'success') {
    const notification = $('notification');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <span class="icon">${type === 'success' ? '✓' : '⚠'}</span>
      ${message}
    `;
    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  function generateQRCode(text, containerId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!text || text.trim() === '') {
      container.innerHTML = '<div class="small muted">Enter payment details</div>';
      return;
    }

    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();

      const qrSize = 140;
      const cellSize = qrSize / qr.getModuleCount();

      const canvas = document.createElement('canvas');
      canvas.width = qrSize;
      canvas.height = qrSize;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, qrSize, qrSize);

      ctx.fillStyle = '#000000';
      for (let row = 0; row < qr.getModuleCount(); row++) {
        for (let col = 0; col < qr.getModuleCount(); col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              Math.round(col * cellSize),
              Math.round(row * cellSize),
              Math.ceil(cellSize),
              Math.ceil(cellSize)
            );
          }
        }
      }

      container.appendChild(canvas);
    } catch (e) {
      console.error('QR generation failed:', e);
      container.innerHTML = '<div class="small muted">QR Error: Content too long</div>';
    }
  }

  const AppState = {
    logoDataUrl: '',
    updateTimeout: null,
    currentRegion: 'us'
  };

  const elements = {
    logoUpload: $('logoUpload'),
    seller: $('seller'),
    sellerError: $('sellerError'),
    buyer: $('buyer'),
    buyerError: $('buyerError'),
    invoiceNo: $('invoiceNo'),
    invoiceNoError: $('invoiceNoError'),
    invoiceDate: $('invoiceDate'),
    dueDate: $('dueDate'),
    currency: $('currency'),
    region: $('region'),
    taxPct: $('taxPct'),
    discount: $('discount'),
    notes: $('notes'),
    itemsInputHead: $('itemsInputHead'),
    itemsBody: $('itemsBody'),
    itemsCount: $('itemsCount'),
    itemsError: $('itemsError'),
    addItemBtn: $('addItem'),
    clearItemsBtn: $('clearItems'),
    duplicateLastBtn: $('duplicateLast'),
    updatePreviewBtn: $('updatePreview'),
    printBtn: $('printBtn'),
    downloadPDFBtn: $('downloadPDF'),
    previewArea: $('previewArea'),
    euExtras: $('euExtras'),
    sellerVAT: $('sellerVAT'),
    buyerVAT: $('buyerVAT'),
    saveJsonBtn: $('saveJson'),
    loadJsonBtn: $('loadJson'),
    resetFormBtn: $('resetForm'),
    qrContent: $('qrContent'),
    bankName: $('bankName'),
    accountHolder: $('accountHolder'),
    accountNumberLabel: $('accountNumberLabel'),
    accountNumber: $('accountNumber'),
    routingCodeLabel: $('routingCodeLabel'),
    routingCode: $('routingCode'),
    paymentReference: $('paymentReference')
  };

  function initApp() {
    elements.invoiceDate.value = todayDateValue();
    elements.dueDate.value = addDaysDateValue(14);

    AppState.currentRegion = elements.region.value;
    updatePaymentFieldLabels(AppState.currentRegion);

    renderItemsInputHead();
    createRow('Consulting services', 2, 150, parseFloat(elements.taxPct.value||0));
    updatePreview();
    updateQRCode();

    bindEvents();
  }

  function bindEvents() {
    elements.logoUpload.addEventListener('change', handleLogoUpload);

    elements.addItemBtn.addEventListener('click', () => {
      createRow('New item', 1, 0);
      showNotification('New item added', 'success');
    });

    elements.clearItemsBtn.addEventListener('click', () => {
      if (elements.itemsBody.querySelectorAll('tr').length > 0 && confirm('Are you sure you want to clear all items?')) {
        elements.itemsBody.innerHTML = '';
        createRow('Consulting services', 1, 150);
        updateItemsCount();
        updatePreview();
        showNotification('All items cleared', 'success');
      }
    });

    elements.duplicateLastBtn.addEventListener('click', duplicateLastItem);
    elements.resetFormBtn.addEventListener('click', resetForm);

    elements.updatePreviewBtn.addEventListener('click', updatePreview);
    elements.printBtn.addEventListener('click', handlePrint);
    elements.downloadPDFBtn.addEventListener('click', exportPDF);
    elements.saveJsonBtn.addEventListener('click', saveJSON);
    elements.loadJsonBtn.addEventListener('click', handleLoadJSON);

    const autoUpdateElements = [
      elements.seller, elements.buyer, elements.invoiceNo, elements.invoiceDate,
      elements.dueDate, elements.currency, elements.region, elements.taxPct,
      elements.discount, elements.notes, elements.sellerVAT, elements.buyerVAT,
      elements.bankName, elements.accountHolder,
      elements.accountNumber, elements.routingCode, elements.paymentReference,
      elements.qrContent
    ];

    autoUpdateElements.forEach(el => {
      el.addEventListener('input', () => {
        if (el === elements.region) {
          handleRegionChange();
        }
        if (el === elements.seller && el.value.trim()) {
          setValidationError(elements.seller, elements.sellerError, '');
        }
        if (el === elements.buyer && el.value.trim()) {
          setValidationError(elements.buyer, elements.buyerError, '');
        }
        if (el === elements.invoiceNo && el.value.trim()) {
          setValidationError(elements.invoiceNo, elements.invoiceNoError, '');
        }
        schedulePreviewUpdate();
      });
    });
  }

  function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      $('logoError').textContent = 'Please select an image file (PNG, JPG, etc.)';
      $('logoError').style.display = 'block';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      $('logoError').textContent = 'Image size should be less than 2MB';
      $('logoError').style.display = 'block';
      return;
    }

    $('logoError').style.display = 'none';

    const reader = new FileReader();
    reader.onload = () => {
      AppState.logoDataUrl = reader.result;
      const img = new Image();
      img.onload = function() {
        if (this.width > 220 || this.height > 80) {
          showNotification('Logo exceeds recommended dimensions (220×80px). It will be scaled down.', 'error');
        }
        updatePreview();
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      $('logoError').textContent = 'Error reading file';
      $('logoError').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function handleRegionChange() {
    const newRegion = elements.region.value;
    updatePaymentFieldLabels(newRegion);

    if (newRegion !== AppState.currentRegion) {
      AppState.currentRegion = newRegion;

      const currentItems = collectItems();
      elements.itemsBody.innerHTML = '';

      currentItems.forEach(item => {
        if (newRegion === 'eu') {
          createRow(
            item.desc ?? '',
            item.qty ?? 1,
            item.price ?? 0,
            item.vatPct ?? parseFloat(elements.taxPct.value || 0)
          );
        } else {
          createRow(item.desc ?? '', item.qty ?? 1, item.price ?? 0, 0);
        }
      });

      elements.euExtras.style.display = newRegion === 'eu' ? 'block' : 'none';

      renderItemsInputHead();
      updatePreview();
    }
  }

  function updatePaymentFieldLabels(region) {
    const isEU = region === 'eu';
    elements.accountNumberLabel.textContent = isEU ? 'IBAN' : 'Account Number';
    elements.accountNumber.placeholder = isEU ? 'International bank account number' : 'Account number';
    elements.routingCodeLabel.textContent = isEU ? 'BIC / SWIFT' : 'Routing / SWIFT Code';
    elements.routingCode.placeholder = isEU ? 'BIC or SWIFT code' : 'Routing or SWIFT code';
  }

  function renderItemsInputHead() {
    const isEU = elements.region.value === 'eu';

    if (isEU) {
      elements.itemsInputHead.innerHTML = `
        <tr>
          <th style="width:40%">Description</th>
          <th style="width:12%">Qty</th>
          <th style="width:15%">Unit Price</th>
          <th style="width:15%">VAT %</th>
          <th style="width:18%">Amount</th>
        </tr>
      `;
    } else {
      elements.itemsInputHead.innerHTML = `
        <tr>
          <th style="width:50%">Description</th>
          <th style="width:15%">Qty</th>
          <th style="width:20%">Unit Price</th>
          <th style="width:15%">Amount</th>
        </tr>
      `;
    }
  }

  const itemLimits = {
    quantity: 1000000,
    price: 1000000000000,
    vat: 100,
    count: 500
  };

  function boundedNumber(value, min, max, fallback = 0) {
    if (value === '' || value === null || value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function createNumberInput(className, value, max) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = className;
    input.value = String(value);
    input.min = '0';
    input.max = String(max);
    input.step = '0.01';
    return input;
  }

  function appendInputCell(row, input) {
    const cell = document.createElement('td');
    cell.appendChild(input);
    row.appendChild(cell);
  }

  function createRow(desc = '', qty = 1, price = 0, vatPct = 0) {
    const isEU = elements.region.value === 'eu';
    const row = document.createElement('tr');
    const safeQty = boundedNumber(qty, 0, itemLimits.quantity, 1);
    const safePrice = boundedNumber(price, 0, itemLimits.price);
    const safeVat = boundedNumber(vatPct, 0, itemLimits.vat);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'item-desc';
    descInput.value = typeof desc === 'string' ? desc.slice(0, 500) : '';
    descInput.placeholder = 'Item description';
    descInput.maxLength = 500;

    const qtyInput = createNumberInput('item-qty', safeQty, itemLimits.quantity);
    const priceInput = createNumberInput('item-price', safePrice, itemLimits.price);
    const inputs = [descInput, qtyInput, priceInput];

    appendInputCell(row, descInput);
    appendInputCell(row, qtyInput);
    appendInputCell(row, priceInput);

    if (isEU) {
      const vatInput = createNumberInput('item-vat', safeVat, itemLimits.vat);
      inputs.push(vatInput);
      appendInputCell(row, vatInput);
    }

    const amountCell = document.createElement('td');
    const amount = document.createElement('div');
    amount.className = 'item-amount';
    amount.style.padding = '8px 4px';
    amount.textContent = formatCurrency(safeQty * safePrice, elements.currency.value);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'ghost remove-item';
    removeButton.style.padding = '4px 8px';
    removeButton.style.fontSize = '11px';
    removeButton.setAttribute('aria-label', 'Remove item');
    removeButton.textContent = '✕';

    actions.appendChild(removeButton);
    amountCell.append(amount, actions);
    row.appendChild(amountCell);

    inputs.forEach(input => {
      input.addEventListener('input', () => {
        calculateRow(row);
        if (collectItems().length) {
          setValidationError(null, elements.itemsError, '');
        }
        schedulePreviewUpdate();
      });
    });

    removeButton.addEventListener('click', () => removeRow(row));

    elements.itemsBody.appendChild(row);
    updateItemsCount();
    if (collectItems().length) {
      setValidationError(null, elements.itemsError, '');
    }
    return row;
  }

  function calculateRow(row) {
    const qty = boundedNumber(row.querySelector('.item-qty').value, 0, itemLimits.quantity);
    const price = boundedNumber(row.querySelector('.item-price').value, 0, itemLimits.price);
    const amountCell = row.querySelector('.item-amount');

    if (amountCell) {
      amountCell.textContent = formatCurrency(qty * price, elements.currency.value);
    }
  }

  function removeRow(row) {
    row.remove();
    updateItemsCount();
    updatePreview();
    showNotification('Item removed', 'success');
  }

  function duplicateLastItem() {
    const rows = elements.itemsBody.querySelectorAll('tr');
    if (rows.length === 0) return;

    const lastRow = rows[rows.length - 1];
    const desc = lastRow.querySelector('.item-desc').value;
    const qty = lastRow.querySelector('.item-qty').value;
    const price = lastRow.querySelector('.item-price').value;
    const vatPct = lastRow.querySelector('.item-vat') ? lastRow.querySelector('.item-vat').value : 0;

    createRow(desc, qty, price, vatPct);
    showNotification('Last item duplicated', 'success');
  }

  function collectItems() {
    const rows = elements.itemsBody.querySelectorAll('tr');
    const items = [];

    rows.forEach(row => {
      const desc = row.querySelector('.item-desc').value.trim();
      const qty = boundedNumber(row.querySelector('.item-qty').value, 0, itemLimits.quantity);
      const price = boundedNumber(row.querySelector('.item-price').value, 0, itemLimits.price);
      const vatInput = row.querySelector('.item-vat');
      const vatPct = vatInput ? boundedNumber(vatInput.value, 0, itemLimits.vat) : 0;

      if (desc && qty > 0) {
        items.push({
          desc: desc,
          qty: qty,
          price: price,
          vatPct: vatPct,
          amount: qty * price
        });
      }
    });

    return items;
  }

  function setValidationError(field, errorElement, message) {
    errorElement.textContent = message;
    errorElement.style.display = message ? 'block' : 'none';

    if (field) {
      if (message) {
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-invalid');
      }
    }
  }

  function validateInvoice() {
    const requiredFields = [
      [elements.seller, elements.sellerError, 'Seller is required'],
      [elements.buyer, elements.buyerError, 'Buyer is required'],
      [elements.invoiceNo, elements.invoiceNoError, 'Invoice number is required']
    ];
    let firstInvalidField = null;
    let isValid = true;

    requiredFields.forEach(([field, errorElement, message]) => {
      const fieldIsValid = Boolean(field.value.trim());
      setValidationError(field, errorElement, fieldIsValid ? '' : message);
      if (!fieldIsValid && !firstInvalidField) firstInvalidField = field;
      isValid = isValid && fieldIsValid;
    });

    const hasItems = collectItems().length > 0;
    setValidationError(null, elements.itemsError, hasItems ? '' : 'Add at least one invoice item');
    isValid = isValid && hasItems;

    if (!isValid) {
      showNotification('Fill in the required invoice fields', 'error');
      if (firstInvalidField) firstInvalidField.focus();
    }

    return isValid;
  }

  function clearInvoiceValidation() {
    setValidationError(elements.seller, elements.sellerError, '');
    setValidationError(elements.buyer, elements.buyerError, '');
    setValidationError(elements.invoiceNo, elements.invoiceNoError, '');
    setValidationError(null, elements.itemsError, '');
  }

  function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  }

  function calculateTax(items, discount = 0) {
    const isEU = elements.region.value === 'eu';

    if (isEU) {
      return items.reduce((sum, item) => {
        const itemAmount = item.qty * item.price;
        return sum + (itemAmount * (item.vatPct || 0) / 100);
      }, 0);
    } else {
      const subtotal = calculateSubtotal(items);
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxPct = parseFloat(elements.taxPct.value) || 0;
      return taxableAmount * taxPct / 100;
    }
  }

  function updateItemsCount() {
    const count = elements.itemsBody.querySelectorAll('tr').length;
    elements.itemsCount.textContent = `(${count} item${count !== 1 ? 's' : ''})`;
  }

  function schedulePreviewUpdate() {
    clearTimeout(AppState.updateTimeout);
    AppState.updateTimeout = setTimeout(updatePreview, 300);
  }

  function buildPaymentQRText(amount, reference) {
    const isEU = elements.region.value === 'eu';
    const accountLabel = isEU ? 'IBAN' : 'Account';
    const routingLabel = isEU ? 'BIC/SWIFT' : 'Routing/SWIFT';
    const lines = [
      `Bank: ${elements.bankName.value || ''}`,
      `Account holder: ${elements.accountHolder.value || ''}`,
      `${accountLabel}: ${elements.accountNumber.value || ''}`,
      `Reference: ${reference}`,
      `Amount: ${formatCurrency(amount, elements.currency.value)}`
    ];

    if (elements.routingCode.value) {
      lines.push(`${routingLabel}: ${elements.routingCode.value}`);
    }

    return lines.join('\n');
  }

  function updateQRCode() {
    let qrText = elements.qrContent.value.trim();

    if (!qrText) {
      const reference = elements.paymentReference.value || elements.invoiceNo.value || '';
      qrText = buildPaymentQRText(calculateTotal(), reference);
    }

    generateQRCode(qrText, 'qrCode');
  }

  function calculateTotal() {
    const items = collectItems();
    const subtotal = calculateSubtotal(items);
    const discount = parseFloat(elements.discount.value) || 0;
    const taxAmount = calculateTax(items, discount);

    return Math.max(0, subtotal - discount + taxAmount);
  }

  function updatePreview() {
    const items = collectItems();
    const subtotal = calculateSubtotal(items);
    const discount = parseFloat(elements.discount.value) || 0;
    const taxAmount = calculateTax(items, discount);
    const total = Math.max(0, subtotal - discount + taxAmount);
    const isEU = elements.region.value === 'eu';

    let itemsHTML = '';
    items.forEach(item => {
      const amount = item.qty * item.price;
      if (isEU) {
        itemsHTML += `
          <tr>
            <td>${escapeHtml(item.desc)}</td>
            <td class="num">${item.qty}</td>
            <td class="num">${formatCurrency(item.price, elements.currency.value)}</td>
            <td class="num">${item.vatPct}%</td>
            <td class="num">${formatCurrency(amount, elements.currency.value)}</td>
          </tr>
        `;
      } else {
        itemsHTML += `
          <tr>
            <td>${escapeHtml(item.desc)}</td>
            <td class="num">${item.qty}</td>
            <td class="num">${formatCurrency(item.price, elements.currency.value)}</td>
            <td class="num">${formatCurrency(amount, elements.currency.value)}</td>
          </tr>
        `;
      }
    });

    let summaryHTML = '';
    if (subtotal > 0) {
      summaryHTML += `<div class="line"><span>Subtotal</span><span>${formatCurrency(subtotal, elements.currency.value)}</span></div>`;
    }

    if (discount > 0) {
      summaryHTML += `<div class="line"><span>Discount</span><span>-${formatCurrency(discount, elements.currency.value)}</span></div>`;
    }

    if (taxAmount > 0) {
      const taxLabel = isEU ? 'VAT' : 'Tax';
      summaryHTML += `<div class="line"><span>${taxLabel}</span><span>${formatCurrency(taxAmount, elements.currency.value)}</span></div>`;
    }

    summaryHTML += `<div class="line total"><span>TOTAL</span><span>${formatCurrency(total, elements.currency.value)}</span></div>`;

    const bankName = elements.bankName.value || '';
    const accountHolder = elements.accountHolder.value || '';
    const accountNumber = elements.accountNumber.value || '';
    const routingCode = elements.routingCode.value || '';
    const paymentReference = elements.paymentReference.value || elements.invoiceNo.value || '';
    const accountLabel = isEU ? 'IBAN' : 'Account Number';
    const routingLabel = isEU ? 'BIC / SWIFT' : 'Routing / SWIFT';

    let paymentDetailsHTML = '';
    if (bankName || accountHolder || accountNumber || routingCode) {
      paymentDetailsHTML = `
        <div class="payment-preview">
          <h4>Payment Details</h4>
          <div class="payment-details-preview">
            <div class="payment-info-preview">
              ${bankName ? `<div><strong>Bank:</strong> ${escapeHtml(bankName)}</div>` : ''}
              ${accountHolder ? `<div><strong>Account Holder:</strong> ${escapeHtml(accountHolder)}</div>` : ''}
              ${accountNumber ? `<div><strong>${accountLabel}:</strong> ${escapeHtml(accountNumber)}</div>` : ''}
              ${routingCode ? `<div><strong>${routingLabel}:</strong> ${escapeHtml(routingCode)}</div>` : ''}
              ${paymentReference ? `<div><strong>Reference:</strong> ${escapeHtml(paymentReference)}</div>` : ''}
            </div>
            <div class="qr-preview" id="qrPreview"></div>
          </div>
        </div>
      `;
    }

    setTimeout(() => {
      let qrText = elements.qrContent.value.trim();

      if (!qrText) {
        qrText = buildPaymentQRText(total, paymentReference);
      }

      generateQRCode(qrText, 'qrPreview');
    }, 100);

    const tableHeaders = isEU ?
      `<tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>VAT %</th><th>Amount</th></tr>` :
      `<tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>`;

    elements.previewArea.innerHTML = `
      <div class="invoice-head">
        <div>
          <div class="invoice-title">INVOICE</div>
          <div class="small muted">Thank you for your business</div>
        </div>
        ${AppState.logoDataUrl ? `<img src="${escapeHtml(AppState.logoDataUrl)}" class="logo-img" alt="Company Logo" />` : ''}
      </div>

      <div class="meta-grid">
        <div class="from-to">
          <div><strong>From:</strong></div>
          <div style="white-space:pre-line;margin-top:6px">${escapeHtml(elements.seller.value)}</div>
          ${isEU && elements.sellerVAT.value ? `<div style="margin-top:6px"><strong>VAT:</strong> ${escapeHtml(elements.sellerVAT.value)}</div>` : ''}

          <div style="margin-top:16px"><strong>To:</strong></div>
          <div style="white-space:pre-line;margin-top:6px">${escapeHtml(elements.buyer.value)}</div>
          ${isEU && elements.buyerVAT.value ? `<div style="margin-top:6px"><strong>VAT:</strong> ${escapeHtml(elements.buyerVAT.value)}</div>` : ''}
        </div>

        <div class="dates">
          <div class="row">
            <div class="item"><strong>Invoice #</strong></div>
            <div class="item">${escapeHtml(elements.invoiceNo.value)}</div>
          </div>
          <div class="row">
            <div class="item"><strong>Invoice Date</strong></div>
            <div class="item">${formatDisplayDate(elements.invoiceDate.value)}</div>
          </div>
          <div class="row">
            <div class="item"><strong>Due Date</strong></div>
            <div class="item">${formatDisplayDate(elements.dueDate.value)}</div>
          </div>
        </div>
      </div>

      <table class="items-table">
        <thead>${tableHeaders}</thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <div class="summary">
        ${summaryHTML}
      </div>

      ${elements.notes.value ? `
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-light)">
          <div><strong>Notes:</strong></div>
          <div style="white-space:pre-line;margin-top:8px">${escapeHtml(elements.notes.value)}</div>
        </div>
      ` : ''}

      ${paymentDetailsHTML}
    `;

    updateQRCode();
  }

  function handlePrint() {
    if (!validateInvoice()) return;
    window.print();
  }

  async function exportPDF() {
    if (!validateInvoice()) return;

    try {
      elements.downloadPDFBtn.disabled = true;
      elements.downloadPDFBtn.textContent = 'Generating PDF...';
      elements.downloadPDFBtn.classList.add('loading');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const element = elements.previewArea;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`invoice-${elements.invoiceNo.value || 'document'}.pdf`);
      showNotification('PDF downloaded successfully', 'success');

    } catch (error) {
      console.error('PDF export failed:', error);
      showNotification('PDF export failed. Please try again.', 'error');
    } finally {
      elements.downloadPDFBtn.disabled = false;
      elements.downloadPDFBtn.textContent = 'Download PDF';
      elements.downloadPDFBtn.classList.remove('loading');
    }
  }

  function saveJSON() {
    if (!validateInvoice()) return;

    const accountFields = elements.region.value === 'eu'
      ? {
          iban: elements.accountNumber.value,
          bicSwift: elements.routingCode.value
        }
      : {
          accountNumber: elements.accountNumber.value,
          routingCode: elements.routingCode.value
        };

    const data = {
      seller: elements.seller.value,
      buyer: elements.buyer.value,
      invoiceNo: elements.invoiceNo.value,
      invoiceDate: elements.invoiceDate.value,
      dueDate: elements.dueDate.value,
      currency: elements.currency.value,
      region: elements.region.value,
      taxPct: elements.taxPct.value,
      discount: elements.discount.value,
      notes: elements.notes.value,
      sellerVAT: elements.sellerVAT.value,
      buyerVAT: elements.buyerVAT.value,
      logoDataUrl: AppState.logoDataUrl,
      items: collectItems(),
      paymentDetails: {
        bankName: elements.bankName.value,
        accountHolder: elements.accountHolder.value,
        ...accountFields,
        paymentReference: elements.paymentReference.value,
        qrContent: elements.qrContent.value
      }
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `invoice-${elements.invoiceNo.value || 'data'}.json`;
    link.click();

    showNotification('Invoice data saved as JSON', 'success');
  }

  function handleLoadJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result);
          loadJSONData(data);
          showNotification('Invoice data loaded successfully', 'success');
        } catch (err) {
          console.error('JSON parse error:', err);
          showNotification('Invalid JSON file', 'error');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  function parseBankDetails(value) {
    const details = {};
    const fields = value.split(/\r?\n|,/).map(part => part.trim()).filter(Boolean);

    fields.forEach(field => {
      const match = field.match(/^(iban|bic|swift|bank(?: name)?|account holder)\s*:\s*(.+)$/i);
      if (!match) return;

      const name = match[1].toLowerCase();
      const fieldValue = match[2].trim();
      if (name === 'iban') details.iban = fieldValue;
      if (name === 'bic' || name === 'swift') details.bicSwift = fieldValue;
      if (name.startsWith('bank')) details.bankName = fieldValue;
      if (name === 'account holder') details.accountHolder = fieldValue;
    });

    if (!details.iban && value.trim()) details.iban = value.trim();
    return details;
  }

  function loadJSONData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid invoice data');
    }

    if ('seller' in data) elements.seller.value = data.seller ?? '';
    if ('buyer' in data) elements.buyer.value = data.buyer ?? '';
    if ('invoiceNo' in data) elements.invoiceNo.value = data.invoiceNo ?? '';
    if ('invoiceDate' in data) elements.invoiceDate.value = data.invoiceDate ?? '';
    if ('dueDate' in data) elements.dueDate.value = data.dueDate ?? '';
    if ('currency' in data) elements.currency.value = data.currency ?? '';
    if ('region' in data) elements.region.value = data.region ?? '';
    if ('taxPct' in data) {
      elements.taxPct.value = data.taxPct === ''
        ? ''
        : boundedNumber(data.taxPct, 0, 100);
    }
    if ('discount' in data) {
      elements.discount.value = data.discount === ''
        ? ''
        : boundedNumber(data.discount, 0, itemLimits.price);
    }
    if ('notes' in data) elements.notes.value = data.notes ?? '';
    if ('sellerVAT' in data) elements.sellerVAT.value = data.sellerVAT ?? '';
    if ('buyerVAT' in data) elements.buyerVAT.value = data.buyerVAT ?? '';
    if ('logoDataUrl' in data) {
      const logoDataUrl = typeof data.logoDataUrl === 'string' ? data.logoDataUrl : '';
      AppState.logoDataUrl = logoDataUrl.startsWith('data:image/') ? logoDataUrl : '';
      elements.logoUpload.value = '';
    }

    const paymentDetails = data.paymentDetails && typeof data.paymentDetails === 'object'
      ? data.paymentDetails
      : {};
    const hasLegacyBankDetails = typeof data.bankDetails === 'string' && data.bankDetails.trim();

    if (Object.keys(paymentDetails).length || hasLegacyBankDetails) {
      const legacyDetails = hasLegacyBankDetails && !('iban' in paymentDetails)
        ? parseBankDetails(data.bankDetails)
        : {};

      if ('bankName' in paymentDetails) {
        elements.bankName.value = paymentDetails.bankName ?? '';
      } else if ('bankName' in legacyDetails) {
        elements.bankName.value = legacyDetails.bankName;
      }
      if ('accountHolder' in paymentDetails) {
        elements.accountHolder.value = paymentDetails.accountHolder ?? '';
      } else if ('accountHolder' in legacyDetails) {
        elements.accountHolder.value = legacyDetails.accountHolder;
      }
      if ('iban' in paymentDetails) {
        elements.accountNumber.value = paymentDetails.iban ?? '';
      } else if ('iban' in legacyDetails) {
        elements.accountNumber.value = legacyDetails.iban;
      } else if ('accountNumber' in paymentDetails) {
        elements.accountNumber.value = paymentDetails.accountNumber ?? '';
      }
      if ('bicSwift' in paymentDetails) {
        elements.routingCode.value = paymentDetails.bicSwift ?? '';
      } else if ('bicSwift' in legacyDetails) {
        elements.routingCode.value = legacyDetails.bicSwift;
      } else if ('routingCode' in paymentDetails) {
        elements.routingCode.value = paymentDetails.routingCode ?? '';
      }
      if ('paymentReference' in paymentDetails) {
        elements.paymentReference.value = paymentDetails.paymentReference ?? '';
      }
      if ('qrContent' in paymentDetails) elements.qrContent.value = paymentDetails.qrContent ?? '';
    }

    elements.itemsBody.innerHTML = '';
    if (Array.isArray(data.items)) {
      data.items.slice(0, itemLimits.count).forEach(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        createRow(item.desc, item.qty, item.price, item.vatPct);
      });
    } else {
      createRow('Consulting services', 1, 150);
    }

    clearInvoiceValidation();
    handleRegionChange();
    updatePreview();
  }

  function resetForm() {
    if (confirm('Are you sure you want to reset the form? All data will be lost.')) {
      elements.seller.value = 'Acme Co.\n123 Business Road\nbusiness@acme.example\n+1 555 0123';
      elements.buyer.value = 'Client Ltd.\n45 Client Ave.\nclient@example.com';
      elements.invoiceNo.value = 'INV-1001';
      elements.invoiceDate.value = todayDateValue();
      elements.dueDate.value = addDaysDateValue(14);
      elements.currency.value = '$';
      elements.region.value = 'us';
      elements.taxPct.value = '0';
      elements.discount.value = '0';
      elements.notes.value = 'Thank you for your business. Payment due within 14 days.';
      elements.sellerVAT.value = '';
      elements.buyerVAT.value = '';
      elements.bankName.value = 'Global Bank Inc.';
      elements.accountHolder.value = 'Acme Co.';
      elements.accountNumber.value = 'XXXX-XXXX-XXXX-1234';
      elements.routingCode.value = 'ROUTING-123';
      elements.paymentReference.value = '';
      elements.qrContent.value = '';

      elements.logoUpload.value = '';
      AppState.logoDataUrl = '';

      elements.itemsBody.innerHTML = '';
      createRow('Consulting services', 1, 150);

      clearInvoiceValidation();
      handleRegionChange();
      updatePreview();

      showNotification('Form reset successfully', 'success');
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
