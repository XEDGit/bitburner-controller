const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);
let handles = [];
let totThreadsAttackers = 0;

class BatchBalancer {
    constructor(totThreads) {
        this.totalBatches = 0;
        this.totalThreads = totThreads;
        this.totRequiredThreads = 0;
        this.size = 0;
    }

    getAvgThreads() {
        if (!this.size)
            return 0;
        return this.totRequiredThreads / this.size;
    }

    getAvgBatches() {
        if (!this.size)
            return 0;
        return this.totalBatches / this.size;
    }

    getIdealBatches() {
        if (!this.size || !this.totalThreads)
            return 0;
        return (this.totalThreads / this.getAvgThreads()) / this.size;
    }
}

class Target {
    /** @param {NS} ns */
    constructor(ns, name, moneyDiv) {
        this.ns = ns;
        this.name = name;
        this.moneyDiv = moneyDiv;
        this.batchTimer = 1000;
        this.logInfo = "";
        this.runningBatches = 0;
        this.wait = 1;
        this.wkTime = 0;
        this.gwTime = 0;
        this.hkTime = 0;
        this.pause = 300;
        this.exeTimes = [0, 0, 0, 0];
        this.exeThreads = [0, 0, 0, 0];
        this.exeTotThreads = 0;
    }

    moneySteal() {
        let ret = this.ns.getServerMaxMoney(this.name) * this.moneyDiv;
        return ret;
    }

    calcWeakThreads(secDiff) {
        return Math.floor(secDiff / 0.05);
    }

    calcGrowThreads(growth) {
        let server = this.ns.getServer(this.name);
        server.moneyAvailable = server.moneyMax - growth;
        return this.ns.formulas.hacking.growThreads(server, this.ns.getPlayer(), server.moneyMax);
    }

    calcHackThreads(amount) {
        let ret = Math.floor(this.ns.hackAnalyzeThreads(this.name, amount));
        if (ret == -1)
            return 0;
        return ret;
    }

    calcTimes() {
        this.wkTime = this.ns.getWeakenTime(this.name);
        this.gwTime = this.ns.getGrowTime(this.name);
        this.hkTime = this.ns.getHackTime(this.name);
        this.exeTimes[0] = 0;
        this.exeTimes[1] = this.pause * 2;
        this.exeTimes[2] = this.wkTime + this.pause - this.gwTime;
        this.exeTimes[3] = this.wkTime - this.pause - this.hkTime;
    }

    calcThreads() {
        this.exeThreads[3] = this.calcHackThreads(this.moneySteal());
        this.exeThreads[0] = this.calcWeakThreads(this.exeThreads[3] * 0.002);
        this.exeThreads[2] = this.calcGrowThreads(this.moneySteal());
        this.exeThreads[1] = this.calcWeakThreads(this.exeThreads[2] * 0.004);
        this.exeTotThreads = this.exeThreads.reduce((a, c) => {return a + c;})
    }

    calcAll() {
        this.calcThreads();
        this.calcTimes();
    }

    attack(attackers, threads, type) {
        let z = 0;
        while (threads) {
            for (let i = 0; i < attackers.length; i++) {
                let attacker = attackers[i];
                if (!threads)
                    return;
                let avThreads = freeThreadCount(this.ns, attacker, type == 2 ? 1.7 : 1.75);
                if (!avThreads)
                    continue;
                if (avThreads > threads) {
                    avThreads = threads;
                    i--;
                }
                if (!this.ns.exec(binList[type], attacker, avThreads, this.name))
                    continue;
                threads -= avThreads;
            }
            if (z++ == 10) {
                this.ns.toast("Error syncing botnet, restarting with lower settings");
                this.ns.closeTail();
                if (this.moneyDiv > 0.2)
                    this.moneyDiv = this.moneyDiv - 0.05;
                handles.forEach(clearTimeout);
                z = 0;
                this.ns.spawn(this.ns.getScriptName(), 1, this.moneyDiv);
                this.ns.exit();
            }
        }
    }
}

/** @param {NS} ns **/
function checkServer(ns, hostname, scanned = [], sKill = true) {
    const connectedServers = ns.scan(hostname);

    for (let server of connectedServers) {
        if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server))
            continue;
        if (!scanned.includes(server)) {
            if (server == "darkweb" || (!ns.hasRootAccess(server) && tryNuke(ns, server)))
                continue;
            if (sKill) {
                for (let bin of binList)
                ns.scriptKill(bin, server);
            }
            scanned.push(server);
            checkServer(ns, server, scanned, sKill);
        }
    }
    return scanned;
}

