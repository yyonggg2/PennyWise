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

1. Memory Leak Prevention

- Without Optimizaiton:

  ```useEffect(() => {
  fetch(`https://api.frankfurter.app/latest?from=${state.primaryCurrency}`)
    .then((r) => r.json())
    .then((data) => setState((prev) => ({ ...prev, exchangeRates: data.rates })));

  setInterval(() => {
    fetch(`https://api.frankfurter.app/latest?from=${state.primaryCurrency}`)
      .then((r) => r.json())
      .then((data) => setState((prev) => ({ ...prev, exchangeRates: data.rates })));
  }, 3600000);
  // ← no cleanup. every currency change stacks a new interval on top
  }, [state.primaryCurrency]);
  ```

````
- With Optimization:
``` \useEffect(() => {
  const fetchRates = () => {
    fetch(`https://api.frankfurter.app/latest?from=${state.primaryCurrency}`)
      .then((r) => r.json())
      .then((data) => setState((prev) => ({ ...prev, exchangeRates: data.rates })));
  };

  fetchRates();
  const interval = setInterval(fetchRates, 3600000);
  return () => clearInterval(interval); // ← kills old interval before new one starts
}, [state.primaryCurrency]);
````

2. Expensive Calculation Prevention

-

## ScreenShots

![Home Screen](frontPage.png)
![Add Income](addIncome.png)
![Add Cost](addCost.png)
![View History](viewHistory.png)
![Fixed Payments](fixExpense.png)

## License

MIT License — feel free to use and modify.
