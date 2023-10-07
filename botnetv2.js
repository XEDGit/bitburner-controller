const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);
let handles = [];
let totThreadsAttackers = 0;

class BatchBalancer {
    constructor() {
        this.total = 0;
        this.size = 0;
    }

    getAvgBatches() {
        return this.total / this.size;
    }
}

class Target {
    /** @param {NS} ns */
    constructor(ns, name, moneyDiv, batchTimer) {
        this.ns = ns;
        this.name = name;
        this.moneyDiv = moneyDiv;
        this.batchTimer = batchTimer;
        this.logInfo = "";
        this.runningBatches = 0;
        this.wait = 0;
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
                if (this.batchTimer < 3000)
                    this.batchTimer += 100;
                else if (this.moneyDiv > 0.2)
                    this.moneyDiv -= 0.1;
                else if (this.batchTimer < 10000)
                    this.batchTimer += 500;
                handles.forEach(clearTimeout);
                z = 0;
                this.ns.spawn(this.ns.getScriptName(), 1, this.moneyDiv, this.batchTimer);
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
    balancer.total--;
}

/** @param {NS} ns **/
async function launchBatch(ns, target, attackers, balancer) {
    if (target.wait < Date.now() && balancer.getAvgBatches() + 2 >= target.runningBatches) {
        if (target.wait)
        {
            balancer.size++;
            target.wait = 0;
        }
    }
    if (balancer.getAvgBatches() + 2 >= target.runningBatches && totThreadsAttackers > target.exeTotThreads && target.wait < Date.now()) {
        handles.push(setTimeout(updateValues.bind(this, target, balancer), target.wkTime + (target.pause * 3)));
        handles.push(setTimeout(target.attack.bind(target), target.exeTimes[0], attackers, target.exeThreads[0], 0));
        handles.push(setTimeout(target.attack.bind(target), target.exeTimes[1], attackers, target.exeThreads[1], 0));
        handles.push(setTimeout(target.attack.bind(target), target.exeTimes[2], attackers, target.exeThreads[2], 1));
        handles.push(setTimeout(target.attack.bind(target), target.exeTimes[3], attackers, target.exeThreads[3], 2));
        totThreadsAttackers -= target.exeTotThreads;
        target.runningBatches++;
        balancer.total++;
    }
    handles.push(setTimeout(launchBatch, target.batchTimer, ns, target, attackers, balancer));
}

/** @param {NS} ns **/
function starter(ns, target, attackers, balancer) {
    target.calcAll();
    handles.push(setTimeout(launchBatch, 0, ns, target, attackers, balancer));
}

/** @param {NS} ns **/
function logger(ns, targets, batchTimer, balancer, start = Date.now()) {
    ns.clearLog();
    let logs = [];
    ns.print("balance: ", Math.floor(balancer.getAvgBatches()), ", attackers: ", balancer.size, " batches: ", balancer.total);
    ns.printf("Free threads: %-5s Active time: %s", ns.formatNumber(totThreadsAttackers, 0), ns.tFormat(Date.now() - start));
    ns.print("__________________________________________________")
    ns.printf(" %-17s| Threads | Batches | Time", "Name");
    targets.forEach((target) => {
        if (target.wait - Date.now() < 0)
            logs.unshift(ns.sprintf("%-17s | %-7s | %-7s | %s", target.name, ns.formatNumber(target.exeThreads.reduce((acc, curr) => {return acc + curr;}), 0), ns.formatNumber(target.runningBatches, 0), ns.tFormat(target.wkTime + (target.pause * 3)).split(" ").map((s, idx) => {return s.slice(0, idx % 2? 1 : 2)}).join(" ")));
        else
            logs.push(ns.sprintf("%-17s | asleep: %s", target.name, ns.tFormat(target.wait - Date.now())));
    });
    logs.forEach((log, idx) => {ns.printf("[%-2d] %s",idx, log)});
    handles.push(setTimeout(logger.bind(balancer), 1000, ns, targets, batchTimer, balancer, start));
}

function initTarget(ns, target, attackers, balancer) {
    const moneyDiff = ns.getServerMaxMoney(target.name) - ns.getServerMoneyAvailable(target.name);
    if (moneyDiff) {
        let threads = target.calcGrowThreads(moneyDiff);
        target.attack(attackers, Math.floor(threads * 0.004) ? Math.floor(threads * 0.004) : 1, 0);
        target.attack(attackers, threads ? threads : 1, 1);
        target.wait = Date.now() + ns.getWeakenTime(target.name) + target.pause;
    }
    const secDiff = ns.getServerSecurityLevel(target.name) - ns.getServerMinSecurityLevel(target.name);
    if (secDiff) {
        target.wait = 0;
        let threads = target.calcWeakThreads(secDiff);
        target.attack(attackers, threads ? threads : 1, 0);
        target.wait = Date.now() + ns.getWeakenTime(target.name) + target.pause;
    }
    if (!moneyDiff && !secDiff)
        balancer.size++;
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.atExit(() => handles.forEach(clearTimeout));
    ns.clearLog();
    ns.tail();
    let x = innerWidth - 525;
    let y = 0;
    ns.moveTail(x, y);
    ns.resizeTail(innerWidth - x, innerHeight - y);
    let serverName = ns.getServer().hostname;
    let attackers = checkServer(ns, serverName);
    attackers = attackers.sort((a, b) => {return ns.getServerMaxMoney(b) != ns.getServerMaxMoney(a)});
    let targets = [];
    let player = ns.getPlayer();
    let moneyDiv = 0.6;
    let balancer = new BatchBalancer();
    if (ns.args.length >= 1)
        moneyDiv = parseFloat(ns.args[0]);
    let batchTimer = 300;
    if (ns.args.length >= 2)
        batchTimer = parseInt(ns.args[1]);
    for (let i in actionList)
        ns.write(binList[i], "\
        /** @param {NS} ns **/\n\
        export async function main(ns) {\n\
            let target = ns.args[0];\n\
            await ns." + actionList[i] + "(target)\n\
        }\n", "w");
    for (let server of attackers) {
        ns.scp(binList, server);
        if (ns.getServerMaxMoney(server))
            targets.push(new Target(ns, server, moneyDiv, batchTimer));
        totThreadsAttackers += freeThreadCount(ns, server, 1.75);
    }
    totThreadsAttackers = Math.floor(totThreadsAttackers * 0.95);
    for (let target of targets) {
        initTarget(ns, target, attackers, balancer);
        starter(ns, target, attackers, balancer);
    }
    logger(ns, targets, batchTimer, balancer);
    while (true) {
        await ns.asleep(30000);
        let newAttackers = checkServer(ns, serverName, [], false);
        if (newAttackers.length > attackers.length) {
            ns.print("Refreshing servers...");
            newAttackers.filter((server) => {return !targets.includes(server)}).forEach((server) => {
                ns.scp(binList, server);
                let target = new Target(ns, server, moneyDiv, batchTimer);
                if (ns.getServerMaxMoney(server))
                    targets.push(target);
                initTarget(ns, target, attackers, balancer);
                starter(ns, target, attackers, balancer);
            });
            attackers = attackers.sort((a, b) => {return ns.getServerMaxMoney(b) / ns.getServerMinSecurityLevel(b) != ns.getServerMaxMoney(a) / ns.getServerMinSecurityLevel(a)});
        }
        if (player.skills.hacking < ns.getPlayer().skills.hacking)
            targets.forEach((target) => target.calcAll());
        if (handles.length >= 1000) {
            handles = handles.slice(handles.length - 1000);
        }
    }
}
