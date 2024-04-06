function average(s, history, len) {
    let avg = 0;
    for (let i = 0; i < len; i++) {
        avg += history[i][s];
    }
    return avg /= len;
}

const Pos = {
    NUM_LONG: 0,
    PRICE_LONG: 1,
    NUM_SHORT: 2,
    PRICE_SHORT: 3,
};

function minStockPurchasable(ns, s, posType, avMoneyDivisor) {
    let num = ns.stock.getMaxShares(s);
    while (num && ns.stock.getPurchaseCost(s, num, posType) > ns.getPlayer().money * avMoneyDivisor) {
        num = Math.floor((num - 1) * 0.9);
    }
    return num;
}

function getGain(ns, stocks, s) {
    return ns.stock.getSaleGain(s, stocks[s][Pos.NUM_LONG], "Long") - (stocks[s][Pos.PRICE_LONG] * stocks[s][Pos.NUM_LONG]);
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();
    ns.moveTail(800, 355);
    ns.resizeTail(270, 450);
    let stocks = new Set(ns.stock.getSymbols().filter((n) => (n)));
    for (let s of stocks) {
        stocks[s] = ns.stock.getPosition(s);
    }
    let history = [];
    let orders = [];
    let start = Date.now();
    let revenue = 0;
    const maxLen = 5;
    while (true) {
        let forecasts = new Set();
        for (let s in stocks) {
            forecasts.add(s);
            forecasts[s] = ns.stock.getForecast(s);
        }
        history.unshift(forecasts);
        if (history.length > maxLen) {
            delete history[maxLen];
            history.pop();
        } else {
            ns.clearLog();
            ns.print("Collecting history... ", history.length, "/", maxLen);
            await ns.stock.nextUpdate();
            continue;
        }
        let output = [];
        for (let s in stocks) {
            let avg = average(s, history, maxLen);
            if (stocks[s][Pos.NUM_LONG] && avg < 0.57) {
                let gain = getGain(ns, stocks, s);
                revenue += gain;
                orders.push("- Long " + s + ": " + ns.formatNumber(gain));
                ns.stock.sellStock(s, stocks[s][Pos.NUM_LONG]);
                // let num = minStockPurchasable(ns, s, "Short", stocks.length);
                // ns.print("Opening short on ", s, ", price: ", ns.formatNumber(ns.stock.getPurchaseCost(s, num, "Short")));
                // ns.stock.buyShort(s, num);
            // } else if (stocks[s][Pos.NUM_SHORT] > 0 && avg > 0.5) {
            //     ns.print("Closing short on ", s, ", gain: ", ns.formatNumber(ns.stock.getSaleGain(s, stocks[s][Pos.NUM_SHORT], "Short") - stocks[s][Pos.PRICE_SHORT]));
            //     ns.stock.sellShort(s, stocks[s][Pos.NUM_SHORT]);
            //     let num = minStockPurchasable(ns, s, "Long", stocks.length);
            //     ns.print("Opening long on ", s, ", price: ", ns.formatNumber(ns.stock.getPurchaseCost(s, num, "Long")));
            //     ns.stock.buyStock(s, num);
            } else if (!stocks[s][Pos.NUM_LONG] && !stocks[s][Pos.NUM_SHORT]) {
                if (avg >= 0.60) {
                    let num = minStockPurchasable(ns, s, "Long", 1);
                    orders.push("+ Long " + s + ": " + ns.formatNumber(ns.stock.getPurchaseCost(s, num, "Long")));
                    ns.stock.buyStock(s, num);
                }
                //  else if (avg < 0.2) {
                //     let num = minStockPurchasable(ns, s, "Short", stocks.length);
                //     ns.print("Opening short on ", s, ", price: ", ns.formatNumber(ns.stock.getPurchaseCost(s, num, "Short")));
                //     ns.stock.buyShort(s, num);
                // }
            }
            stocks[s] = ns.stock.getPosition(s);
            if (stocks[s][Pos.NUM_LONG]) {
                output.push(["%4s: %s%% G/L: %s", s, (avg * 100).toFixed(1), ns.formatNumber(getGain(ns, stocks, s))]);
            }
        }
        if (orders.length > 10) {
            orders = orders.slice(orders.length - 10);
        }
        ns.clearLog();
        for (let s of orders) {
            ns.print(s);
        }
        ns.print("__________________________");
        for (let s of output) {
            ns.printf(...s);
        }
        ns.print("__________________________");
        ns.print("Total G/L: ", ns.formatNumber(revenue))
        ns.print("Active time: ", ns.tFormat(Date.now() - start))
        await ns.stock.nextUpdate();
    }
}