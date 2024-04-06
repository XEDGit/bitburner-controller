function getAvMoney(ns) {
    let playerMoney = ns.getPlayer().money
    return playerMoney - 10000000
}

function upgradeCost(ns, server, ram) {
    return ns.getPurchasedServerUpgradeCost(server, ram)
}

function purchaseCost(ns, ram) {
    return ns.getPurchasedServerCost(ram)
}

function getServers(ns) {
    return ns.getPurchasedServers()
}

function getRam(ns, server) {
    return ns.getServerMaxRam(server)
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL")
    ns.tail()
    ns.resizeTail(250, 30 + (25 * 10))
    ns.moveTail(1070, 355)
    let maxServers = ns.getPurchasedServerLimit()
    let ram = 2 ** 5
    while (true) {
        ns.clearLog()
        let ownedServers = getServers(ns)
        ns.print("Owned servers: " + ownedServers.length + "/" + maxServers)
        let upgraded = []
        let minUpgrade = {cost:Number.MAX_SAFE_INTEGER, ram: 0, idx: 0}
        for (let server of ownedServers) {
            let upgradedRam = getRam(ns, server) * 2
            let upCost = upgradeCost(ns, server, upgradedRam)
            if (upCost == -1) {
                continue
            }
            if (upCost < minUpgrade.cost) {
                minUpgrade.cost = upCost
                minUpgrade.ram = upgradedRam
                minUpgrade.idx = ownedServers.indexOf(server)
            }
            if (upCost < getAvMoney(ns)) {
                ns.upgradePurchasedServer(server, upgradedRam)
            }
        }
        let purchased = []
        while (purchaseCost(ns, ram) < getAvMoney(ns) && getServers(ns).length < maxServers) {
            let name = "dioporco"
            if (ns.purchaseServer(name, ram) != "") {
                purchased.push(name)
            } else {
                ns.print("ERROR", " Failed to buy server")
                break;
            }
        }
        ns.print("For ", minUpgrade.ram, "GB RAM:")
        ns.print("Upgrade[", minUpgrade.idx,"]:  ", minUpgrade.cost != Number.MAX_SAFE_INTEGER ? ns.formatNumber(minUpgrade.cost) : "none")
        ns.print("Purchase: ", ownedServers.length != maxServers? ns.formatNumber(purchaseCost(ns, ram)) : "none")
        
        let prints = 0
        let rams = ownedServers.map((s) => {return "[" + getRam(ns, s) + "]"})
        let size = 25
        while (rams.length) {
            let str = ""
            let printed = []
            let idx = -1
            for (let r of rams) {
                idx++
                if (str.length + r.length > size)
                    continue
                str += r
                printed.push(idx)
            }
            rams = rams.filter((s, i) => {return !printed.includes(i)})
            ns.print(str)
            prints++
        }
        ns.resizeTail(250, 25 * (prints + 4 + 1))
        await ns.sleep(1000)
    }
    // ns.closeTail()
}