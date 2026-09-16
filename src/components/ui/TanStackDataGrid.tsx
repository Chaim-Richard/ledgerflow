import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface TanStackDataGridProps<TData extends object> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageSize?: number;
  searchPlaceholder?: string;
  enableGlobalFilter?: boolean;
}

export function TanStackDataGrid<TData extends object>({
  data,
  columns,
  pageSize = 15,
  searchPlaceholder = 'Search records...',
  enableGlobalFilter = true
}: TanStackDataGridProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize
      }
    }
  });

  return (
    <div className="space-y-4">
      {enableGlobalFilter && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {table.getRowModel().rows.length} of {data.length} entries
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <tr key={headerGroup.id} className="bg-slate-50 border-b border-slate-200">
                {headerGroup.headers.map((header: any) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted()
                        ? header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                    className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider select-none cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp size={13} className="text-indigo-600" />,
                        desc: <ChevronDown size={13} className="text-indigo-600" />
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                  No records found matching query
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getVisibleCells().map((cell: any) => (
                    <td key={cell.id} className="px-4 py-3 text-xs text-slate-700 font-medium">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-xs font-bold text-slate-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
        >
          {[10, 15, 25, 50, 100].map(size => (
            <option key={size} value={size}>
              Show {size} rows
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