/** @param {NS} ns **/
function freeThreadCount(ns, hostname, scriptRam) {
    let threads = 0;
    const free_ram = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)
    threads = free_ram / scriptRam
    return Math.floor(threads)
}

/** @param {NS} ns **/
function tryNuke(ns, server) {
    ns.print("trying to nuke " + server);
    try {
        ns.brutessh(server)
        ns.ftpcrack(server)
        ns.relaysmtp(server)
        ns.httpworm(server)
        ns.sqlinject(server)
    } catch { }

    try {
        ns.nuke(server)
        ns.print("nuke success");
        return false;
    } catch {
        ns.print("nuke fail");
        return true;
    }
}

function updateValues(target, balancer) {
    totThreadsAttackers += target.exeTotThreads;
    target.runningBatches--;
    balancer.totalBatches--;
}

/** @param {NS} ns **/
function launchBatch(ns, targets, attackers, balancer, player) {
    for (let target of targets) {
        if (target.wait && target.wait < Date.now()) {
            balancer.size++;
            balancer.totRequiredThreads += target.exeTotThreads;
            target.wait = 0;
            target.calcAll();
        }
        if (!target.wait && balancer.getIdealBatches() > target.runningBatches && totThreadsAttackers > target.exeTotThreads) {
            handles.push(setTimeout(updateValues.bind(this, target, balancer), target.wkTime + (target.pause * 3)));
            handles.push(setTimeout(target.attack.bind(target), target.exeTimes[0], attackers, target.exeThreads[0], 0));
            handles.push(setTimeout(target.attack.bind(target), target.exeTimes[1], attackers, target.exeThreads[1], 0));
            handles.push(setTimeout(target.attack.bind(target), target.exeTimes[2], attackers, target.exeThreads[2], 1));
            handles.push(setTimeout(target.attack.bind(target), target.exeTimes[3], attackers, target.exeThreads[3], 2));
            totThreadsAttackers -= target.exeTotThreads;
            target.runningBatches++;
            balancer.totalBatches++;
        }
    }
    if (player.skills.hacking < ns.getPlayer().skills.hacking) {
        balancer.totRequiredThreads = 0;
        targets.forEach((target) => {target.calcAll(); balancer.totRequiredThreads += target.exeTotThreads;});
        player = ns.getPlayer();
    }
    handles.push(setTimeout(launchBatch, targets[0].batchTimer, ns, targets, attackers, balancer, player));
}

/** @param {NS} ns **/
function logger(ns, targets, balancer, start = Date.now()) {
    const shortTime = (s) => {
        return s.split(" ").map((s, idx) => {
            let odd = idx % 2;
            s = s.slice(0, 2 - odd);
            if (odd)
                s = s.concat(" ");
            return s;
        }).join("");
    };
    ns.clearLog();
    let logs = ["_____________________________________________________"];
    targets.forEach((target) => {
        if (target.wait - Date.now() < 0)
            logs.push(ns.sprintf("%-7s | %-3s | %-3s | %3s/%-3s | %4s/%-4s | %s", target.name.slice(0, 7), ns.formatNumber(target.exeThreads.reduce((acc, curr) => {return acc + curr;}), 0), ns.formatNumber(target.runningBatches, 0), ns.formatNumber(ns.getServerSecurityLevel(target.name), 0), ns.formatNumber(ns.getServerMinSecurityLevel(target.name), 0), ns.formatNumber(ns.getServerMoneyAvailable(target.name), 0), ns.formatNumber(ns.getServerMaxMoney(target.name), 0), shortTime(ns.tFormat(target.wkTime + (target.pause * 3)))));
        else
            logs.unshift(ns.sprintf("%-7s | asleep: %s", target.name.slice(0, 7), shortTime(ns.tFormat(target.wait - Date.now()))));
    });
    let offset = 1;
    logs.forEach((log, idx, a) => {
        if (log[0] != '_')
            ns.printf("[%-2d] %s",a.length - idx - offset, log);
        else {
            ns.print(log);
            offset = 0;
        }
    });
    ns.printf("[  ]  %-7s| Thr | Bat | Sec/Min | Money/Max | Time", "Target");
    ns.print("_____________________________________________________")
    debugger;
    ns.printf("Avg/Bal: %2d/%-2d | Targets: %2d/%-2d | Batches: %d", Math.floor(balancer.getAvgBatches()), Math.floor(balancer.getIdealBatches()), balancer.size, targets.length, balancer.totalBatches);
    ns.printf("Free: %-8s | Active time: %s", ns.formatNumber(totThreadsAttackers, 0), shortTime(ns.tFormat(Date.now() - start)));
    handles.push(setTimeout(logger.bind(balancer), 100, ns, targets, balancer, start));
}

