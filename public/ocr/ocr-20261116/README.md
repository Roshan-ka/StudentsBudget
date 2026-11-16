# ocr-20261116

The receipt scan's reading files, copied by `scripts/copy-ocr-vendor.mjs` from the packages in `versions.json`:

- `tesseract.esm.min.js`, `worker.min.js`: Tesseract.js, Apache License 2.0 (`LICENSE-tesseract.js.md`).
- `tesseract-core-*.wasm.js`: Tesseract.js-core, Tesseract compiled to WebAssembly, Apache License 2.0
  (`LICENSE-tesseract.js-core.txt`).
- `lang/*.traineddata.gz`: the German and English models of tesseract-ocr/tessdata_best (integer versions),
  Apache License 2.0, packaged by @tesseract.js-data (MIT).
