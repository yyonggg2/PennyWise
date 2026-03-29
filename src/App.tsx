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
  hasDigital: false,
  hasOther: false,
  initialFunds: { cash: 0, digital: 0, other: 0 },
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
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...INITIAL_STATE, ...JSON.parse(saved) } : INITIAL_STATE;
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>("Home");
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "income" | "expense"
  >("all");

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Fetch exchange rates when primary currency changes
  useEffect(() => {
    fetch(`https://api.frankfurter.app/latest?from=${state.primaryCurrency}`)
      .then((r) => r.json())
      .then((data) =>
        setState((prev) => ({ ...prev, exchangeRates: data.rates })),
      )
      .catch(() => {});
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
    const digitalBalance = state.hasDigital
      ? state.initialFunds.digital - getSpent("digital") + getInput("digital")
      : 0;
    const otherBalance = state.hasOther
      ? state.initialFunds.other - getSpent("other") + getInput("other")
      : 0;

    const cardBalances = state.cards.map((card) => ({
      card,
      balance: card.initialBalance - getSpent(card.id) + getInput(card.id),
    }));

    const totalBalance =
      cashBalance +
      digitalBalance +
      otherBalance +
      cardBalances.reduce((sum, c) => sum + c.balance, 0);

    return {
      cashBalance,
      digitalBalance,
      otherBalance,
      cardBalances,
      totalBalance,
    };
  }, [state]);

  if (!session) return <LoginPage />;

  const handleLogin = (email: string) => {
    setState((prev) => ({ ...prev, userEmail: email, isLoggedIn: true }));
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const handleReset = () => {
    if (
      confirm("Are you sure you want to reset all data? This cannot be undone.")
    ) {
      setState(INITIAL_STATE);
      setCurrentScreen("Home");
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
      variableExpenses: [
        {
          id: crypto.randomUUID(),
          amount: prev.fixedExpenses.find((e) => e.id === id)!.amount,
          currency: prev.fixedExpenses.find((e) => e.id === id)!.currency,
          amountInPrimary: prev.fixedExpenses.find((e) => e.id === id)!.amount,
          category: prev.fixedExpenses.find((e) => e.id === id)!.name,
          note: "",
          date: new Date().toISOString(),
          method: prev.fixedExpenses.find((e) => e.id === id)!.method,
        },
        ...prev.variableExpenses,
      ],
    }));
  };

  const completeSetup = (setup: {
    primaryCurrency: Currency;
    cards: Card[];
    hasCash: boolean;
    hasDigital: boolean;
    hasOther: boolean;
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentScreen("Settings")}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <SettingsIcon size={20} />
            </button>
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
              className="space-y-8"
            >
              {/* Wallet View */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-black/40 uppercase tracking-widest text-center">
                  My Wallet
                </p>
                <WalletView
                  cash={calculations.cashBalance}
                  online={calculations.cardBalances[0]?.balance ?? 0}
                  pocketMoney={calculations.cardBalances[1]?.balance ?? 0}
                  total={calculations.totalBalance}
                />
              </div>

              {/* Due Bills */}
              {state.fixedExpenses.filter(
                (e) => new Date(e.nextDueDate) <= new Date(),
              ).length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-black/40 uppercase tracking-widest">
                    Due Bills
                  </p>
                  {state.fixedExpenses
                    .filter((e) => new Date(e.nextDueDate) <= new Date())
                    .map((e) => (
                      <div
                        key={e.id}
                        className="bg-white rounded-2xl p-4 border border-black/5 flex justify-between items-center shadow-sm"
                      >
                        <div>
                          <p className="font-semibold text-sm">{e.name}</p>
                          <p className="text-xs text-black/40">
                            ${e.amount.toLocaleString()} · {e.method}
                          </p>
                        </div>
                        <button
                          onClick={() => payFixedExpense(e.id)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                        >
                          Pay
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Recent Activity */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-black/40">
                    Recent Activity
                  </h2>
                  <button
                    onClick={() => setCurrentScreen("History")}
                    className="text-xs font-medium text-black/60 hover:text-black"
                  >
                    View All
                  </button>
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
                    .slice(0, 5)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-2xl p-4 border border-black/5 flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-lg">
                            {getCategoryEmoji(entry.category)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {entry.category}
                            </p>
                            <p className="text-[10px] text-black/40">
                              {new Date(entry.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${entry.kind === "income" ? "text-green-500" : ""}`}
                          >
                            {entry.kind === "income" ? "+" : "-"}$
                            {entry.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-black/40 uppercase tracking-tighter">
                            {entry.method}
                          </p>
                        </div>
                      </div>
                    ))}
                  {state.variableExpenses.length === 0 &&
                    state.inputExpenses.length === 0 && (
                      <div className="py-12 text-center text-black/30">
                        <p className="text-sm">No transactions logged yet.</p>
                      </div>
                    )}
                </div>
              </div>
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
                hasDigital={state.hasDigital}
                hasOther={state.hasOther}
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
                hasDigital={state.hasDigital}
                hasOther={state.hasOther}
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
                        ${expense.amount.toLocaleString()}
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
                            {entry.kind === "income" ? "+" : "-"}$
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
                        {state.userEmail}
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
                    Initial Funds
                  </h3>
                  <div className="bg-white rounded-2xl p-6 border border-black/5 space-y-4">
                    {state.hasCash && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Cash</span>
                        <span className="font-semibold">
                          {CURRENCY_SYMBOLS[state.primaryCurrency]}
                          {state.initialFunds.cash.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {state.hasDigital && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Digital</span>
                        <span className="font-semibold">
                          {CURRENCY_SYMBOLS[state.primaryCurrency]}
                          {state.initialFunds.digital.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {state.cards.map((card) => (
                      <div
                        key={card.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm">{card.name}</span>
                        <span className="font-semibold">
                          {CURRENCY_SYMBOLS[state.primaryCurrency]}
                          {card.initialBalance.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          isSetupComplete: false,
                        }))
                      }
                      className="w-full py-2 text-xs font-medium text-black/60 hover:text-black border border-black/5 rounded-xl transition-colors"
                    >
                      Edit Initial Funds
                    </button>
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
    hasDigital: boolean;
    hasOther: boolean;
    initialFunds: InitialFunds;
  }) => void;
}) {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [hasCash, setHasCash] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [hasDigital, setHasDigital] = useState(false);
  const [hasOther, setHasOther] = useState(false);
  const [cards, setCards] = useState<Card[]>([
    { id: crypto.randomUUID(), name: "RBC", initialBalance: 0 },
    { id: crypto.randomUUID(), name: "Visa", initialBalance: 0 },
  ]);
  const [cashBalance, setCashBalance] = useState("");
  const [digitalBalance, setDigitalBalance] = useState("");
  const [otherBalance, setOtherBalance] = useState("");

  const sym = CURRENCY_SYMBOLS[currency];

  const addCard = () => {
    if (cards.length >= 5) return;
    setCards((prev) => [
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

  const handleFinish = () => {
    onComplete({
      primaryCurrency: currency,
      cards: hasCard ? cards.filter((c) => c.name.trim()) : [],
      hasCash,
      hasDigital,
      hasOther,
      initialFunds: {
        cash: parseFloat(cashBalance) || 0,
        digital: parseFloat(digitalBalance) || 0,
        other: parseFloat(otherBalance) || 0,
      },
    });
  };

  const STEPS = ["Currency", "Payment Methods", "Cards", "Balances"];

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
                  desc: "E-transfers, PayPal, etc.",
                  state: hasDigital,
                  set: setHasDigital,
                },
                {
                  label: "Other",
                  desc: "Anything else",
                  state: hasOther,
                  set: setHasOther,
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
                onClick={() => setStep(hasCard ? 3 : 4)}
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
                Up to 5 cards. RBC and Visa are pre-added.
              </p>
            </div>
            <div className="space-y-3">
              {cards.map((card, i) => (
                <div
                  key={card.id}
                  className="bg-[#F5F5F5] rounded-2xl p-4 space-y-3"
                >
                  <div className="text-xs font-bold text-black/40 uppercase tracking-wider">
                    Card {i + 1}
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
                      value={card.initialBalance || ""}
                      onChange={(e) =>
                        updateCard(
                          card.id,
                          "initialBalance",
                          parseFloat(e.target.value) || 0,
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
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl border border-black/10 text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-slate-400 text-white py-4 rounded-2xl font-semibold hover:bg-slate-500 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Balances */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Initial balances
              </h1>
              <p className="text-black/40 text-sm mt-1">
                How much do you have right now?
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
                      value={cashBalance}
                      onChange={(e) => setCashBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#F5F5F5] rounded-2xl py-4 pl-14 pr-4 outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}
              {hasDigital && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-black/40 uppercase tracking-wider">
                    Digital
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 text-sm pointer-events-none">
                      {sym}
                    </span>
                    <input
                      type="number"
                      value={digitalBalance}
                      onChange={(e) => setDigitalBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#F5F5F5] rounded-2xl py-4 pl-14 pr-4 outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}
              {hasOther && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-black/40 uppercase tracking-wider">
                    Other
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 text-sm pointer-events-none">
                      {sym}
                    </span>
                    <input
                      type="number"
                      value={otherBalance}
                      onChange={(e) => setOtherBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#F5F5F5] rounded-2xl py-4 pl-14 pr-4 outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(hasCard ? 3 : 2)}
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
  online,
  pocketMoney,
  total,
}: {
  cash: number;
  online: number;
  pocketMoney: number;
  total: number;
}) {
  const [selected, setSelected] = useState<
    "cash" | "rbc" | "visa" | "online" | "pocket" | null
  >(null);

  return (
    <div className="space-y-8">
      <div className="relative w-full aspect-[4/3] max-w-sm mx-auto perspective-1000 isolate">
        {/* Wallet Base - Leather Texture */}
        <div className="absolute inset-0 bg-[#4A3728] rounded-[32px] shadow-2xl overflow-hidden border-b-8 border-r-8 border-[#2D1B0F] flex">
          {/* Left Side of Bifold */}
          <div className="w-1/2 h-full border-r border-black/20 relative bg-gradient-to-br from-[#5A4738] to-[#4A3728]">
            {/* Pockets */}
            <div className="absolute top-4 left-4 right-4 h-16 bg-[#3D2B1F] rounded-t-xl border-t border-white/10 shadow-inner"></div>
            <div className="absolute top-10 left-4 right-4 h-16 bg-[#3D2B1F] rounded-t-xl border-t border-white/10 shadow-inner"></div>
            <div className="absolute top-16 left-4 right-4 h-16 bg-[#3D2B1F] rounded-t-xl border-t border-white/10 shadow-inner"></div>

            {/* Folded Cash sticking out */}
            <AnimatePresence>
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: 0 }}
                onClick={() => setSelected(selected === "cash" ? null : "cash")}
                className={`absolute top-10 left-5.5 right-1 cursor-pointer ${selected === "cash" ? "z-50" : "z-1"}`}
              >
                {/* CAD $100 Bill - Realistic */}
                <div
                  className={`relative w-full h-32 rounded-sm overflow-hidden transition-all duration-300 ${selected === "cash" ? "shadow-[0_0_18px_rgba(180,140,80,0.8)]" : "shadow-lg"}`}
                  style={{
                    background:
                      "linear-gradient(135deg, #C49A6C 0%, #B8864E 40%, #C49A6C 60%, #A87840 100%)",
                  }}
                >
                  {/* Guilloche line pattern */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <svg width="100%" height="100%">
                      {[
                        4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56,
                        60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108,
                        112, 116, 120, 124,
                      ].map((y) => (
                        <path
                          key={y}
                          d={`M0 ${y} Q 20 ${y - 3}, 40 ${y} T 80 ${y} T 160 ${y} T 240 ${y}`}
                          fill="none"
                          stroke="#3D2000"
                          strokeWidth="0.5"
                        />
                      ))}
                    </svg>
                  </div>

                  {/* Top row */}
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                    <span className="text-[9px] font-black text-[#3D2000]/70">
                      100
                    </span>
                    <div className="text-[5px] font-bold text-[#3D2000]/60 text-center leading-tight">
                      BANK OF CANADA
                      <br />
                      BANQUE DU CANADA
                    </div>
                    <span className="text-[9px] font-black text-[#3D2000]/70">
                      100
                    </span>
                  </div>

                  {/* Portrait oval */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-12 rounded-full bg-[#8B5E2A]/30 border border-[#5D3A1A]/30 flex items-end justify-center overflow-hidden z-10">
                    <div className="w-7 h-8 rounded-t-full bg-[#5D3A1A]/40 mb-0"></div>
                  </div>

                  {/* Holographic security strip */}
                  <div
                    className="absolute right-5 top-0 bottom-0 w-3 z-10"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(200,180,120,0.9) 0%, rgba(160,210,190,0.9) 25%, rgba(210,190,140,0.9) 50%, rgba(150,200,170,0.9) 75%, rgba(200,180,120,0.9) 100%)",
                    }}
                  />

                  {/* Large watermark 100 */}
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[36px] font-black text-[#5D3A1A]/10 select-none z-10">
                    100
                  </div>

                  {/* Balance */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <p className="text-lg font-black tracking-tighter text-[#2D1500] drop-shadow-sm">
                      ${cash.toLocaleString()}
                    </p>
                    <p className="text-[6px] font-bold text-[#3D2000]/70 uppercase tracking-widest">
                      Cash
                    </p>
                  </div>

                  {/* Bottom text */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between z-10">
                    <span className="text-[5px] font-bold text-[#3D2000]/50">
                      ONE HUNDRED DOLLARS
                    </span>
                    <span className="text-[5px] font-bold text-[#3D2000]/50">
                      CENT DOLLARS
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pocket Money - Small Coin Pocket */}
            <div className="absolute bottom-6 left-4 right-4 h-20 bg-[#3D2B1F] rounded-xl border-t border-white/10 shadow-inner overflow-visible">
              <AnimatePresence>
                <motion.div
                  initial={{ y: 0 }}
                  animate={{ y: 0 }}
                  onClick={() =>
                    setSelected(selected === "pocket" ? null : "pocket")
                  }
                  className={`absolute inset-x-2 top-2 cursor-pointer ${selected === "pocket" ? "z-50" : "z-10"}`}
                >
                  <div
                    className={`w-full transition-all duration-300 ${selected === "pocket" ? "shadow-[0_0_12px_rgba(255,240,200,0.7)]" : "shadow-md"}`}
                    style={{ transform: "rotate(-1.5deg)" }}
                  >
                    {/* Torn top edge */}
                    <div
                      className="w-full h-2 bg-[#F5EDD8]"
                      style={{
                        clipPath:
                          "polygon(0% 100%, 2% 20%, 5% 90%, 8% 10%, 11% 80%, 14% 5%, 18% 75%, 22% 15%, 26% 85%, 30% 0%, 34% 90%, 38% 10%, 42% 80%, 46% 20%, 50% 95%, 54% 5%, 58% 85%, 62% 15%, 66% 90%, 70% 0%, 74% 80%, 78% 20%, 82% 95%, 86% 5%, 90% 75%, 94% 20%, 97% 90%, 100% 10%, 100% 100%)",
                      }}
                    />
                    <div
                      className="bg-[#F5EDD8] px-2 pb-2 rounded-b-sm"
                      style={{ fontFamily: "monospace" }}
                    >
                      <div className="text-center text-[7px] font-bold text-black/70">
                        METRO INC.
                      </div>
                      <div className="text-center text-[5px] text-black/40 mb-1">
                        1234 Maple Ave · (416) 555-0192
                      </div>
                      <div className="border-t border-dashed border-black/20 my-1" />
                      <div className="flex justify-between text-[5px] text-black/60">
                        <span>Whole Milk 2L</span>
                        <span>$3.99</span>
                      </div>
                      <div className="flex justify-between text-[5px] text-black/60">
                        <span>Sourdough</span>
                        <span>$4.49</span>
                      </div>
                      <div className="flex justify-between text-[5px] text-black/60">
                        <span>Free Range Eggs</span>
                        <span>$5.79</span>
                      </div>
                      <div className="border-t border-dashed border-black/20 my-1" />
                      <div className="flex justify-between text-[6px] font-bold text-black/80">
                        <span>TOTAL</span>
                        <span>${pocketMoney.toLocaleString()}</span>
                      </div>
                      <div className="text-center text-[4px] text-black/30 mt-1">
                        THANK YOU FOR SHOPPING!
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              {/* Pocket Flap */}
              <div className="absolute inset-x-0 top-0 h-4 bg-[#4A3728] rounded-t-xl border-b border-black/20 z-20"></div>
            </div>
          </div>

          {/* Right Side of Bifold */}
          <div className="w-1/2 h-full relative bg-gradient-to-bl from-[#5A4738] to-[#4A3728]">
            {/* Card Pockets */}
            <div className="absolute top-4 left-4 right-4 h-24 bg-[#3D2B1F] rounded-t-xl border-t border-white/10 shadow-inner"></div>
            <div className="absolute top-12 left-4 right-4 h-24 bg-[#3D2B1F] rounded-t-xl border-t border-white/10 shadow-inner"></div>

            {/* Visa Card */}
            <AnimatePresence>
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: 0 }}
                onClick={() => setSelected(selected === "visa" ? null : "visa")}
                className={`absolute top-16 left-3 right-3 cursor-pointer ${selected === "visa" ? "z-50" : "z-10"}`}
              >
                <div
                  className={`w-full h-24 bg-white rounded-lg border border-black/5 p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${selected === "visa" ? "shadow-[0_0_16px_rgba(255,255,255,0.5)]" : "shadow-xl"}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black italic text-blue-800">
                      VISA
                    </span>
                    <div className="w-6 h-5 bg-yellow-200/50 rounded-sm border border-black/10"></div>
                  </div>
                  <div>
                    <p className="text-[6px] font-mono text-black/40">
                      **** **** **** 8888
                    </p>
                    <p className="text-xs font-bold text-black/80">
                      ${online.toLocaleString()}
                    </p>
                  </div>
                  <div className="absolute bottom-2 right-2 flex -space-x-1">
                    <div className="w-4 h-4 rounded-full bg-red-500/80"></div>
                    <div className="w-4 h-4 rounded-full bg-yellow-500/80"></div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* RBC Card */}
            <AnimatePresence>
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: 0 }}
                onClick={() => setSelected(selected === "rbc" ? null : "rbc")}
                className={`absolute top-8 left-3 right-3 cursor-pointer ${selected === "rbc" ? "z-50" : "z-20"}`}
              >
                <div
                  className={`w-full h-24 bg-gradient-to-br from-[#005DAA] via-[#003DA5] to-[#001B6A] rounded-lg border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${selected === "rbc" ? "shadow-[0_0_20px_rgba(0,93,170,0.9)]" : "shadow-2xl"}`}
                >
                  {/* RBC Wavy Pattern */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <path
                        d="M0 50 Q 25 25, 50 50 T 100 50"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <path
                        d="M0 60 Q 25 35, 50 60 T 100 60"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <path
                        d="M0 40 Q 25 15, 50 40 T 100 40"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 bg-yellow-400 rounded-sm flex items-center justify-center">
                        <span className="text-[8px] font-black text-[#003DA5]">
                          RBC
                        </span>
                      </div>
                      <span className="text-[6px] font-bold text-white tracking-tighter">
                        Royal Bank
                      </span>
                    </div>
                    <CreditCard size={12} className="text-white/40" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[6px] font-mono text-white/40">
                      **** **** **** 4242
                    </p>
                    <p className="text-xs font-bold text-white">
                      ${online.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-[6px] font-bold text-white/60 relative z-10">
                    G RAYMOND
                  </div>
                  {/* Chip */}
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 w-6 h-5 bg-yellow-200/30 rounded-sm border border-white/10"></div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Cyber Coin - Bottom Right Pocket */}
            <div className="absolute bottom-4 left-4 right-4 h-16 bg-[#3D2B1F] rounded-2xl border-t border-white/10 shadow-inner flex items-center justify-center overflow-visible">
              <AnimatePresence>
                <motion.div
                  animate={{ y: 0, scale: 1 }}
                  onClick={() =>
                    setSelected(selected === "online" ? null : "online")
                  }
                  className={`relative w-20 h-20 cursor-pointer ${selected === "online" ? "z-50" : "z-10"}`}
                >
                  <div
                    className={`absolute inset-0 rounded-full bg-cyan-400/10 backdrop-blur-xl border-2 border-cyan-400/60 flex items-center justify-center overflow-hidden transition-all duration-300 ${selected === "online" ? "shadow-[0_0_30px_rgba(34,211,238,0.8)]" : "shadow-[0_0_20px_rgba(34,211,238,0.4)]"}`}
                  >
                    <div className="absolute inset-1 rounded-full border border-cyan-400/40 animate-[spin_10s_linear_infinite]"></div>
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="text-[8px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">
                        ${online.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Stitching Detail */}
          <div className="absolute inset-0 border-[6px] border-dashed border-black/30 rounded-[32px] pointer-events-none m-1"></div>

          {/* Center Fold Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-black/40 -translate-x-1/2 blur-[1px]"></div>
        </div>
      </div>

      {/* Total Tag */}
      <div className="bg-black text-white px-8 py-4 rounded-3xl shadow-2xl flex justify-between items-center mx-auto max-w-xs border border-white/10">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
          Total Assets
        </span>
        <span className="text-2xl font-black tracking-tighter">
          ${total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function ExpenseForm({
  categories,
  primaryCurrency,
  exchangeRates,
  hasCash,
  hasDigital,
  hasOther,
  cards,
  onSubmit,
  onSubmitIncome,
  onCancel,
}: {
  categories: string[];
  primaryCurrency: Currency;
  exchangeRates: Record<string, number>;
  hasCash: boolean;
  hasDigital: boolean;
  hasOther: boolean;
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
    : (cards[0]?.id ?? (hasDigital ? "digital" : "other"));
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
    ...(hasDigital ? [{ id: "digital", label: "Digital" }] : []),
    ...(hasOther ? [{ id: "other", label: "Other" }] : []),
  ];

  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {type === "expense" ? "Add Expense" : "Add Income"}
            </h2>
            <button
              type="button"
              onClick={() => setType(type === "expense" ? "income" : "expense")}
              className="text-sm text-black/40 hover:text-black/60 transition-colors"
            >
              {type === "expense" ? "Add Income ↓" : "Add Expense ↓"}
            </button>
          </div>
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
              Pay with
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
  onSubmit,
  onCancel,
}: {
  onSubmit: (expense: Omit<FixedExpense, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
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
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMethod("Cash")}
            className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${method === "Cash" ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5"}`}
          >
            Cash
          </button>
          <button
            type="button"
            onClick={() => setMethod("PocketMoney")}
            className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${method === "PocketMoney" ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5"}`}
          >
            Pocket
          </button>
          <button
            type="button"
            onClick={() => setMethod("Online")}
            className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${method === "Online" ? "bg-slate-400 text-white border-slate-400" : "bg-white text-black/60 border-black/5"}`}
          >
            Online
          </button>
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
  hasDigital,
  hasOther,
  cards,
  onSubmit,
  onCancel,
}: {
  primaryCurrency: Currency;
  exchangeRates: Record<string, number>;
  hasCash: boolean;
  hasDigital: boolean;
  hasOther: boolean;
  cards: Card[];
  onSubmit: (expense: Omit<InputExpense, "id" | "date">) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(primaryCurrency);
  const [note, setNote] = useState("");

  const defaultMethod = hasCash
    ? "cash"
    : (cards[0]?.id ?? (hasDigital ? "digital" : "other"));
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
    ...(hasDigital ? [{ id: "digital", label: "Digital" }] : []),
    ...(hasOther ? [{ id: "other", label: "Other" }] : []),
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
