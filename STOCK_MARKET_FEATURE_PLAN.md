# Stock Market System - Feature Plan

## 📊 Overzicht

Een geavanceerd beurs/stock market systeem voor ComCraft Discord bot dat gebruikers in staat stelt om te investeren, handelen en geld te verdienen met een realistisch marktmechanisme.

## ✨ Features

### 1. **Stock Trading**
- ✅ Buy/Sell stocks
- ✅ Real-time price updates
- ✅ Transaction fees (configureerbaar)
- ✅ Min/max order limits
- ✅ Portfolio tracking
- ✅ Profit/Loss berekeningen

### 2. **Market Mechanics**
- ✅ Auto price fluctuation (periodieke prijswijzigingen)
- ✅ Volatility per stock
- ✅ Price history voor charts
- ✅ Min/max price bounds
- ⏳ Market events (crash, boom, IPO)
- ⏳ Dividends
- ⏳ Stock splits

### 3. **Portfolio Management**
- ✅ Holdings tracking
- ✅ Average buy price
- ✅ Current value calculation
- ✅ Total profit/loss
- ✅ Transaction history
- ⏳ Limit orders
- ⏳ Stop-loss orders

### 4. **Market Features**
- ⏳ Market leaderboard
- ⏳ Market hours (open/close)
- ⏳ Activity-based pricing (server activity affecteert prijzen)
- ⏳ Admin-controlled events
- ⏳ Market charts/graphs

## 🗄️ Database Schema

Gemaakt in `stock-market-schema.sql`:

1. **stock_market_stocks** - Alle beschikbare stocks
2. **stock_market_portfolio** - User holdings
3. **stock_market_transactions** - Transaction log
4. **stock_market_orders** - Limit/stop orders (toekomstig)
5. **stock_market_events** - Market events (toekomstig)
6. **stock_market_configs** - Configuratie per guild

## 📝 Commands (Te implementeren)

### User Commands:
- `/stocks` - Lijst van alle beschikbare stocks
- `/stock <symbol>` - Details van een specifieke stock
- `/stockbuy <symbol> <shares>` - Koop stocks
- `/stocksell <symbol> <shares>` - Verkoop stocks
- `/portfolio [@user]` - Bekijk portfolio
- `/stockhistory` - Transaction history
- `/stockleaderboard` - Rijkste portfolio's

### Admin Commands:
- `/stockcreate` - Maak nieuwe stock
- `/stockedit` - Edit stock details
- `/stockprice <symbol> <price>` - Forceer prijs (admin)
- `/stockevent` - Trigger market event
- `/stockconfig` - Configureer market settings

## 🎨 Dashboard (Te implementeren)

**Route:** `/dashboard/[guildId]/economy/stock-market`

### Tabs:
1. **Stocks Overview** - Lijst van alle stocks met prijzen
2. **Create Stock** - Admin form om nieuwe stocks te maken
3. **Market Config** - Configuratie settings
4. **Market Events** - Trigger events
5. **Price Charts** - Visuele grafieken

## 🔄 Price Update Scheduler

Een periodieke taak die stock prijzen update:
- Elke X minuten (configureerbaar, default 15 min)
- Random fluctuations binnen volatility range
- Update price history
- Process pending orders

## 💡 Toekomstige Features

### Phase 2:
- **Limit Orders** - Buy/sell at target price
- **Stop-Loss** - Auto sell bij bepaalde prijs
- **Dividends** - Periodieke uitbetalingen
- **Stock Splits** - Split shares

### Phase 3:
- **Market Events** - IPO's, crashes, booms
- **News System** - Nieuwsberichten die prijzen beïnvloeden
- **Company Stats** - Statistieken per stock (volume, etc.)
- **Market Charts** - Visuele prijsgrafieken

### Phase 4:
- **Market Hours** - Openingstijden
- **Activity-Based Pricing** - Server activity affecteert prijzen
- **Options Trading** - Advanced trading
- **Margin Trading** - Leen geld om te investeren

## 📊 Market Mechanics Details

### Price Fluctuation
- Basis: Random fluctuations binnen volatility range
- Server Activity: Message count, active users kunnen prijzen beïnvloeden
- Events: Admin-triggered events kunnen grote prijsveranderingen veroorzaken
- Supply/Demand: Trading volume kan prijzen beïnvloeden (toekomstig)

### Volatility
- Laag (1-5%): Stabiele stocks, kleine prijsveranderingen
- Medium (5-15%): Normale stocks, gemiddelde fluctuaties
- Hoog (15-50%): Risicovolle stocks, grote schommelingen

### Risk/Reward
- Hoge volatility = hoger risico, maar potentieel hogere winsten
- Lage volatility = veiliger, maar kleinere winsten

## 🚀 Implementatie Status

- [x] Database schema
- [x] Stock Market Manager (core logic)
- [ ] Discord commands
- [ ] Dashboard UI
- [ ] Price update scheduler
- [ ] Market events system
- [ ] Limit orders
- [ ] Charts/graphs

## 📝 Next Steps

1. **Commands implementeren** in `bot-comcraft.js`
2. **Dashboard pagina** maken
3. **Price update scheduler** toevoegen aan bot startup
4. **Market events** systeem bouwen
5. **Testing** en refinement

