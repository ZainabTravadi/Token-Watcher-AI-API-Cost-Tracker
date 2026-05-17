/* eslint-disable react-refresh/only-export-components */
import { fmtUSD, fmtNum } from "@/lib/data";

type Col<T> = {
  key: keyof T;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
  width?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  getRowKey,
}: {
  columns: Col<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => React.Key;
}) {
  return (
    <div className="border-t border-hairline">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{ width: c.width }}
                className={`label-mono py-2 px-3 font-normal ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}
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
              className={`border-b border-hairline/60 hover:bg-secondary/60 ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={`py-2.5 px-3 text-sm ${c.align === "right" ? "text-right num" : ""}`}
                >
                  {c.render
                    ? c.render(row)
                    : (() => {
                        const value = (row as Record<string, unknown>)[c.key as string];
                        if (value === null || value === undefined) return "";
                        if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return String(value);
                        return String(value);
                      })()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { fmtUSD, fmtNum };
