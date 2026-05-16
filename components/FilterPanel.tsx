'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Types ──

export interface FilterState {
  sectors: string[];
  industries: string[];
  marketCaps: string[];
  priceBands: string[];
  series: string[];
  priceMin: string;
  priceMax: string;
  changeMin: string;
  changeMax: string;
  volumeMin: string;
  marketCapMin: string;
  marketCapMax: string;
}

export interface FilterOptions {
  sectors: string[];
  industries: string[];
  marketCaps: string[];
  priceBands: string[];
  series: string[];
}

export const emptyFilters: FilterState = {
  sectors: [], industries: [], marketCaps: [], priceBands: [], series: [],
  priceMin: '', priceMax: '', changeMin: '', changeMax: '', volumeMin: '',
  marketCapMin: '', marketCapMax: '',
};

export const emptyFilterOptions: FilterOptions = {
  sectors: [], industries: [], marketCaps: [], priceBands: [], series: [],
};

export function hasActiveFilters(f: FilterState): boolean {
  return f.sectors.length > 0 || f.industries.length > 0 || f.marketCaps.length > 0 ||
    f.priceBands.length > 0 || f.series.length > 0 ||
    !!f.priceMin || !!f.priceMax || !!f.changeMin || !!f.changeMax || !!f.volumeMin ||
    !!f.marketCapMin || !!f.marketCapMax;
}

function countActive(f: FilterState): number {
  let n = 0;
  if (f.sectors.length) n++;
  if (f.industries.length) n++;
  if (f.marketCaps.length) n++;
  if (f.priceBands.length) n++;
  if (f.series.length) n++;
  if (f.priceMin) n++;
  if (f.priceMax) n++;
  if (f.changeMin) n++;
  if (f.changeMax) n++;
  if (f.volumeMin) n++;
  if (f.marketCapMin) n++;
  if (f.marketCapMax) n++;
  return n;
}

