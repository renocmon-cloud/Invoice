(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/jspdf-2.5.1.umd.min.js'));
  } else {
    root.InvoicePDF = factory(root.jspdf);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(jspdf) {
  const currencyCodes = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₽': 'RUB',
    '₿': 'BTC'
  };

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function stringValue(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function formatDate(value) {
    const parts = stringValue(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
    const [year, month, day] = parts;
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return `${monthNames[month - 1]} ${day}, ${year}`;
  }

  function formatAmount(value, currency) {
    const number = Number(value);
    const safeValue = Number.isFinite(number) ? number : 0;
    const code = currencyCodes[currency] || stringValue(currency) || 'USD';
    const decimals = code === 'BTC' ? 8 : 2;
    const formatted = safeValue.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${code} ${formatted}`;
  }

  function wrapText(pdf, value, width) {
    return stringValue(value)
      .split(/\r?\n/)
      .flatMap(line => pdf.splitTextToSize(line || ' ', width));
  }

  function getTotals(invoice) {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const subtotal = items.reduce((sum, item) => {
      return sum + Number(item.qty || 0) * Number(item.price || 0);
    }, 0);
    const discount = Math.min(Math.max(0, Number(invoice.discount) || 0), subtotal);
    let tax = 0;
    let vatBreakdown = [];

    if (invoice.region === 'eu') {
      const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
      const vatGroups = new Map();
      items.forEach(item => {
        const amount = Number(item.qty || 0) * Number(item.price || 0);
        const rate = Number(item.vatPct) || 0;
        vatGroups.set(rate, (vatGroups.get(rate) || 0) + amount);
      });
      vatBreakdown = Array.from(vatGroups, ([rate, grossBase]) => {
        const base = grossBase * discountFactor;
        return { rate, base, amount: base * rate / 100 };
      }).sort((a, b) => a.rate - b.rate);
      tax = vatBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
    } else {
      const taxableAmount = Math.max(0, subtotal - discount);
      tax = taxableAmount * (Number(invoice.taxPct) || 0) / 100;
    }

    return {
      subtotal,
      discount,
      tax,
      vatBreakdown,
      total: Math.max(0, subtotal - discount + tax)
    };
  }

  function render(invoice, options = {}) {
    if (!jspdf || !jspdf.jsPDF) throw new Error('jsPDF is not available');

    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    const contentBottom = pageHeight - 18;
    const accent = [79, 70, 229];
    const border = [220, 224, 230];
    const muted = [90, 98, 110];
    const isEU = invoice.region === 'eu';
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const totals = getTotals(invoice);
    let y = 15;

    pdf.setProperties({
      title: `Invoice ${stringValue(invoice.invoiceNo)}`,
      subject: 'Invoice',
      creator: 'Invoice Generator'
    });

    function addPage() {
      pdf.addPage();
      y = 15;
    }

    function ensureSpace(height) {
      if (y + height > contentBottom) {
        addPage();
        return true;
      }
      return false;
    }

    function drawTitle() {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(...accent);
      pdf.text('INVOICE', margin, 20);

      if (invoice.logoDataUrl) {
        try {
          pdf.addImage(invoice.logoDataUrl, 88, 9, 34, 17);
        } catch (error) {
          void error;
        }
      }

      pdf.setFontSize(9);
      pdf.setTextColor(25, 32, 45);
      pdf.setFont('helvetica', 'normal');
      const details = [
        `Invoice #: ${stringValue(invoice.invoiceNo)}`,
        `Invoice date: ${formatDate(invoice.invoiceDate)}`,
        `Due date: ${formatDate(invoice.dueDate)}`
      ];
      details.forEach((line, index) => {
        pdf.text(line, pageWidth - margin, 14 + index * 5, { align: 'right' });
      });
      y = 36;
    }

    function drawParties() {
      const columnWidth = (contentWidth - 10) / 2;
      const sellerLines = wrapText(pdf, invoice.seller, columnWidth);
      const buyerLines = wrapText(pdf, invoice.buyer, columnWidth);
      if (isEU && invoice.sellerVAT) sellerLines.push(`VAT: ${stringValue(invoice.sellerVAT)}`);
      if (isEU && invoice.buyerVAT) buyerLines.push(`VAT: ${stringValue(invoice.buyerVAT)}`);

      pdf.setFontSize(9);
      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FROM', margin, y);
      pdf.text('BILL TO', margin + columnWidth + 10, y);
      y += 5;

      pdf.setTextColor(25, 32, 45);
      pdf.setFont('helvetica', 'normal');
      pdf.text(sellerLines, margin, y);
      pdf.text(buyerLines, margin + columnWidth + 10, y);
      y += Math.max(sellerLines.length, buyerLines.length) * 4.2 + 8;
    }

    const columns = isEU
      ? [
          { key: 'desc', title: 'Description', width: 72, align: 'left' },
          { key: 'qty', title: 'Qty', width: 18, align: 'right' },
          { key: 'price', title: 'Unit price', width: 34, align: 'right' },
          { key: 'vatPct', title: 'VAT %', width: 20, align: 'right' },
          { key: 'amount', title: 'Amount', width: 36, align: 'right' }
        ]
      : [
          { key: 'desc', title: 'Description', width: 82, align: 'left' },
          { key: 'qty', title: 'Qty', width: 20, align: 'right' },
          { key: 'price', title: 'Unit price', width: 38, align: 'right' },
          { key: 'amount', title: 'Amount', width: 40, align: 'right' }
        ];

    function drawTableHeader() {
      const height = 8;
      let x = margin;
      pdf.setFillColor(245, 246, 249);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);

      columns.forEach(column => {
        pdf.rect(x, y, column.width, height, 'FD');
        const textX = column.align === 'right' ? x + column.width - 2 : x + 2;
        pdf.text(column.title, textX, y + 5.2, { align: column.align });
        x += column.width;
      });
      y += height;
    }

    function cellValue(item, key) {
      if (key === 'desc') return stringValue(item.desc);
      if (key === 'qty') return stringValue(item.qty);
      if (key === 'price') return formatAmount(item.price, invoice.currency);
      if (key === 'vatPct') return stringValue(item.vatPct || 0);
      if (key === 'amount') {
        return formatAmount(Number(item.qty || 0) * Number(item.price || 0), invoice.currency);
      }
      return '';
    }

    function drawTableRow(item) {
      const values = columns.map(column => {
        return column.key === 'desc'
          ? wrapText(pdf, cellValue(item, column.key), column.width - 4)
          : [cellValue(item, column.key)];
      });
      const lineCount = Math.max(...values.map(value => value.length));
      const rowHeight = Math.max(8, lineCount * 4 + 4);

      if (y + rowHeight > contentBottom) {
        addPage();
        drawTableHeader();
      }

      let x = margin;
      pdf.setDrawColor(...border);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(25, 32, 45);

      columns.forEach((column, index) => {
        pdf.rect(x, y, column.width, rowHeight);
        const textX = column.align === 'right' ? x + column.width - 2 : x + 2;
        pdf.text(values[index], textX, y + 5, { align: column.align });
        x += column.width;
      });
      y += rowHeight;
    }

    function drawSummary() {
      const lines = [
        ['Subtotal', formatAmount(totals.subtotal, invoice.currency)]
      ];
      if (totals.discount > 0) {
        lines.push(['Discount', `-${formatAmount(totals.discount, invoice.currency)}`]);
      }
      if (isEU) {
        totals.vatBreakdown.forEach(entry => {
          const rate = Number(entry.rate.toFixed(4));
          const base = formatAmount(entry.base, invoice.currency);
          lines.push([`VAT ${rate}% (base ${base})`, formatAmount(entry.amount, invoice.currency)]);
        });
      } else if (totals.tax > 0) {
        lines.push(['Tax', formatAmount(totals.tax, invoice.currency)]);
      }
      lines.push(['TOTAL', formatAmount(totals.total, invoice.currency)]);

      ensureSpace(lines.length * 7 + 6);
      const x = pageWidth - margin - 78;
      const width = 78;
      y += 4;

      lines.forEach((line, index) => {
        const isTotal = index === lines.length - 1;
        pdf.setFont('helvetica', isTotal ? 'bold' : 'normal');
        pdf.setFontSize(isTotal ? 11 : 9);
        pdf.setTextColor(...(isTotal ? accent : [25, 32, 45]));
        pdf.text(line[0], x, y + 5);
        pdf.text(line[1], x + width, y + 5, { align: 'right' });
        pdf.setDrawColor(...border);
        pdf.line(x, y + 7, x + width, y + 7);
        y += 7;
      });
      y += 5;
    }

    function drawTextSection(title, value) {
      const sectionLines = wrapText(pdf, value, contentWidth);
      if (!sectionLines.length || !stringValue(value).trim()) return;

      ensureSpace(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...accent);
      pdf.text(title, margin, y);
      y += 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(25, 32, 45);
      sectionLines.forEach(line => {
        if (y + 4 > contentBottom) addPage();
        pdf.text(line, margin, y);
        y += 4;
      });
      y += 5;
    }

    function drawPaymentDetails() {
      const payment = invoice.paymentDetails || {};
      const accountNumber = isEU ? payment.iban : payment.accountNumber;
      const routingCode = isEU ? payment.bicSwift : payment.routingCode;
      const accountLabel = isEU ? 'IBAN' : 'Account number';
      const routingLabel = isEU ? 'BIC / SWIFT' : 'Routing / SWIFT';
      const reference = payment.paymentReference || invoice.invoiceNo;
      const detailLines = [
        payment.bankName ? `Bank: ${payment.bankName}` : '',
        payment.accountHolder ? `Account holder: ${payment.accountHolder}` : '',
        accountNumber ? `${accountLabel}: ${accountNumber}` : '',
        routingCode ? `${routingLabel}: ${routingCode}` : '',
        reference ? `Reference: ${reference}` : ''
      ].filter(Boolean);

      if (!detailLines.length && !options.qrDataUrl) return;

      const wrappedLines = detailLines.flatMap(line => wrapText(pdf, line, 125));
      const sectionHeight = Math.max(wrappedLines.length * 4 + 12, options.qrDataUrl ? 40 : 0);
      ensureSpace(sectionHeight);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...accent);
      pdf.text('PAYMENT DETAILS', margin, y);
      y += 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(25, 32, 45);
      pdf.text(wrappedLines, margin, y);

      if (options.qrDataUrl) {
        try {
          pdf.addImage(options.qrDataUrl, 'PNG', pageWidth - margin - 32, y - 5, 32, 32);
        } catch (error) {
          void error;
        }
      }
      y += sectionHeight;
    }

    function drawFooters() {
      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...muted);
        pdf.text(`Invoice ${stringValue(invoice.invoiceNo)}`, margin, pageHeight - 8);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
          align: 'right'
        });
      }
    }

    drawTitle();
    drawParties();
    ensureSpace(16);
    drawTableHeader();
    items.forEach(drawTableRow);
    drawSummary();
    drawTextSection('NOTES', invoice.notes);
    drawPaymentDetails();
    drawFooters();

    return pdf;
  }

  return { render };
});
