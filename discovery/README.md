# Job Discovery

Manual review workspace for compliant job discovery.

- `history.tsv` records URLs already reported or skipped.
- `reports/YYYY-MM-DD.md` contains ranked discovery reports.
- Discovery does not edit `applications.md`; choose useful report links manually and add them to the inbox.

Run:

```bash
npm run discover -- --dry-run --source platsbanken --limit 10
npm run discover
```
