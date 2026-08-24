(function(root) {
  function downloadPDF(invoice, qrDataUrl = '') {
    const pdf = root.InvoicePDF.render(invoice, { qrDataUrl });
    pdf.save(`invoice-${invoice.invoiceNo || 'document'}.pdf`);
  }

  function downloadJSON(invoice) {
    const data = JSON.stringify(invoice, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `invoice-${invoice.invoiceNo || 'data'}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  root.InvoiceExport = { downloadPDF, downloadJSON };
})(typeof globalThis !== 'undefined' ? globalThis : this);