function initTarget(ns, target, attackers, balancer) {
    target.calcAll();
    const moneyDiff = ns.getServerMaxMoney(target.name) - ns.getServerMoneyAvailable(target.name);
    if (moneyDiff) {
        target.wait = Date.now() + ns.getWeakenTime(target.name) + target.pause;
        let threads = target.calcGrowThreads(moneyDiff);
        target.attack(attackers, Math.floor(threads * 0.004) ? Math.floor(threads * 0.004) : 1, 0);
        target.attack(attackers, threads ? threads : 1, 1);
    }
    const secDiff = ns.getServerSecurityLevel(target.name) - ns.getServerMinSecurityLevel(target.name);
    if (secDiff) {
        target.wait = Date.now() + ns.getWeakenTime(target.name) + target.pause;
        let threads = target.calcWeakThreads(secDiff);
        target.attack(attackers, threads ? threads : 1, 0);
    }
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    totThreadsAttackers = 0;
    ns.atExit(() => handles.forEach(clearTimeout));
    ns.clearLog();
    ns.tail();
    let x = innerWidth - 550;
    let y = 0;
    ns.moveTail(x, y);
    ns.resizeTail(innerWidth - x, innerHeight - y);
    let serverName = ns.getServer().hostname;
    let attackers = checkServer(ns, serverName);
    let targets = [];
    let player = ns.getPlayer();
    let moneyDiv = 0.6;
    if (ns.args.length >= 1)
        moneyDiv = parseFloat(ns.args[0]);
    for (let i in actionList)
        ns.write(binList[i], "\
        /** @param {NS} ns **/\n\
        export async function main(ns) {\n\
            let target = ns.args[0];\n\
            await ns." + actionList[i] + "(target, {stock:true})\n\
        }\n", "w");
    for (let server of attackers) {
        ns.scp(binList, server);
        if (ns.getServerMaxMoney(server))
            targets.push(new Target(ns, server, moneyDiv));
        totThreadsAttackers += freeThreadCount(ns, server, 1.75);
    }
    targets = targets.sort((a, b) => {return (ns.getServerMaxMoney(b.name) / ns.getServerMinSecurityLevel(b.name)) - (ns.getServerMaxMoney(a.name) / ns.getServerMinSecurityLevel(a.name))});
    totThreadsAttackers = Math.floor(totThreadsAttackers * 0.95);
    let balancer = new BatchBalancer(totThreadsAttackers);
    for (let target of targets) {
        initTarget(ns, target, attackers, balancer);
    }
    logger(ns, targets, balancer);
    launchBatch(ns, targets, attackers, balancer, player);
    while (true) {
        await ns.asleep(30000);
        let newAttackers = checkServer(ns, serverName, [], false);
        if (newAttackers.length > attackers.length) {
            ns.print("Refreshing servers...");
            newAttackers.filter((server) => {return !targets.includes(server)}).forEach((server) => {
                ns.scp(binList, server);
                attackers.push(server);
                if (ns.getServerMaxMoney(server)) {
                    let target = new Target(ns, server, moneyDiv);
                    targets.push(target);
                    initTarget(ns, target, attackers, balancer);
                    totThreadsAttackers += target.exeTotThreads;
                    balancer.totRequiredThreads += target.exeTotThreads;
                }
            });
            targets = targets.sort((a, b) => {return (ns.getServerMaxMoney(b.name) / ns.getServerMinSecurityLevel(b.name)) - (ns.getServerMaxMoney(a.name) / ns.getServerMinSecurityLevel(a.name))});
        }
        if (handles.length >= 10000) {
            handles = handles.slice(-10000);
        }
    }
}
