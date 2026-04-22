# PennyWise

Manage your penny wise by keep in track of budget.

## Features

- Wallet interfaces
- 10 different currencies (ex. CAD, USD...)
- 3 different catergories (digital & card & cash)

## Tech Stack

- React 19 — UI framework
- TypeScript — type safety
- Vite — build tool / dev server
- Tailwind CSS v4 — styling
- Framer Motion — animations
- Supabase — authentication + database (cloud sync)
- Lucide React — icons
- Frankfurter API — live currency exgitchange rates

## Getting Started

Visit: https://penny-wise-woad.vercel.app/
Create an account or sign in with Google to get started.

## Usage

1. Sign in with Google or create an account
2. Complete the setup
3. Tap "+" to log expenses or income
4. View balances on Home screen
5. Add fixed expenses (rent, subscriptions) in the fixed tab
6. View the history in the history tab

## Optimizations

### 1. Memory Leak Prevention

** With Optimizaiton**
`return () => clearInterval(interval);`

With the `clearInterval()` method, we maked sure whenever a new interval is going to be created, we delete the previous interval, preventing the web from memory leak.

### 2. Expensive Calculation Prevention

** With Optimizaiton**
`const calculations = useMemo(() => { ... }, [state]);`
** Without **
`const calculations = (() => { ... })();`

The difference is `useMemo()` at the start and `[state]`at the end. These two additions cache the result and skip recalculation when `[state]` hasn't changed.

## ScreenShots

![Home Screen](frontPage.png)
![Add Income](addIncome.png)
![Add Cost](addCost.png)
![View History](viewHistory.png)
![Fixed Payments](fixExpense.png)

## License

MIT License — feel free to use and modify.
