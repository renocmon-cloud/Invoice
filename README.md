# Invoice Generator

Browser-based invoice generator with US and EU invoice styles. It does not require a backend or build step. Tax and invoice requirements vary by jurisdiction, so users should verify local legal requirements.

[Live demo](https://www.belcantorest.me/) · [Repository](https://github.com/renocmon-cloud/Invoice)

## Features

- US tax and EU VAT invoice styles
- Multiple currencies
- Editable line items, discounts, notes, and payment details
- Company logo upload
- Payment QR code
- Searchable, paginated PDF export and printing
- JSON import and export

## Running locally

Clone or download the complete repository, then open `invoice_generator.html` in a browser.

No installation, configuration, or internet connection is required. The JavaScript dependencies are stored in `vendor/`, and the interface uses system fonts.

## Security

The page uses a Content Security Policy that blocks remote scripts, network connections, plugins, and injected inline JavaScript. Imported invoice items are created through DOM APIs and numeric values are validated before use.

## Libraries

- [jsPDF](https://github.com/parallax/jsPDF)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)

The bundled versions, checksums, and license files are listed in [`vendor/README.md`](vendor/README.md).
