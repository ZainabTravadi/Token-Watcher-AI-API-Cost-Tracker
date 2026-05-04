import { fmtUSD, fmtNum } from "@/lib/data";

type Col<T> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
  width?: string;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  onRowClick,
}: {
  columns: Col<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
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
              key={i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-hairline/60 hover:bg-secondary/60 ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={`py-2.5 px-3 text-sm ${c.align === "right" ? "text-right num" : ""}`}
                >
                  {c.render ? c.render(row) : (row as any)[c.key]}
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
