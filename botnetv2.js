let handles = [];

class Target {
    /** @param {NS} ns */
    constructor(ns, name, moneyDiv) {
        this.ns = ns;
        this.name = name;
        this.moneyDiv = moneyDiv;
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
        const bin_list = ["w.js", "g.js", "h.js"];
        const timefun_list = [this.ns.getWeakenTime, this.ns.getGrowTime, this.ns.getHackTime];

        if (this.wait > this.ns.getResetInfo().lastAugReset) {
            return;
        }
        this.ns.print(bin_list[type], " on ", this.name, " with ", threads, " threads, ", this.ns.tFormat(timefun_list[type](this.name)));
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
                if (!this.ns.exec(bin_list[type], attacker, avThreads, this.name))
                    continue;
                threads -= avThreads;
            }
            if (z++ == 10) {
                this.ns.toast("Error: botnet sync requires too much RAM, restarting with lower money steal", "error");
                this.ns.closeTail();
                this.ns.spawn(this.ns.getScriptName(), 1, this.moneyDiv + 1);
            }
        }
    }
}

/** @param {NS} ns **/
function checkServer(ns, hostname, scanned = [], sKill = true) {
    const connected_servers = ns.scan(hostname);

    for (let server of connected_servers) {
        if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server))
            continue;
        if (!scanned.includes(server)) {
            if (server == "darkweb" || (!ns.hasRootAccess(server) && tryNuke(ns, server)))
                continue;
            if (sKill) {
                ns.scriptKill("w.js", server);
                ns.scriptKill("g.js", server);
                ns.scriptKill("h.js", server);
            }
            scanned.push(server);
            checkServer(ns, server, host_connected_servers, sKill, scanned);
        }
    }
    return Array.from(host_connected_servers.keys());
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
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[0], attackers, target.exeThreads[0], 0));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[1], attackers, target.exeThreads[1], 0));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[2], attackers, target.exeThreads[2], 1));
    handles.push(setTimeout(target.attack.bind(target), target.exeTimes[3], attackers, target.exeThreads[3], 2));
    handles.push(setTimeout(launchBatch.bind(target), 10000, target, attackers));
}

function starter(target, attackers) {
    target.calcAll();
    handles.push(setTimeout(launchBatch.bind(target), target.wait, target, attackers));
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.atExit(handles.forEach(clearTimeout));
    ns.clearLog();
    ns.tail();
    let x = innerWidth / 16 * 9;
    let y = innerHeight / 2 + 20;
    ns.moveTail(x, y);
    ns.resizeTail(innerWidth - x, innerHeight - y);
    let attackers = checkServer(ns, "home");
    let actionList = ["weaken", "grow", "hack"];
    let targets = [];
    let moneyDiv = 5;
    if (ns.args.length == 1)
        moneyDiv = parseInt(ns.args[0]);
    for (let server of attackers) {
        for (let cmd of actionList)
            ns.write(cmd[0].toString() + ".js", "\
            /** @param {NS} ns **/\n\
            export async function main(ns) {\n\
                let target = ns.args[0];\n\
                await ns." + cmd + "(target)\n\
            }\n", "w");
        if (ns.getServerMaxMoney(server))
            targets.push(new Target(ns, server, moneyDiv));
    }
    for (let target of targets) {
        const moneyDiff = ns.getServerMaxMoney(target.name) - ns.getServerMoneyAvailable(target.name);
        if (moneyDiff) {
            target.wait = ns.getResetInfo().lastAugReset + ns.getWeakenTime(target.name) + target.pause;
            let threads = target.calcGrowThreads(moneyDiff);
            target.attack(attackers, Math.floor(threads * 0.004) ? Math.floor(threads * 0.004) : 1, 0);
            target.attack(attackers, threads ? threads : 1, 1);
        }
        const secDiff = ns.getServerSecurityLevel(target.name) - ns.getServerMinSecurityLevel(target.name);
        if (secDiff) {
            target.wait = ns.getResetInfo().lastAugReset + ns.getWeakenTime(target.name) + target.pause;
            let threads = target.calcWeakThreads(secDiff);
            target.attack(attackers, threads ? threads : 1, 0);
        }
    }
    // let totThreadsAttackers = 0;
    // for (let attacker of attackers)
    //     totThreadsAttackers += freeThreadCount(ns, attacker, 1.75);
    // totThreadsAttackers /= targets.length;
    // for (let target of targets) {
    //     target.calcAll();
    //     let totThreadsBatch = target.exeThreads.reduce((acc, curr) => {return acc + curr;});
    //     let batchTime = ns.getWeakenTime(target.name) + (target.pause * 3);
    //     let howMany = totThreadsAttackers / totThreadsBatch;
    //     let sleepTime = howMany / ;
    // }
    for (let target of targets) {
        starter(target, attackers);
    }
    while (true) {
        await ns.asleep(60000);
        let newTargets = checkServer(ns, "home", [], false);
        if (newTargets.length > targets.length) {
            ns.print("Refreshing servers...");
            newTargets.filter(!targets.includes).forEach((val) => {attackers.push(val); starter(val, attackers)});
        }
        if (handles.length >= 1000) {
            handles = handles.slice(handles.length - 1000);
        }
    }
}
