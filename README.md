# Invoice Generator

Browser-based invoice generator for US and EU invoices. It runs as a single HTML file and does not require a backend or build step.

[Live demo](https://www.belcantorest.me/) · [Repository](https://github.com/renocmon-cloud/Invoice)

## Features

- US tax and EU VAT invoice layouts
- Multiple currencies
- Editable line items, discounts, notes, and payment details
- Company logo upload
- Payment QR code
- PDF export and printing
- JSON import and export

## Running locally

Open `invoice_generator.html` in a browser. An internet connection is needed on first load for the fonts and JavaScript libraries referenced from CDNs.

No installation or configuration is required.

## Libraries

- [html2canvas](https://github.com/niklasvh/html2canvas)
- [jsPDF](https://github.com/parallax/jsPDF)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
