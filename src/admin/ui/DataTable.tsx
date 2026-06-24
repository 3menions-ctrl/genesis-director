/**
 * DataTable — borderless premium data grid (TanStack Table headless + our
 * styling). No gridlines: separation via subtle zebra + hover glow, generous
 * row height, sticky mono header, single-accent. Used across the rebuilt
 * admin list pages.
 */
import { useState } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_HSL } from "./primitives";

export function DataTable<T>({
  columns, data, onRowClick, dense, empty = "Nothing here yet.",
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  onRowClick?: (row: T) => void;
  dense?: boolean;
  empty?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="sticky top-0 z-10 bg-white/[0.04] backdrop-blur-xl">
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        "px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-white/45",
                        sortable && "cursor-pointer select-none hover:text-white/70",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable && (dir === "asc" ? <ArrowUp className="h-3 w-3" style={{ color: ACCENT_HSL }} /> : dir === "desc" ? <ArrowDown className="h-3 w-3" style={{ color: ACCENT_HSL }} /> : <ArrowUpDown className="h-3 w-3 opacity-40" />)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "group transition-colors",
                  i % 2 === 1 && "bg-white/[0.015]",
                  onRowClick && "cursor-pointer hover:bg-white/[0.05]",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn("px-4 text-[13.5px] text-white/75", dense ? "py-2.5" : "py-3.5")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-[13px] font-light text-white/40">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
