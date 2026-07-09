/* eslint-disable react-refresh/only-export-components */
import { fmtUSD, fmtNum } from "@/lib/data";

type Col<T extends object> = {
  key: keyof T;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  sortKey?: string;
};

export interface DataTableSort {
  key: string;
  direction: "asc" | "desc";
}

export function DataTable<T extends object>({
  columns,
  rows,
  onRowClick,
  getRowKey,
  sort,
  onSortChange,
  getRowClassName,
  summaryRows,
}: {
  columns: Col<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => React.Key;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  getRowClassName?: (row: T) => string | undefined;
  summaryRows?: T[];
}) {
  const updateSort = (column: Col<T>) => {
    if (!column.sortable || !onSortChange) return;
    const key = column.sortKey ?? String(column.key);
    onSortChange({
      key,
      direction: sort?.key === key && sort.direction === "desc" ? "asc" : "desc",
    });
  };

  const sortLabel = (column: Col<T>) => {
    const key = column.sortKey ?? String(column.key);
    if (sort?.key !== key) return "";
    return sort.direction === "asc" ? "asc" : "desc";
  };

  const renderCell = (row: T, column: Col<T>) => {
    if (column.render) return column.render(row);
    const value = (row as Record<string, unknown>)[column.key as string];
    if (value === null || value === undefined) return "";
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return String(value);
    return String(value);
  };

  return (
    <div className="border-t border-hairline">
      <div className="overflow-auto">
      <table className="w-full border-collapse text-left">
        <colgroup>
          {columns.map((c) => (
            <col key={String(c.key)} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={`label-mono sticky top-0 z-10 bg-background/95 px-2.5 py-2 font-normal backdrop-blur-sm ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => updateSort(c)}
                    className={`inline-flex w-full items-center gap-2 border-b border-transparent pb-0.5 transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus-visible:border-foreground ${c.align === "right" ? "justify-end" : "justify-start"}`}
                    aria-sort={sort?.key === (c.sortKey ?? String(c.key)) ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                    title={`Sort by ${c.label}`}
                  >
                    <span>{c.label}</span>
                    <span className="min-w-8 text-[10px] text-muted-foreground">{sortLabel(c) || "--"}</span>
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={
                getRowKey?.(row, i) ?? String((() => {
                  const r = row as Record<string, unknown>;
                  return r.id ?? r.route ?? r.model ?? r.timestamp ?? i;
                })())
              }
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
              aria-label={onRowClick ? "Open row details" : undefined}
              className={`border-b border-hairline/60 transition-colors hover:bg-secondary/50 focus:outline-none focus-visible:bg-secondary/60 ${onRowClick ? "cursor-pointer" : ""} ${getRowClassName?.(row) ?? ""}`}
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={`px-2.5 py-1.5 text-[13px] leading-6 ${c.align === "right" ? "text-right num" : ""}`}
                >
                  {renderCell(row, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {summaryRows && summaryRows.length > 0 && (
          <tfoot>
            {summaryRows.map((row, index) => (
              <tr key={`summary-${index}`} className="border-t border-foreground/50 bg-secondary/40 font-mono text-xs">
                {columns.map((c) => (
                  <td key={String(c.key)} className={`px-2.5 py-2 ${c.align === "right" ? "text-right num" : ""}`}>
                    {renderCell(row, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
      </div>
    </div>
  );
}

export { fmtUSD, fmtNum };