// ── Multi-Select Dropdown ──

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
          selected.length > 0
            ? 'border-black bg-black text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:border-black'
        } flex items-center gap-1.5`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-white text-black text-[10px] leading-none px-1 py-0.5 rounded-full font-bold min-w-[16px] text-center">
            {selected.length}
          </span>
        )}
        <span className="text-[10px] opacity-60">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-black shadow-lg w-64">
          {options.length > 6 && (
            <div className="p-2 border-b border-gray-200">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black"
                autoFocus
              />
            </div>
          )}
          <div className="flex gap-3 px-2 py-1.5 border-b border-gray-200">
            <button onClick={() => onChange([...options])} className="text-[11px] text-blue-600 hover:underline font-medium">
              Select All
            </button>
            <button onClick={() => onChange([])} className="text-[11px] text-red-600 hover:underline font-medium">
              Clear
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-gray-400 text-center">No matches</div>
            )}
            {filtered.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 accent-black"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FilterPanel ──

interface Props {
  filters: FilterState;
  options: FilterOptions;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  hiddenColumns: Set<string>;
  onHiddenColumnsChange: (cols: Set<string>) => void;
  toggleableColumns: string[];
  addColumnOptions?: string[];
  onAddColumn?: (column: string) => void;
  selectedAddedColumnOptions?: string[];
  onAddedColumnOptionChange?: (option: string, checked: boolean) => void;
}

export default function FilterPanel({
  filters, options, onChange, onReset,
  hiddenColumns, onHiddenColumnsChange, toggleableColumns,
  addColumnOptions = [], onAddColumn, selectedAddedColumnOptions = [], onAddedColumnOptionChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActive(filters);

  const update = (key: keyof FilterState, value: string[] | string) => {
    onChange({ ...filters, [key]: value });
  };

  const removeChip = (type: keyof FilterState, value: string) => {
    const current = filters[type];
    if (Array.isArray(current)) {
      onChange({ ...filters, [type]: (current as string[]).filter(v => v !== value) });
    } else {
      onChange({ ...filters, [type]: '' });
    }
  };

  // Collect active filter chips
  const chips: { label: string; type: keyof FilterState; value: string }[] = [];
  for (const s of filters.sectors) chips.push({ label: s, type: 'sectors', value: s });
  for (const s of filters.industries) chips.push({ label: s, type: 'industries', value: s });
  for (const s of filters.marketCaps) chips.push({ label: s, type: 'marketCaps', value: s });
  for (const s of filters.priceBands) chips.push({ label: `Band: ${s}`, type: 'priceBands', value: s });
  for (const s of filters.series) chips.push({ label: `Series: ${s}`, type: 'series', value: s });
  if (filters.marketCapMin) chips.push({ label: `M Cap \u2265 ${Number(filters.marketCapMin).toLocaleString()} Cr`, type: 'marketCapMin', value: filters.marketCapMin });
  if (filters.marketCapMax) chips.push({ label: `M Cap \u2264 ${Number(filters.marketCapMax).toLocaleString()} Cr`, type: 'marketCapMax', value: filters.marketCapMax });
  if (filters.priceMin) chips.push({ label: `Price \u2265 \u20B9${filters.priceMin}`, type: 'priceMin', value: filters.priceMin });
  if (filters.priceMax) chips.push({ label: `Price \u2264 \u20B9${filters.priceMax}`, type: 'priceMax', value: filters.priceMax });
  if (filters.changeMin) chips.push({ label: `Change \u2265 ${filters.changeMin}%`, type: 'changeMin', value: filters.changeMin });
  if (filters.changeMax) chips.push({ label: `Change \u2264 ${filters.changeMax}%`, type: 'changeMax', value: filters.changeMax });
  if (filters.volumeMin) chips.push({ label: `Vol \u2265 ${Number(filters.volumeMin).toLocaleString()}`, type: 'volumeMin', value: filters.volumeMin });

  const toggleColumn = (col: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(col)) next.delete(col); else next.add(col);
    onHiddenColumnsChange(next);
  };

  return (
    <div className="mb-3">
      {/* Toggle bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-black bg-white hover:bg-gray-50"
        >
          <span className="text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
          Filters
          {activeCount > 0 && (
            <span className="bg-black text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {activeCount}
            </span>
          )}
        </button>
        {(onAddColumn || onAddedColumnOptionChange) && addColumnOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center border border-black bg-white text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black"
                aria-label="Add column"
                title="Add column"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 border-gray-300 bg-white text-black">
              {addColumnOptions.map((option, index) => {
                const checked = selectedAddedColumnOptions.includes(option);
                return (
                  <div key={option}>
                    {index === 1 && <DropdownMenuSeparator />}
                    <DropdownMenuCheckboxItem
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        if (onAddedColumnOptionChange) {
                          onAddedColumnOptionChange(option, Boolean(nextChecked));
                          return;
                        }
                        if (onAddColumn) onAddColumn(option);
                      }}
                      onSelect={(event) => event.preventDefault()}
                      className={`cursor-pointer text-sm ${index > 0 ? 'pl-10' : ''}`}
                    >
                      {option}
                    </DropdownMenuCheckboxItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-red-600 hover:underline font-medium">
            Reset All
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-2 border border-black p-3 bg-gray-50 space-y-3">
          {/* Categorical filters */}
          <div className="flex flex-wrap gap-2">
            <MultiSelect label="Sector" options={options.sectors} selected={filters.sectors} onChange={v => update('sectors', v)} />
            <MultiSelect label="Industry" options={options.industries} selected={filters.industries} onChange={v => update('industries', v)} />
            <MultiSelect label="Price Band" options={options.priceBands} selected={filters.priceBands} onChange={v => update('priceBands', v)} />
            <MultiSelect label="Series" options={options.series} selected={filters.series} onChange={v => update('series', v)} />
          </div>

          {/* Range filters */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-600 whitespace-nowrap">M Cap (Cr):</span>
              <input type="number" placeholder="Min" value={filters.marketCapMin} onChange={e => update('marketCapMin', e.target.value)}
                className="w-28 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
              <span className="text-gray-400">&mdash;</span>
              <input type="number" placeholder="Max" value={filters.marketCapMax} onChange={e => update('marketCapMax', e.target.value)}
                className="w-28 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-600 whitespace-nowrap">Price (\u20B9):</span>
              <input type="number" placeholder="Min" value={filters.priceMin} onChange={e => update('priceMin', e.target.value)}
                className="w-24 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
              <span className="text-gray-400">&mdash;</span>
              <input type="number" placeholder="Max" value={filters.priceMax} onChange={e => update('priceMax', e.target.value)}
                className="w-24 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-600 whitespace-nowrap">% Change:</span>
              <input type="number" step="0.1" placeholder="Min" value={filters.changeMin} onChange={e => update('changeMin', e.target.value)}
                className="w-24 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
              <span className="text-gray-400">&mdash;</span>
              <input type="number" step="0.1" placeholder="Max" value={filters.changeMax} onChange={e => update('changeMax', e.target.value)}
                className="w-24 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-600 whitespace-nowrap">Min Volume:</span>
              <input type="number" placeholder="e.g. 100000" value={filters.volumeMin} onChange={e => update('volumeMin', e.target.value)}
                className="w-28 border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-black" />
            </div>
          </div>

          {/* Column visibility */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-gray-200">
            <span className="text-xs font-medium text-gray-600">Show Columns:</span>
            {toggleableColumns.map(col => (
              <label key={col} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={!hiddenColumns.has(col)} onChange={() => toggleColumn(col)} className="w-3.5 h-3.5 accent-black" />
                <span className={hiddenColumns.has(col) ? 'text-gray-400' : 'text-gray-700'}>{col}</span>
              </label>
            ))}
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-500 self-center mr-1">Active:</span>
              {chips.map((chip, i) => (
                <span key={`${chip.type}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 text-xs rounded-sm">
                  {chip.label}
                  <button onClick={() => removeChip(chip.type, chip.value)}
                    className="text-gray-400 hover:text-red-500 font-bold text-sm leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
