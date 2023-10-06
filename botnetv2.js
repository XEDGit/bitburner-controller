let handles = [];
const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);


class Target {
    /** @param {NS} ns */
    constructor(ns, name, moneyDiv, batchTimer) {
        this.ns = ns;
        this.name = name;
        this.moneyDiv = moneyDiv;
        this.batchTimer = batchTimer;
        this.wait = 0;
        this.wkTime = 0;
        this.gwTime = 0;
        this.hkTime = 0;
        this.pause = 3000;
        this.exeTimes = [0, 0, 0, 0];
        this.exeThreads = [0, 0, 0, 0];
    }

    moneySteal() {
        let ret = this.ns.getServerMaxMoney(this.name) / this.moneyDiv;
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
    }

    calcAll() {
        this.calcThreads();
        this.calcTimes();
    }

    attack(attackers, threads, type) {
        if (this.wait > this.ns.getResetInfo().lastAugReset) {
            return;
        }
        let z = 0;
        debugger;
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
                this.ns.toast("Error: botnet sync requires too much RAM, restarting with lower money steal", "error");
                this.ns.closeTail();
                let div = this.moneyDiv;
                if (this.batchTimer >= 10000)
                    div += 1;
                handles.forEach(clearTimeout);
                z = 0;
                while (z++ < 10)
                    this.ns.spawn(this.ns.getScriptName(), 1, div, this.batchTimer < 10000 ? this.batchTimer + 1000 : this.batchTimer);
                throw new Error("Couldn't spawn new script");
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

function launchBatch(target, attackers) {
    target.ns.print("batch on ", target.name, " with ", target.exeThreads.reduce((acc, curr) => {return acc + curr;}), " threads");
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[0], attackers, target.exeThreads[0], 0));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[1], attackers, target.exeThreads[1], 0));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[2], attackers, target.exeThreads[2], 1));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[3], attackers, target.exeThreads[3], 2));
    handles.push(setTimeout(launchBatch, target.batchTimer, target, attackers));
}

function starter(target, attackers) {
    target.calcAll();
    handles.push(setTimeout(launchBatch, target.wait, target, attackers));
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.atExit(() => handles.forEach(clearTimeout));
    ns.clearLog();
    ns.tail();
    let x = innerWidth / 16 * 9;
    let y = innerHeight / 2 + 20;
    ns.moveTail(x, y);
    ns.resizeTail(innerWidth - x, innerHeight - y);
    let serverName = ns.getServer().hostname;
    let attackers = checkServer(ns, serverName);
    let targets = [];
    let moneyDiv = 3;
    if (ns.args.length >= 1)
        moneyDiv = parseInt(ns.args[0]);
    let batchTimer = 1000;
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
    }
    for (let target of targets) {
        const moneyDiff = ns.getServerMaxMoney(target.name) - ns.getServerMoneyAvailable(target.name);
        if (moneyDiff) {
            let threads = target.calcGrowThreads(moneyDiff);
            target.attack(attackers, Math.floor(threads * 0.004) ? Math.floor(threads * 0.004) : 1, 0);
            target.attack(attackers, threads ? threads : 1, 1);
            target.wait = ns.getResetInfo().lastAugReset + ns.getWeakenTime(target.name) + target.pause;
        }
        const secDiff = ns.getServerSecurityLevel(target.name) - ns.getServerMinSecurityLevel(target.name);
        if (secDiff) {
            target.wait = 0;
            let threads = target.calcWeakThreads(secDiff);
            target.attack(attackers, threads ? threads : 1, 0);
            target.wait = ns.getResetInfo().lastAugReset + ns.getWeakenTime(target.name) + target.pause;
        }
    }
    for (let target of targets) {
        starter(target, attackers);
    }
    while (true) {
        await ns.asleep(60000);
        let newAttackers = checkServer(ns, serverName, [], false);
        if (newAttackers.length > attackers.length) {
            ns.print("Refreshing servers...");
            newAttackers.filter(!targets.includes).forEach((server) => {
                ns.scp(binList, server);
                if (ns.getServerMaxMoney(server))
                    targets.push(new Target(ns, server, moneyDiv, batchTimer));
                starter(server, attackers);
            });
        }
        if (handles.length >= 1000) {
            handles = handles.slice(handles.length - 1000);
        }
    }
}
