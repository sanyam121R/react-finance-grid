# Demo

Build and open:

```bash
npm run demo:build
npx serve demo        # or: python3 -m http.server -d demo 8080
# open http://localhost:8080/index.html
```

The demo renders 5,000 finance rows (department / budget / actual / variance)
with a left-pinned Department column, a right-pinned Status column, search,
sorting, drag-resizable columns, a sticky grand-total row, and expandable rows
containing a **nested** `DataTable` per-quarter breakdown with its own FY total.

## Screenshots

### Skeleton Loading

![Skeleton Loading](images/Skeleton%20loading.png)

### Demo

![Demo](images/Demo.png)

### Scrollable Fixed Column

![Scrollable Fixed Column](images/Scrollable%20fixed%20column.png)
