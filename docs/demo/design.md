# Contract
renderTable(container, { caption, columns, rows }) renders a native <table>:
a <caption>, one <th scope="col"> per column, one <tr> per row.
A column is { key, header, format? }; format returns a string.
Every cell is written with textContent, so markup in data shows literally.

# Rejected alternative
A render callback that returns HTML strings: flexible, but any value could execute.

# Tests
npx vitest run (jsdom): header scope, a "<b>bold</b>" value shown as text,
a row missing a key, and a zero value that must still render as 0.

# First failure
A row without a column's key renders an empty cell, never "undefined", never throws.
