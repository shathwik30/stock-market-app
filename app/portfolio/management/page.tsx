'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import { motion } from 'framer-motion';
import { PieChart, Save, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api-client';
import axios from 'axios';

const MARKET_CONDITIONS = [
  'Bull Market',
  'Bullish to Bearish',
  'Side Ways Market',
  'Bear Market',
  'Bearish to Bullish',
];

const DEFAULT_STRATEGIES = [
  'Intraday Trading',
  'F&O Trading',
  'Swing Trading',
  'Positional Trading',
  'Multi Bagger Stocks',
  'Index Funds (ETFs)',
  'Gold ETFs',
  'Emergency Fund (6M - 1Y)',
  'Free Cash',
];

interface Strategy {
  _clientId: string;
  name: string;
  allocationPercent: number;
  allocationRupees: number;
  usedFunds: number;
  unusedFunds: number;
}

interface ExperienceNote {
  _clientId: string;
  positive: string;
  negative: string;
}

let _idCounter = 0;
function generateClientId() {
  return `s_${Date.now()}_${_idCounter++}`;
}

function makeStrategy(data?: Partial<Omit<Strategy, '_clientId'>>): Strategy {
  return {
    _clientId: generateClientId(),
    name: data?.name ?? '',
    allocationPercent: data?.allocationPercent ?? 0,
    allocationRupees: data?.allocationRupees ?? 0,
    usedFunds: data?.usedFunds ?? 0,
    unusedFunds: data?.unusedFunds ?? 0,
  };
}

function makeExperienceNote(data?: Partial<Omit<ExperienceNote, '_clientId'>>): ExperienceNote {
  return {
    _clientId: generateClientId(),
    positive: data?.positive ?? '',
    negative: data?.negative ?? '',
  };
}

function NumberInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: number;
  onChange: (value: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [rawValue, setRawValue] = useState(String(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setRawValue(String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      value={rawValue}
      onChange={(e) => {
        const raw = e.target.value;
        setRawValue(raw);
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          onChange(num);
        } else if (raw === '' || raw === '-') {
          onChange(0);
        }
      }}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={() => {
        isFocused.current = false;
        const num = parseFloat(rawValue);
        if (isNaN(num) || rawValue === '') {
          setRawValue('0');
          onChange(0);
        } else {
          setRawValue(String(num));
        }
      }}
      className={className}
      {...props}
    />
  );
}

export default function PortfolioManagementPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useHasHydrated();
  const [activeTab, setActiveTab] = useState(MARKET_CONDITIONS[0]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [experienceNotes, setExperienceNotes] = useState<ExperienceNote[]>([]);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [totalCapital, setTotalCapital] = useState<number>(100000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const initializeDefaults = useCallback(() => {
    const initialStrategies = DEFAULT_STRATEGIES.map((name) => makeStrategy({ name }));
    setStrategies(initialStrategies);
  }, []);

  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/api/portfolio?marketCondition=${encodeURIComponent(activeTab)}`
      );

      const portfolio = response.data.portfolio;
      if (portfolio && portfolio.strategies && portfolio.strategies.length > 0) {
        setStrategies(
          portfolio.strategies.map((s: Omit<Strategy, '_clientId'>) =>
            makeStrategy({
              name: s.name,
              allocationPercent: s.allocationPercent || 0,
              allocationRupees: s.allocationRupees || 0,
              usedFunds: s.usedFunds || 0,
              unusedFunds: s.unusedFunds || 0,
            })
          )
        );
        if (portfolio.totalCapital && portfolio.totalCapital > 0) {
          setTotalCapital(portfolio.totalCapital);
        }
        if (portfolio.experienceNotes && portfolio.experienceNotes.length > 0) {
          setExperienceNotes(
            portfolio.experienceNotes.map((n: Omit<ExperienceNote, '_clientId'>) =>
              makeExperienceNote({ positive: n.positive || '', negative: n.negative || '' })
            )
          );
        } else {
          setExperienceNotes([]);
        }
      } else {
        initializeDefaults();
        setExperienceNotes([]);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio', error);
      toast.error('Failed to load portfolio data');
      initializeDefaults();
      setExperienceNotes([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, initializeDefaults]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      fetchPortfolioData();
    }
  }, [hydrated, isAuthenticated, fetchPortfolioData]);

  const handleTotalCapitalChange = (newTotal: number) => {
    setTotalCapital(newTotal);
    setStrategies((prev) =>
      prev.map((s) => {
        const newRupees = newTotal > 0 ? (newTotal * s.allocationPercent) / 100 : 0;
        return {
          ...s,
          allocationRupees: newRupees,
          unusedFunds: newRupees - s.usedFunds,
        };
      })
    );
  };

  const handleStrategyChange = (index: number, field: keyof Omit<Strategy, '_clientId'>, value: string | number) => {
    setStrategies((prev) => {
      const newStrategies = [...prev];
      const strategy = { ...newStrategies[index] };

      if (field === 'name') {
        strategy.name = value as string;
      } else {
        const numValue = typeof value === 'number' ? value : (parseFloat(value as string) || 0);

        if (field === 'allocationPercent') {
          strategy.allocationPercent = numValue;
          strategy.allocationRupees = (totalCapital * numValue) / 100;
          strategy.unusedFunds = strategy.allocationRupees - strategy.usedFunds;
        } else if (field === 'allocationRupees') {
          strategy.allocationRupees = numValue;
          strategy.allocationPercent = totalCapital > 0 ? (numValue / totalCapital) * 100 : 0;
          strategy.unusedFunds = numValue - strategy.usedFunds;
        } else if (field === 'usedFunds') {
          strategy.usedFunds = numValue;
          strategy.unusedFunds = strategy.allocationRupees - numValue;
        }
      }

      newStrategies[index] = strategy;
      return newStrategies;
    });
  };

  const handleAddStrategy = () => {
    setStrategies((prev) => [...prev, makeStrategy()]);
  };

  const handleDeleteStrategy = (index: number) => {
    setStrategies((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    return strategies.reduce(
      (acc, s) => ({
        percent: acc.percent + (s.allocationPercent || 0),
        rupees: acc.rupees + (s.allocationRupees || 0),
        used: acc.used + (s.usedFunds || 0),
        unused: acc.unused + (s.unusedFunds || 0),
      }),
      { percent: 0, rupees: 0, used: 0, unused: 0 }
    );
  };

  const totals = calculateTotals();

  const handleSave = async () => {
    const emptyNames = strategies.filter((s) => !s.name.trim());
    if (emptyNames.length > 0) {
      toast.error('All strategies must have a name');
      return;
    }

    setSaving(true);
    try {
      await apiClient.put('/api/portfolio', {
        marketCondition: activeTab,
        totalCapital,
        strategies: strategies.map((s) => ({
          name: s.name.trim(),
          allocationPercent: s.allocationPercent || 0,
          allocationRupees: s.allocationRupees || 0,
          usedFunds: s.usedFunds || 0,
          unusedFunds: s.unusedFunds || 0,
        })),
        experienceNotes: experienceNotes.map((n) => ({
          positive: n.positive,
          negative: n.negative,
        })),
      });
      toast.success('Portfolio saved successfully');
    } catch (error: unknown) {
      console.error('Failed to save portfolio', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to save portfolio');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddExperienceNote = () => {
    setExperienceNotes((prev) => [...prev, makeExperienceNote()]);
    setEditingNoteIndex(experienceNotes.length);
  };

  const handleDeleteExperienceNote = (index: number) => {
    setExperienceNotes((prev) => prev.filter((_, i) => i !== index));
    if (editingNoteIndex === index) setEditingNoteIndex(null);
    else if (editingNoteIndex !== null && editingNoteIndex > index) {
      setEditingNoteIndex(editingNoteIndex - 1);
    }
  };

  const handleExperienceNoteChange = (index: number, field: 'positive' | 'negative', value: string) => {
    setExperienceNotes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await apiClient.put('/api/portfolio', {
        marketCondition: activeTab,
        totalCapital,
        strategies: strategies.map((s) => ({
          name: s.name.trim(),
          allocationPercent: s.allocationPercent || 0,
          allocationRupees: s.allocationRupees || 0,
          usedFunds: s.usedFunds || 0,
          unusedFunds: s.unusedFunds || 0,
        })),
        experienceNotes: experienceNotes.map((n) => ({
          positive: n.positive,
          negative: n.negative,
        })),
      });
      setEditingNoteIndex(null);
      toast.success('Experience notes saved');
    } catch (error: unknown) {
      console.error('Failed to save notes', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to save notes');
      }
    } finally {
      setSavingNotes(false);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="w-full px-4 py-8 md:px-6 md:py-12 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center">
                <PieChart className="w-7 h-7 text-violet-500" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  Portfolio Management
                </h1>
                <p className="text-muted-foreground mt-1">
                  Keep Rebalancing Your Portfolio Actively
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <label className="text-sm text-muted-foreground mb-1">Total Funds (Rs)</label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <NumberInput
                    value={totalCapital}
                    onChange={handleTotalCapitalChange}
                    min={0}
                    className="pl-9 pr-4 py-2 w-40 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Customized Tabs */}
        <div className="w-full mb-8 overflow-x-auto pb-2">
          <div className="flex w-full border border-border/50 divide-x divide-border">
            {MARKET_CONDITIONS.map((tab) => {
              const isActive = activeTab === tab;

              let textColorClass = 'text-muted-foreground';
              let activeClass = '';

              if (tab === 'Bull Market') {
                textColorClass = isActive ? 'text-[#00FF00] font-bold' : 'text-[#00FF00]/70';
                activeClass = isActive ? 'bg-[#00FF00]/10' : 'bg-gray-50';
              } else if (tab === 'Bullish to Bearish') {
                textColorClass = isActive ? 'text-[#FF00FF] font-bold' : 'text-[#FF00FF]/70';
                activeClass = isActive ? 'bg-[#FF00FF]/10' : 'bg-gray-50';
              } else if (tab === 'Side Ways Market') {
                textColorClass = isActive ? 'text-[#FFA500] font-bold' : 'text-[#FFA500]/70';
                activeClass = isActive ? 'bg-[#FFA500]/10' : 'bg-gray-50';
              } else if (tab === 'Bear Market') {
                textColorClass = isActive ? 'text-[#FF0000] font-bold' : 'text-[#FF0000]/70';
                activeClass = isActive ? 'bg-[#FF0000]/10' : 'bg-gray-50';
              } else if (tab === 'Bearish to Bullish') {
                textColorClass = isActive ? 'text-[#0000FF] font-bold' : 'text-[#0000FF]/70';
                activeClass = isActive ? 'bg-[#0000FF]/10' : 'bg-gray-50';
              }

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex-1 px-4 py-3 text-sm transition-all duration-200 border-b-2
                    ${activeClass}
                    ${textColorClass}
                    ${isActive ? 'border-primary shadow-sm' : 'border-transparent hover:bg-gray-100'}
                  `}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
            <h2 className="text-xl font-bold text-center w-full">
              Total Funds Rs {totalCapital.toLocaleString('en-IN')}
            </h2>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-white hover:bg-white border-b-2 border-black">
                <TableHead className="w-[30%] text-black font-bold border-r border-black">
                  Following Strategies
                </TableHead>
                <TableHead className="text-left text-black font-bold border-r border-black" colSpan={2}>
                  <div className="text-center border-b border-black w-full pb-1 mb-1">
                    Allocation of Funds
                  </div>
                  <div className="flex justify-between px-2">
                    <span>In %</span>
                    <span>In Rupees</span>
                  </div>
                </TableHead>
                <TableHead className="text-right text-black font-bold border-r border-black">
                  Used Funds Rs
                </TableHead>
                <TableHead className="text-right text-black font-bold text-nowrap">
                  Un Used Funds Rs
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    Loading strategies...
                  </TableCell>
                </TableRow>
              ) : strategies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No strategies yet. Click &quot;+ Add Strategy&quot; below to get started.
                  </TableCell>
                </TableRow>
              ) : (
                strategies.map((strategy, index) => (
                  <TableRow
                    key={strategy._clientId}
                    className="border-b border-gray-300 hover:bg-muted/5"
                  >
                    <TableCell className="font-medium border-r border-gray-300 py-1">
                      <div className="flex items-center">
                        <span className="mr-2 text-muted-foreground font-normal">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={strategy.name}
                          onChange={(e) => handleStrategyChange(index, 'name', e.target.value)}
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-medium"
                          placeholder="Strategy Name"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right border-r border-gray-300 py-1 w-[10%]">
                      <NumberInput
                        min={0}
                        max={100}
                        step={0.1}
                        value={strategy.allocationPercent}
                        onChange={(val) => handleStrategyChange(index, 'allocationPercent', val)}
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right border-r border-gray-300 py-1 w-[15%]">
                      <NumberInput
                        min={0}
                        value={strategy.allocationRupees}
                        onChange={(val) => handleStrategyChange(index, 'allocationRupees', val)}
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right border-r border-gray-300 py-1 w-[15%]">
                      <NumberInput
                        min={0}
                        value={strategy.usedFunds}
                        onChange={(val) => handleStrategyChange(index, 'usedFunds', val)}
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground py-1 w-[15%]">
                      {Math.round(strategy.unusedFunds).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="py-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteStrategy(index)}
                      >
                        <span className="sr-only">Delete</span>
                        &times;
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter className="bg-white font-bold border-t-2 border-black">
              <TableRow>
                <TableCell className="border-r border-black">Total</TableCell>
                <TableCell className="text-right border-r border-black" colSpan={1}>
                  {Math.round(totals.percent * 100) / 100}%
                </TableCell>
                <TableCell className="text-right border-r border-black">
                  {Math.round(totals.rupees).toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right border-r border-black">
                  {Math.round(totals.used).toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right">
                  {Math.round(totals.unused).toLocaleString('en-IN')}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <div className="p-4 border-t border-border flex justify-center">
            <Button onClick={handleAddStrategy} variant="outline" className="border-dashed">
              + Add Strategy
            </Button>
          </div>
        </div>

        {/* Experience Notes Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
            <h2 className="text-xl font-bold text-center flex-1 text-red-500">
              Note Down the Experience Time to Time
            </h2>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="bg-violet-600 hover:bg-violet-700 ml-4"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingNotes ? 'Saving...' : 'Save'}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-white hover:bg-white border-b-2 border-black">
                <TableHead className="w-1/2 text-center text-red-500 font-bold border-r border-black">
                  Positives
                </TableHead>
                <TableHead className="w-1/2 text-center text-red-500 font-bold border-r border-black">
                  Negatives
                </TableHead>
                <TableHead className="w-24 text-center text-red-500 font-bold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : experienceNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No experience notes yet. Click &quot;Add Points&quot; below.
                  </TableCell>
                </TableRow>
              ) : (
                experienceNotes.map((note, index) => {
                  const isEditing = editingNoteIndex === index;
                  return (
                    <TableRow key={note._clientId} className="border-b border-gray-300 hover:bg-muted/5">
                      <TableCell className="border-r border-gray-300 py-2 align-top">
                        {isEditing ? (
                          <textarea
                            value={note.positive}
                            onChange={(e) => handleExperienceNoteChange(index, 'positive', e.target.value)}
                            className="w-full bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none min-h-[60px]"
                            placeholder="Write positive experience..."
                          />
                        ) : (
                          <p className="px-2 py-1 whitespace-pre-wrap">{note.positive || <span className="text-muted-foreground italic">—</span>}</p>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-gray-300 py-2 align-top">
                        {isEditing ? (
                          <textarea
                            value={note.negative}
                            onChange={(e) => handleExperienceNoteChange(index, 'negative', e.target.value)}
                            className="w-full bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none min-h-[60px]"
                            placeholder="Write negative experience..."
                          />
                        ) : (
                          <p className="px-2 py-1 whitespace-pre-wrap">{note.negative || <span className="text-muted-foreground italic">—</span>}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center align-top">
                        <div className="flex flex-col gap-1 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2"
                            onClick={() => setEditingNoteIndex(isEditing ? null : index)}
                          >
                            {isEditing ? 'Done' : '+ Edit'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                            onClick={() => handleDeleteExperienceNote(index)}
                          >
                            Del
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="p-4 border-t border-border flex justify-center">
            <Button onClick={handleAddExperienceNote} variant="outline" className="border-dashed">
              + Add Points
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
