interface CsvRow {
  [key: string]: string | number | null | undefined;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: CsvRow[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(","));
  return [header, ...body].join("\n");
}
