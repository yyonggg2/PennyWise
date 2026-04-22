/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  CreditCard,
  Plus,
  History,
  Settings as SettingsIcon,
  Home as HomeIcon,
  Calendar,
  Trash2,
  ChevronRight,
  ChevronUp,
  PlusCircle,
  X,
  Check,
  LogIn,
  LogOut,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  AppState,
  OutputExpense,
  InputExpense,
  FixedExpense,
  Frequency,
  Card,
  Digital,
  Currency,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  CURRENCY_NAMES,
  InitialFunds,
} from "./types";

import { supabase } from "./supabase";
import LoginPage from "./LoginPage";

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Rent",
  "Health",
  "Entertainment",
  "Other",
];

const STORAGE_KEY = "pennywise_budget_data";

const INITIAL_STATE: AppState = {
  primaryCurrency: "CAD",
  cards: [],
  hasCash: false,
  digitalAccount: [],
  initialFunds: { cash: 0 },
  fixedExpenses: [],
  variableExpenses: [],
  inputExpenses: [],
  categories: DEFAULT_CATEGORIES,
  isSetupComplete: false,
  userEmail: null,
  isLoggedIn: false,
  avatar: null,
  exchangeRates: {},
};

type Screen =
  | "Home"
  | "AddExpense"
  | "AddIncome"
  | "FixedExpenses"
  | "History"
  | "Settings";

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from("user_data")
          .select("state")
          .eq("user_id", session.user.id)
          .single();
        if (data?.state) {
          setState({ ...INITIAL_STATE, ...JSON.parse(data.state) });
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setState({ ...INITIAL_STATE, ...JSON.parse(saved) });
        }
      }
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [currentScreen, setCurrentScreen] = useState<Screen>("Home");
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "income" | "expense">("all");
  const [newCardForm, setNewCardForm] = useState<{ name: string; balance: string } | null>(null);
  const [newDigitalForm, setNewDigitalForm] = useState<{ name: string; balance: string } | null>(null);

  // Persist state to localStorage and Supabase
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (session?.user?.id) {
      supabase.from("user_data").upsert({
        user_id: session.user.id,
        state: JSON.stringify(state),
        updated_at: new Date().toISOString(),
      });
    }
  }, [state]);

  // Fetch exchange rates when primary currency changes, and refresh every hour
  useEffect(() => {
    const fetchRates = () => {
      fetch(`https://api.frankfurter.app/latest?from=${state.primaryCurrency}`)
        .then((r) => r.json())
        .then((data) =>
          setState((prev) => ({ ...prev, exchangeRates: data.rates })),
        )
        .catch(() => {});
    };
    fetchRates();
    const interval = setInterval(fetchRates, 3600000);
    return () => clearInterval(interval);
  }, [state.primaryCurrency]);

  // Convert any currency to primary currency
  const convertToPrimary = (amount: number, currency: Currency): number => {
    if (currency === state.primaryCurrency) return amount;
    const rate = state.exchangeRates[currency];
    if (!rate) return amount;
    return amount / rate;
  };

  // Calculations
  const calculations = useMemo(() => {
    const getSpent = (method: string) =>
      state.variableExpenses
        .filter((e) => e.method === method)
        .reduce((sum, e) => sum + e.amountInPrimary, 0);

    const getInput = (method: string) =>
      state.inputExpenses
        .filter((e) => e.method === method)
        .reduce((sum, e) => sum + e.amountInPrimary, 0);

    const cashBalance = state.hasCash
      ? state.initialFunds.cash - getSpent("cash") + getInput("cash")
      : 0;

    const cardBalances = state.cards.map((card) => ({
      card,
      balance: card.initialBalance - getSpent(card.id) + getInput(card.id),
    }));

    const digitalBalance = state.digitalAccount.map((digital) => ({
      digital,
      balance:
        digital.initialBalance - getSpent(digital.id) + getInput(digital.id),
    }));

    const totalBalance =
      cashBalance +
      digitalBalance.reduce((sum, d) => sum + d.balance, 0) +
      cardBalances.reduce((sum, c) => sum + c.balance, 0);

    return {
      cashBalance,
      digitalBalance,
      cardBalances,
      totalBalance,
    };
  }, [state]);

  if (!authReady) return null;
  if (!session) return <LoginPage />;

  const handleLogin = (email: string) => {
    setState((prev) => ({ ...prev, userEmail: email, isLoggedIn: true }));
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const addSettingsCard = () => {
    if (state.cards.length >= 5) return;
    setNewCardForm({ name: "", balance: "" });
  };

  const confirmAddCard = () => {
    if (
      !newCardForm ||
      !newCardForm.name.trim() ||
      !parseFloat(newCardForm.balance)
    )
      return;
    setState((prev) => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          id: crypto.randomUUID(),
          name: newCardForm.name.trim(),
          initialBalance: Math.max(0, parseFloat(newCardForm.balance) || 0),
        },
      ],
    }));
    setNewCardForm(null);
  };

  const addSettingsDigital = () => {
    if (state.digitalAccount.length >= 5) return;
    setNewDigitalForm({ name: "", balance: "" });
  };

  const confirmAddDigital = () => {
    if (
      !newDigitalForm ||
      !newDigitalForm.name.trim() ||
      !parseFloat(newDigitalForm.balance)
    )
      return;
    setState((prev) => ({
      ...prev,
      digitalAccount: [
        ...prev.digitalAccount,
        {
          id: crypto.randomUUID(),
          name: newDigitalForm.name.trim(),
          initialBalance: Math.max(0, parseFloat(newDigitalForm.balance) || 0),
        },
      ],
    }));
    setNewDigitalForm(null);
  };

  const handleReset = () => {
    if (
      confirm("Are you sure you want to reset all data? This cannot be undone.")
    ) {
      setState(INITIAL_STATE);
      setCurrentScreen("Home");
      if (session?.user?.id) {
        supabase.from("user_data").delete().eq("user_id", session.user.id);
      }
    }
  };

  const addOutputExpense = (expense: Omit<OutputExpense, "id" | "date">) => {
    const newExpense: OutputExpense = {
      ...expense,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      variableExpenses: [newExpense, ...prev.variableExpenses],
    }));
    setCurrentScreen("Home");
  };

  const addInputExpense = (expense: Omit<InputExpense, "id" | "date">) => {
    const newExpense: InputExpense = {
      ...expense,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      inputExpenses: [newExpense, ...prev.inputExpenses],
    }));
    setCurrentScreen("Home");
  };

  const deleteOutputExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      variableExpenses: prev.variableExpenses.filter((e) => e.id !== id),
    }));
  };

  const deleteInputExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      inputExpenses: prev.inputExpenses.filter((e) => e.id !== id),
    }));
  };

  const addFixedExpense = (expense: Omit<FixedExpense, "id">) => {
    const newExpense: FixedExpense = {
      ...expense,
      id: crypto.randomUUID(),
    };
    setState((prev) => ({
      ...prev,
      fixedExpenses: [...prev.fixedExpenses, newExpense],
    }));
    setIsAddingFixed(false);
  };

  const deleteFixedExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.filter((e) => e.id !== id),
    }));
  };

  const payFixedExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.map((e) => {
        if (e.id !== id) return e;
        const next = new Date(e.nextDueDate);
        if (e.frequency === "daily") next.setDate(next.getDate() + 1);
        else if (e.frequency === "weekly") next.setDate(next.getDate() + 7);
        else if (e.frequency === "monthly") next.setMonth(next.getMonth() + 1);
        else if (e.frequency === "yearly")
          next.setFullYear(next.getFullYear() + 1);
        return {
          ...e,
          lastPaidDate: new Date().toISOString(),
          nextDueDate: next.toISOString(),
        };
      }),
      variableExpenses: (() => {
        const e = prev.fixedExpenses.find((e) => e.id === id)!;
        const rate = prev.exchangeRates[e.currency];
        const amountInPrimary =
          e.currency === prev.primaryCurrency
            ? e.amount
            : rate
              ? e.amount / rate
              : e.amount;
        return [
          {
            id: crypto.randomUUID(),
            amount: e.amount,
            currency: e.currency,
            amountInPrimary,
            category: e.name,
            note: "",
            date: new Date().toISOString(),
            method: e.method,
          },
          ...prev.variableExpenses,
        ];
      })(),
    }));
  };

  const completeSetup = (setup: {
    primaryCurrency: Currency;
    cards: Card[];
    hasCash: boolean;
    digitalAccount: Digital[];
    initialFunds: InitialFunds;
  }) => {
    setState((prev) => ({ ...prev, ...setup, isSetupComplete: true }));
  };

  if (!state.isSetupComplete) {
    return <SetupWizard onComplete={completeSetup} />;
  }

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans pb-24 relative">
      {/* Header */}
      <header className="bg-white border-b border-black/5 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden cursor-pointer"
              onClick={() => setCurrentScreen("Settings")}
            >
              {state.avatar ? (
                <img
                  src={state.avatar}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={16} />
              )}
            </div>

            <h1 className="text-xl font-semibold tracking-tight">PennyWise</h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {currentScreen === "Home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
            >
              <WalletView
                cash={calculations.cashBalance}
                hasCash={state.hasCash}
                digitalBalance={calculations.digitalBalance}
                cardBalances={calculations.cardBalances}
                total={calculations.totalBalance}
              />
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = state.fixedExpenses.filter((e) => {
                  const d = new Date(e.nextDueDate);
                  d.setHours(0, 0, 0, 0);
                  return d <= today;
                });
                if (due.length === 0) return null;
                return (
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                        Due Bills ({due.length})
                      </p>
                    </div>
                    <div
                      className="flex gap-3 overflow-x-auto pb-2"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {due.map((e) => (
                        <div
                          key={e.id}
                          className="flex-shrink-0 w-52 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex flex-col gap-2"
                        >
                          <p className="text-sm font-semibold text-red-600">{e.name}</p>
                          <p className="text-xs text-red-400">
                            {CURRENCY_SYMBOLS[e.currency]}{e.amount.toLocaleString()} · {new Date(e.nextDueDate).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => payFixedExpense(e.id)}
                            className="text-xs font-bold text-white bg-red-400 hover:bg-red-500 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            Pay
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {currentScreen === "AddExpense" && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ExpenseForm
                categories={state.categories}
                primaryCurrency={state.primaryCurrency}
                exchangeRates={state.exchangeRates}
                hasCash={state.hasCash}
                digitalAccount={state.digitalAccount}
                cards={state.cards}
                onSubmit={addOutputExpense}
                onSubmitIncome={addInputExpense}
                onCancel={() => setCurrentScreen("Home")}
              />
            </motion.div>
          )}

          {currentScreen === "AddIncome" && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <InputForm
                primaryCurrency={state.primaryCurrency}
                exchangeRates={state.exchangeRates}
                hasCash={state.hasCash}
                digitalAccount={state.digitalAccount}
                cards={state.cards}
                onSubmit={addInputExpense}
                onCancel={() => setCurrentScreen("Home")}
              />
            </motion.div>
          )}

          {currentScreen === "FixedExpenses" && (
            <motion.div
              key="fixed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold tracking-tight">
                  Fixed Expenses
                </h2>
                <button
                  onClick={() => setIsAddingFixed(true)}
                  className="p-2 bg-slate-400 text-white rounded-full shadow-sm shadow-slate-200"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {state.fixedExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="bg-white rounded-2xl p-4 border border-black/5 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">{expense.name}</p>
                      <p className="text-[10px] text-black/40 uppercase tracking-wider">
                        {expense.method}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-semibold">
                        {CURRENCY_SYMBOLS[expense.currency]}{expense.amount.toLocaleString()}
                      </p>
                      <button
                        onClick={() => deleteFixedExpense(expense.id)}
                        className="text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {state.fixedExpenses.length === 0 && !isAddingFixed && (
                  <div className="py-12 text-center text-black/30">
                    <p className="text-sm">No fixed expenses set.</p>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isAddingFixed && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm"
                  >
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-6">
                      <h3 className="text-lg font-semibold">
                        Add Fixed Expense
                      </h3>
                      <FixedExpenseForm
                        hasCash={state.hasCash}
                        cards={state.cards}
                        digitalAccount={state.digitalAccount}
                        onSubmit={addFixedExpense}
                        onCancel={() => setIsAddingFixed(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {currentScreen === "History" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                Transaction History
              </h2>
              <div className="flex gap-2">
                {(["all", "income", "expense"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
                      historyFilter === f
                        ? "bg-slate-400 text-white"
                        : "bg-black/5 text-black/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  ...state.variableExpenses.map((e) => ({
                    ...e,
                    kind: "expense" as const,
                  })),
                  ...state.inputExpenses.map((e) => ({
                    ...e,
                    kind: "income" as const,
                  })),
                ]
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .filter(
                    (entry) =>
                      historyFilter === "all" || entry.kind === historyFilter,
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white rounded-2xl p-4 border border-black/5 flex justify-between items-center group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-lg">
                          {entry.kind === "income"
                            ? "💰"
                            : getCategoryEmoji(entry.category)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {entry.kind === "income"
                              ? "Income"
                              : entry.category}
                          </p>
                          <p className="text-[10px] text-black/40">
                            {new Date(entry.date).toLocaleString()}
                          </p>
                          {entry.note && (
                            <p className="text-[10px] text-black/60 italic mt-1">
                              "{entry.note}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${entry.kind === "income" ? "text-green-500" : "text-red-400"}`}
                          >
                            {entry.kind === "income" ? "+" : "-"}{CURRENCY_SYMBOLS[entry.currency as Currency]}
                            {entry.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-black/40 uppercase tracking-tighter">
                            {entry.method}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            entry.kind === "expense"
                              ? deleteOutputExpense(entry.id)
                              : deleteInputExpense(entry.id)
                          }
                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {currentScreen === "Settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <h2 className="text-xl font-semibold tracking-tight">Settings</h2>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    Account
                  </h3>
                  <div className="bg-white rounded-2xl p-6 border border-black/5 space-y-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400">
                        {state.avatar ? (
                          <img
                            src={state.avatar}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={32} />
                        )}
                      </div>
                      <label className="text-xs font-medium text-[#005DAA] cursor-pointer">
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () =>
                              setState((prev) => ({
                                ...prev,
                                avatar: reader.result as string,
                              }));
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Logged in as</span>
                      <span className="font-semibold text-xs">
                        {session?.user?.email ?? state.userEmail}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-100 rounded-xl transition-colors"
                    >
                      <LogOut size={14} />
                      Log Out
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    Cards
                  </h3>
                  <div className="bg-white rounded-2xl p-4 border border-black/5 space-y-3">
                    {state.cards.map((card) => (
                      <div
                        key={card.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium">{card.name}</span>
                        <span className="text-sm text-black/40">
                          {CURRENCY_SYMBOLS[state.primaryCurrency]}
                          {card.initialBalance.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {newCardForm && (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={newCardForm.name}
                          onChange={(e) =>
                            setNewCardForm({
                              ...newCardForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="Card name (e.g. RBC, TD)"
                          className="w-full bg-[#F5F5F5] rounded-xl py-2 px-3 text-sm outline-none"
                          autoFocus
                        />
                        <input
                          type="number"
                          min="0"
                          value={newCardForm.balance}
                          onChange={(e) =>
                            setNewCardForm({
                              ...newCardForm,
                              balance: e.target.value,
                            })
                          }
                          placeholder="Initial balance"
                          className="w-full bg-[#F5F5F5] rounded-xl py-2 px-3 text-sm outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewCardForm(null)}
                            className="flex-1 py-2 rounded-xl border border-black/10 text-xs text-black/40"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={confirmAddCard}
                            className="flex-1 py-2 rounded-xl bg-slate-400 text-white text-xs font-semibold"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                    {!newCardForm && state.cards.length < 5 && (
                      <button
                        onClick={addSettingsCard}
                        className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs text-black/40 hover:border-slate-300 transition-colors"
                      >
                        + Add card
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    Digital Accounts
                  </h3>
                  <div className="bg-white rounded-2xl p-4 border border-black/5 space-y-3">
                    {state.digitalAccount.map((d) => (
                      <div
                        key={d.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium">{d.name}</span>
                        <span className="text-sm text-black/40">
                          {CURRENCY_SYMBOLS[state.primaryCurrency]}
                          {d.initialBalance.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {newDigitalForm && (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={newDigitalForm.name}
                          onChange={(e) =>
                            setNewDigitalForm({
                              ...newDigitalForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="Account name (e.g. PayPal, Wise)"
                          className="w-full bg-[#F5F5F5] rounded-xl py-2 px-3 text-sm outline-none"
                          autoFocus
                        />
                        <input
                          type="number"
                          min="0"
                          value={newDigitalForm.balance}
                          onChange={(e) =>
                            setNewDigitalForm({
                              ...newDigitalForm,
                              balance: e.target.value,
                            })
                          }
                          placeholder="Initial balance"
                          className="w-full bg-[#F5F5F5] rounded-xl py-2 px-3 text-sm outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewDigitalForm(null)}
                            className="flex-1 py-2 rounded-xl border border-black/10 text-xs text-black/40"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={confirmAddDigital}
                            className="flex-1 py-2 rounded-xl bg-slate-400 text-white text-xs font-semibold"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                    {!newDigitalForm && state.digitalAccount.length < 5 && (
                      <button
                        onClick={addSettingsDigital}
                        className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs text-black/40 hover:border-slate-300 transition-colors"
                      >
                        + Add digital account
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    Danger Zone
                  </h3>
                  <button
                    onClick={handleReset}
                    className="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    Reset All Data
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-6 py-4 z-20">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <NavButton
            active={currentScreen === "Home"}
            onClick={() => setCurrentScreen("Home")}
            icon={<HomeIcon size={20} />}
            label="Home"
          />
          <NavButton
            active={currentScreen === "History"}
            onClick={() => setCurrentScreen("History")}
            icon={<History size={20} />}
            label="History"
          />
          <button
            onClick={() => setCurrentScreen("AddExpense")}
            className="w-12 h-12 bg-slate-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-slate-200 -mt-10 border-4 border-white"
          >
            <Plus size={24} />
          </button>
          <NavButton
            active={currentScreen === "FixedExpenses"}
            onClick={() => setCurrentScreen("FixedExpenses")}
            icon={<Calendar size={20} />}
            label="Fixed"
          />
          <NavButton
            active={currentScreen === "Settings"}
            onClick={() => setCurrentScreen("Settings")}
            icon={<SettingsIcon size={20} />}
            label="Settings"
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? "text-slate-500" : "text-black/30"}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function SetupWizard({
  onComplete,
}: {
  onComplete: (setup: {
    primaryCurrency: Currency;
    cards: Card[];
    hasCash: boolean;
    digitalAccount: Digital[];
    initialFunds: InitialFunds;
  }) => void;
}) {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [hasCash, setHasCash] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [hasDigital, setHasDigital] = useState(false);

  const [cards, setCards] = useState<Card[]>([
    { id: crypto.randomUUID(), name: "", initialBalance: 0 },
  ]);
  const [cashBalance, setCashBalance] = useState("");
  const [digitalAccount, setDigitalAccount] = useState<Digital[]>([
    { id: crypto.randomUUID(), name: "PayPal", initialBalance: 0 },
  ]);

  const sym = CURRENCY_SYMBOLS[currency];

  const addCard = () => {
    if (cards.length >= 5) return;
    setCards((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", initialBalance: 0 },
    ]);
  };

  const removeCard = (id: string) => {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const addDigital = () => {
    if (digitalAccount.length >= 5) return;
    setDigitalAccount((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", initialBalance: 0 },
    ]);
  };

  const updateCard = (
    id: string,
    field: keyof Card,
    value: string | number,
  ) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const updateDigital = (
    id: string,
    field: keyof Digital,
    value: string | number,
  ) => {
    setDigitalAccount((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );
  };

  const handleFinish = () => {
    onComplete({
      primaryCurrency: currency,
      cards: hasCard ? cards.filter((c) => c.name.trim()) : [],
      hasCash,
      digitalAccount: hasDigital ? digitalAccount.filter((d) => d.name.trim()) : [],
      initialFunds: {
        cash: parseFloat(cashBalance) || 0,
      },
    });
  };

  const STEPS = ["Currency", "Payment Methods", "Cards", "Digital", "Balances"];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Step indicator */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1 w-full rounded-full transition-colors ${i + 1 <= step ? "bg-slate-400" : "bg-black/10"}`}
              />
              <span
                className={`text-[8px] font-bold uppercase tracking-wider ${i + 1 === step ? "text-slate-500" : "text-black/20"}`}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Currency */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                What's your primary currency?
              </h1>
              <p className="text-black/40 text-sm mt-1">
                All amounts will be shown in this currency.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${currency === c ? "border-slate-400 bg-slate-50" : "border-black/5 bg-[#F5F5F5]"}`}
                >
                  <div className="font-bold text-sm">{c}</div>
                  <div className="text-xs text-black/40">
                    {CURRENCY_NAMES[c]}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Payment Methods */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                How do you pay?
              </h1>
              <p className="text-black/40 text-sm mt-1">
                Select all that apply.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Cash",
                  desc: "Physical money",
                  state: hasCash,
                  set: setHasCash,
                },
                {
                  label: "Card",
                  desc: "Credit / Debit cards",
                  state: hasCard,
                  set: setHasCard,
                },
                {
                  label: "Digital",
                  desc: "Paypal",
                  state: hasDigital,
                  set: setHasDigital,
                },
              ].map(({ label, desc, state: s, set }) => (
                <button
                  key={label}
                  onClick={() => set(!s)}
                  className={`w-full p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${s ? "border-slate-400 bg-slate-50" : "border-black/5 bg-[#F5F5F5]"}`}
                >
                  <div>
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs text-black/40">{desc}</div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${s ? "border-slate-400 bg-slate-400" : "border-black/20"}`}
                  >
                    {s && <Check size={10} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl border border-black/10 text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(hasCard ? 3 : hasDigital ? 4 : 5)}
                className="flex-1 bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Cards */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Set up your cards
              </h1>
              <p className="text-black/40 text-sm mt-1">
                Up to 5 cards. Add as many as you need.
              </p>
            </div>
            <div className="space-y-3">
              {cards.map((card, i) => (
                <div
                  key={card.id}
                  className="bg-[#F5F5F5] rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-black/40 uppercase tracking-wider">
                      Card {i + 1}
                    </div>
                    {cards.length > 1 && (
                      <button
                        onClick={() => removeCard(card.id)}
                        className="text-black/30 hover:text-red-400 transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) =>
                      updateCard(card.id, "name", e.target.value)
                    }
                    placeholder="Card name (e.g. RBC, TD)"
                    className="w-full bg-white rounded-xl py-2 px-3 text-sm outline-none border border-black/5"
                  />
                  <div className="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden">
                    <span className="pl-3 pr-1 text-black/30 text-sm whitespace-nowrap">
                      {sym}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={card.initialBalance || ""}
                      onChange={(e) =>
                        updateCard(
                          card.id,
                          "initialBalance",
                          Math.max(0, parseFloat(e.target.value) || 0),
                        )
                      }
                      placeholder="0.00"
                      className="flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ))}
              {cards.length < 5 && (
                <button
                  onClick={addCard}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-black/10 text-sm text-black/40 hover:border-slate-300 transition-colors"
                >
                  + Add another card
                </button>
              )}
            </div>
            {cards.some((c) => !c.name.trim() || c.initialBalance <= 0) && (
              <p className="text-red-400 text-xs font-semibold">
                Please enter a name and initial balance for each card.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl border border-black/10 text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (
                    cards.some((c) => !c.name.trim() || c.initialBalance <= 0)
                  )
                    return;
                  setStep(hasDigital ? 4 : 5);
                }}
                className={`flex-1 py-4 rounded-2xl font-semibold transition-colors ${cards.some((c) => !c.name.trim() || c.initialBalance <= 0) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-400 text-white hover:bg-slate-500"}`}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Digital */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Set up your digital payments
              </h1>
              <p className="text-black/40 text-sm mt-1">
                Up to 5 accounts. PayPal, e-transfers, etc.
              </p>
            </div>
            <div className="space-y-3">
              {digitalAccount.map((d, i) => (
                <div
                  key={d.id}
                  className="bg-[#F5F5F5] rounded-2xl p-4 space-y-3"
                >
                  <div className="text-xs font-bold text-black/40 uppercase tracking-wider">
                    Digital {i + 1}
                  </div>
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) =>
                      updateDigital(d.id, "name", e.target.value)
                    }
                    placeholder="Account name (e.g. PayPal, Wise)"
                    className="w-full bg-white rounded-xl py-2 px-3 text-sm outline-none border border-black/5"
                  />
                  <div className="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden">
                    <span className="pl-3 pr-1 text-black/30 text-sm whitespace-nowrap">
                      {sym}
                    </span>
                    <input
                      type="number"
                      value={d.initialBalance || ""}
                      onChange={(e) =>
                        updateDigital(
                          d.id,
                          "initialBalance",
                          Math.max(0, parseFloat(e.target.value) || 0),
                        )
                      }
                      placeholder="0.00"
                      className="flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ))}
              {digitalAccount.length < 5 && (
                <button
                  onClick={addDigital}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-black/10 text-sm text-black/40 hover:border-slate-300 transition-colors"
                >
                  + Add another account
                </button>
              )}
            </div>
            {digitalAccount.some(
              (d) => !d.name.trim() || d.initialBalance <= 0,
            ) && (
              <p className="text-red-400 text-xs font-semibold">
                Please enter a name and initial balance for each account.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(hasCard ? 3 : 2)}
                className="flex-1 py-4 rounded-2xl border border-black/10 text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (
                    digitalAccount.some(
                      (d) => !d.name.trim() || d.initialBalance <= 0,
                    )
                  )
                    return;
                  setStep(5);
                }}
                className={`flex-1 py-4 rounded-2xl font-semibold transition-colors ${digitalAccount.some((d) => !d.name.trim() || d.initialBalance <= 0) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-400 text-white hover:bg-slate-500"}`}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Balances */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cash</h1>
              <p className="text-black/40 text-sm mt-1">
                How much cash do you have right now?
              </p>
            </div>
            <div className="space-y-3">
              {hasCash && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-black/40 uppercase tracking-wider">
                    Cash
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 text-sm pointer-events-none">
                      {sym}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={cashBalance}
                      onChange={(e) =>
                        setCashBalance(
                          Math.max(
                            0,
                            parseFloat(e.target.value) || 0,
                          ).toString(),
                        )
                      }
                      placeholder="0.00"
                      className="w-full bg-[#F5F5F5] rounded-2xl py-4 pl-14 pr-4 outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 py-4 rounded-2xl border border-black/10 text-sm font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors"
                >
                  Start Tracking
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) onLogin(email);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">PennyWise</h1>
          <p className="text-black/50">Personal Budget Tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[#F5F5F5] border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-slate-400 outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors shadow-lg shadow-slate-100"
          >
            Log In
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function WalletView({
  cash,
  hasCash,
  digitalBalance,
  cardBalances,
  total,
}: {
  cash: number;
  hasCash: boolean;
  digitalBalance: { digital: Digital; balance: number }[];
  cardBalances: { card: { id: string; name: string }; balance: number }[];
  total: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const leatherBg =
    "linear-gradient(145deg, #7A4422 0%, #4A2C0A 25%, #5C3415 55%, #3A2008 80%, #4A2C0A 100%)";
  const innerBg =
    "linear-gradient(160deg, #1E1206 0%, #150D04 50%, #1A1005 100%)";

  return (
    <div className="flex flex-col items-center select-none">
      {/* Perspective wrapper */}
      <div style={{ perspective: "1200px" }}>
        <div
          className="relative cursor-pointer"
          style={{ width: 340, height: 230 }}
          onClick={() => setIsOpen((o) => !o)}
        >
          {/* DROP SHADOW */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full h-8 rounded-full bg-black/30 blur-xl pointer-events-none" />

          {/* ── INTERIOR — always behind the cover ── */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden flex">
            {/* Left half — Cash */}
            <div
              className="w-1/2 h-full flex flex-col justify-between p-4"
              style={{ background: innerBg }}
            >
              <p className="text-[11px] font-black uppercase tracking-normal text-[#C8A96E]/45">
                Total Available
              </p>
              <div>
                <p className="mt-[-10px] text-2xl font-black text-white/90 tracking-normal">
                  ${total.toLocaleString()}
                </p>
              </div>
              <div className="mb-10 border-t border-white/[0.07] pt-3">
                <p className="text-[7px] font-black uppercase tracking-normal text-[#C8A96E]/45">
                  Cash
                </p>
                {hasCash ? (
                  <p className="mt-4 text-[15px] font-black text-white/75">
                    ${cash.toLocaleString()}
                  </p>
                ) : (
                  <p className="mt-4 text-[9px] text-white/20 italic">
                    No cash added
                  </p>
                )}
              </div>
            </div>

            {/* Center fold crease */}
            <div className="w-px self-stretch bg-black/40" />

            {/* Right half — Cards & Digital */}
            <div
              className="w-1/2 h-full flex flex-col p-4"
              style={{ background: innerBg }}
            >
              <div
                style={{ flex: 1 }}
                className="flex flex-col justify-start overflow-hidden"
              >
                <p className="text-[7px] font-black uppercase tracking-normal text-[#C8A96E]/45 mb-3 shrink-0">
                  Cards
                </p>
                <div
                  className="space-y-1 overflow-y-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  {cardBalances.length === 0 ? (
                    <p className="text-[9px] text-white/20 italic">
                      No cards added
                    </p>
                  ) : (
                    cardBalances.slice(0, 5).map(({ card, balance }) => (
                      <div
                        key={card.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-[9px] font-semibold text-white/45 truncate max-w-[64px]">
                          {card.name}
                        </span>
                        <span className="text-[10px] font-black text-white/80">
                          ${balance.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div
                style={{ flex: 1 }}
                className="border-t border-white/[0.07] pt-3 flex flex-col overflow-hidden"
              >
                <p className="text-[7px] font-black uppercase tracking-normal text-[#C8A96E]/45 mb-1 shrink-0">
                  Digital
                </p>
                <div
                  className="space-y-1 overflow-y-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  {digitalBalance.length === 0 ? (
                    <p className="text-[9px] text-white/20 italic">
                      No digital accounts
                    </p>
                  ) : (
                    digitalBalance.map(({ digital, balance }) => (
                      <div
                        key={digital.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-[9px] font-semibold text-white/45 truncate max-w-[64px]">
                          {digital.name}
                        </span>
                        <span className="text-[10px] font-black text-white/80">
                          ${balance.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── COVER — full-width, opens like a book ── */}
          <motion.div
            animate={{ rotateY: isOpen ? 180 : 0 }}
            transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
            className="absolute inset-0 rounded-2xl"
            style={{
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              zIndex: 2,
            }}
          >
            {/* Leather exterior — front face only, disappears when open */}
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{ background: leatherBg, backfaceVisibility: "hidden" }}
            >
              {/* Grain */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none">
                <filter id="lgrain">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.7"
                    numOctaves="4"
                    stitchTiles="stitch"
                  />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#lgrain)" />
              </svg>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute inset-[8px] rounded-xl border border-dashed border-[#C8A96E]/28 pointer-events-none" />
              {/* Gold clasp center-right */}
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-[#E0C070] to-[#8B6914] shadow-[0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#C9A84C]/50" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({
  categories,
  primaryCurrency,
  exchangeRates,
  hasCash,
  digitalAccount,
  cards,
  onSubmit,
  onSubmitIncome,
  onCancel,
}: {
  categories: string[];
  primaryCurrency: Currency;
  exchangeRates: Record<string, number>;
  hasCash: boolean;
  digitalAccount: Digital[];
  cards: Card[];
  onSubmit: (expense: Omit<OutputExpense, "id" | "date">) => void;
  onSubmitIncome: (expense: Omit<InputExpense, "id" | "date">) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(primaryCurrency);
  const [category, setCategory] = useState(categories[0]);
  const [note, setNote] = useState("");

  const defaultMethod = hasCash
    ? "cash"
    : (cards[0]?.id ?? digitalAccount[0]?.id ?? "cash");
  const [method, setMethod] = useState(defaultMethod);

  const convertToPrimary = (amt: number, cur: Currency) => {
    if (cur === primaryCurrency) return amt;
    const rate = exchangeRates[cur];
    return rate ? amt / rate : amt;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    const raw = parseFloat(amount);
    if (raw <= 0) return;
    const payload = {
      amount: raw,
      currency,
      amountInPrimary: convertToPrimary(raw, currency),
      category,
      note,
      method,
    };
    if (type === "expense") {
      onSubmit(payload);
    } else {
      onSubmitIncome(payload);
    }
  };

  const paymentOptions = [
    ...(hasCash ? [{ id: "cash", label: "Cash" }] : []),
    ...cards.map((c) => ({ id: c.id, label: c.name })),
    ...digitalAccount.map((d) => ({ id: d.id, label: d.name })),
  ];

  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex bg-black/5 rounded-2xl p-1 flex-1 mr-4">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              type === "expense"
                ? "bg-white shadow text-black"
                : "text-black/40"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              type === "income" ? "bg-white shadow text-black" : "text-black/40"
            }`}
          >
            Income
          </button>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-black/5 rounded-full"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Amount + Currency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Amount
            </label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="bg-[#F5F5F5] border-none rounded-xl py-4 px-3 text-sm font-bold outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex items-center flex-1 bg-white border border-black/5 rounded-2xl focus-within:ring-2 focus-within:ring-slate-400 transition-all overflow-hidden">
                <span className="pl-4 pr-1 text-black/30 text-sm whitespace-nowrap">
                  {sym}
                </span>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="flex-1 bg-transparent py-4 pr-4 outline-none"
                  required
                />
              </div>
            </div>
            {currency !== primaryCurrency && amount && (
              <p className="text-xs text-black/40 pl-1">
                ≈ {CURRENCY_SYMBOLS[primaryCurrency]}
                {convertToPrimary(parseFloat(amount) || 0, currency).toFixed(
                  2,
                )}{" "}
                {primaryCurrency}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              {type === "income" ? "Add to" : "Pay with"}
            </label>
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMethod(opt.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${method === opt.id ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5 hover:border-slate-200"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          {type === "expense" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${category === cat ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5 hover:border-slate-200"}`}
                  >
                    <span className="text-lg">{getCategoryEmoji(cat)}</span>
                    <span className="text-[8px] font-bold uppercase truncate w-full text-center">
                      {cat}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was this for?"
              className="w-full bg-white border border-black/5 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors shadow-lg shadow-slate-100"
        >
          Save Expense
        </button>
      </form>
    </div>
  );
}

function FixedExpenseForm({
  hasCash,
  cards,
  digitalAccount,
  onSubmit,
  onCancel,
}: {
  hasCash: boolean;
  cards: Card[];
  digitalAccount: Digital[];
  onSubmit: (expense: Omit<FixedExpense, "id">) => void;
  onCancel: () => void;
}) {
  const paymentOptions = [
    ...(hasCash ? [{ id: "cash", label: "Cash" }] : []),
    ...cards.map((c) => ({ id: c.id, label: c.name })),
    ...digitalAccount.map((d) => ({ id: d.id, label: d.name })),
  ];

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(paymentOptions[0]?.id ?? "cash");
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [nextDueDate, setNextDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;
    onSubmit({
      name,
      amount: parseFloat(amount),
      currency,
      method,
      frequency,
      nextDueDate: new Date(nextDueDate).toISOString(),
      lastPaidDate: null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rent, Netflix"
          className="w-full bg-[#F5F5F5] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-slate-400 outline-none"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-[#F5F5F5] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-slate-400 outline-none"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Payment Method
        </label>
        <div className="flex flex-wrap gap-2">
          {paymentOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMethod(opt.id)}
              className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase border transition-all ${method === opt.id ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Frequency
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(["daily", "weekly", "monthly", "yearly"] as Frequency[]).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${frequency === f ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5"}`}
              >
                {f}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Next Due Date
        </label>
        <input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          className="w-full bg-[#F5F5F5] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-slate-400 outline-none"
          required
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 text-sm font-medium text-black/60 hover:text-slate-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 bg-slate-400 text-white py-3 rounded-xl text-sm font-semibold shadow-sm shadow-slate-100"
        >
          Add
        </button>
      </div>
    </form>
  );
}

function getCategoryEmoji(category: string) {
  switch (category) {
    case "Food":
      return "🍕";
    case "Transport":
      return "🚗";
    case "Shopping":
      return "🛍️";
    case "Utilities":
      return "💡";
    case "Rent":
      return "🏠";
    case "Health":
      return "🏥";
    case "Entertainment":
      return "🎬";
    case "Other":
      return "📦";
    default:
      return "💰";
  }
}

function InputForm({
  primaryCurrency,
  exchangeRates,
  hasCash,
  digitalAccount,
  cards,
  onSubmit,
  onCancel,
}: {
  primaryCurrency: Currency;
  exchangeRates: Record<string, number>;
  hasCash: boolean;
  digitalAccount: Digital[];
  cards: Card[];
  onSubmit: (expense: Omit<InputExpense, "id" | "date">) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(primaryCurrency);
  const [note, setNote] = useState("");

  const defaultMethod = hasCash
    ? "cash"
    : (cards[0]?.id ?? digitalAccount[0]?.id ?? "cash");
  const [method, setMethod] = useState(defaultMethod);

  const convertToPrimary = (amt: number, cur: Currency) => {
    if (cur === primaryCurrency) return amt;
    const rate = exchangeRates[cur];
    return rate ? amt / rate : amt;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    const raw = parseFloat(amount);
    if (raw <= 0) return;
    onSubmit({
      amount: raw,
      currency,
      amountInPrimary: convertToPrimary(raw, currency),
      category: "Income",
      note,
      method,
    });
  };

  const accountOptions = [
    ...(hasCash ? [{ id: "cash", label: "Cash" }] : []),
    ...cards.map((c) => ({ id: c.id, label: c.name })),
    ...digitalAccount.map((d) => ({ id: d.id, label: d.name })),
  ];

  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">Add Income</h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-black/5 rounded-full"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Amount + Currency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Amount
            </label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="bg-[#F5F5F5] border-none rounded-xl py-4 px-3 text-sm font-bold outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex items-center flex-1 bg-white border border-black/5 rounded-2xl focus-within:ring-2 focus-within:ring-slate-400 transition-all overflow-hidden">
                <span className="pl-4 pr-1 text-black/30 text-sm whitespace-nowrap">
                  {sym}
                </span>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="flex-1 bg-transparent py-4 pr-4 outline-none"
                  required
                />
              </div>
            </div>
            {currency !== primaryCurrency && amount && (
              <p className="text-xs text-black/40 pl-1">
                ≈ {CURRENCY_SYMBOLS[primaryCurrency]}
                {convertToPrimary(parseFloat(amount) || 0, currency).toFixed(
                  2,
                )}{" "}
                {primaryCurrency}
              </p>
            )}
          </div>

          {/* Account */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Add to
            </label>
            <div className="flex flex-wrap gap-2">
              {accountOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMethod(opt.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${method === opt.id ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5 hover:border-slate-200"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Salary, Freelance..."
              className="w-full bg-white border border-black/5 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors shadow-lg shadow-slate-100"
        >
          Save Income
        </button>
      </form>
    </div>
  );
}
