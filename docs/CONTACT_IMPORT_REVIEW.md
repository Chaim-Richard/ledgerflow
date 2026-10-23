# Contact import review: Israeli addresses, phone and email cleanup

Settings → Import data keeps the existing mapped, validated, all-or-nothing import. The review is integrated into that existing screen; it does not post money or call an address/phone verification service. Contact cleanup is advisory and **does not change imported email or phone values unless a user explicitly accepts the relevant suggestions for that import**.

## Israeli free-text addresses (E-36)

For customer or vendor imports, select **Suggest Israeli address parts (preview only)** to see conservative suggestions for street, city and postal code. The parser recognizes common English street suffixes and Hebrew street markers, an explicitly labelled 5- or 7-digit postal code (`Postal code`, `ZIP`, `מיקוד`), or one unlabelled 7-digit token. It deliberately does not treat an unlabelled five-digit number as a postal code. Ambiguous values are left unselected with a warning.

The address suggestion is not accepted into any structured fields: the mapped `Address` remains a single free-text value, not a replacement assembled from parser output. The parser has no official municipality/street gazetteer; it does not prove that an address, city or postal code exists, identify a tax jurisdiction, or make an address safe for tax calculation. Review suggestions against the source file. Country suffixes such as `Israel` are ignored only for parsing and remain in the original address.

Vendor address is an optional field in the same checked importer. The generic spreadsheet, vCard/Google Contacts, FreshBooks, QuickBooks Online and IIF contact shapes can carry it; the existing server importer continues to validate and save the submitted record.

## Phone and email cleanup (E-37)

- Cleanup notes show the mapped source value and, when safe, a suggested value. Local-format phone numbers are parsed only after the user explicitly chooses a country; numbers beginning with `+` need no country choice. A valid E.164 suggestion is submitted **only after** checking **Apply N suggested phone cleanups to this import**. Otherwise the mapped phone text is submitted unchanged. Extensions, malformed values, unparseable numbers and local numbers without a selected country are kept as entered.
- A syntactically valid email may have a trim/lowercase suggestion. It is submitted **only after** checking **Apply N suggested email cleanups to this import**. With the checkbox off, the mapped email text is preserved through the ordinary importer; its trimmed view is validated, but the mapped value is not changed. The existing email syntax check remains authoritative.
- Email cleanup does not verify ownership. Phone parsing does not prove that a number is assigned, active or reachable; `libphonenumber-js` uses numbering-plan metadata, not a carrier lookup. Warnings do not add a separate blocking path.
- Changing the file, contact type or column mapping clears acceptance. Changing the selected phone country clears phone acceptance so a new region-specific suggestion must be explicitly accepted. A user can accept email suggestions without accepting phone suggestions, and vice versa. The chosen values appear in the same preview and dry-run/import request, and the server repeats its ordinary validation.

## Tests

`src/tests/israel-address-parser.test.ts` covers English and Hebrew labels, seven-digit and labelled legacy five-digit postcodes, ambiguous values and preservation of source text. `src/tests/contact-import-cleanup.test.ts` covers source preservation by default, independent explicit acceptance, E.164 with and without a chosen region, email case/whitespace, extensions, invalid values and non-contact imports. `src/tests/record-import.test.ts` verifies that the shared email validator preserves the exact value after validating it. `src/tests/contact-file-import-view.test.tsx` exercises the screen, confirms raw email/phone values are previewed and posted by default, then confirms accepted suggestions appear in the preview and dry-run request while the original free-text address stays unchanged.
