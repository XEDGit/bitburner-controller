class Session {
    /** @param {NS} ns **/
    constructor(ns) {
        this.z = 0;
        this.i = 0;
        this.tot_threads = 0;
        this.bin_list = ["w.js", "g.js", "h.js"];
        this.timefun_list = [ns.getWeakenTime, ns.getGrowTime, ns.getHackTime];
        this.action_list = ["weaken", "grow", "hack"];
        this.writeFiles(ns);
        this.servers = new Set();
        this.refreshServers(ns);
        this.initAttackers(ns);
        this.nextTarget(ns);
    }

    /** @param {NS} ns **/
    initAttackers(ns) {
        this.writeFiles(ns);
        for (let server of this.servers) {
            for (let bin of this.bin_list) {
                ns.scp(bin, server, "home");
            }
        }
    }

    /** @param {NS} ns **/
    writeFiles(ns) {
        for (let cmd of this.action_list) {
            ns.write(cmd[0].toString() + ".js", "\
            /** @param {NS} ns **/\n\
            export async function main(ns) {\n\
                let target = ns.args[0];\n\
                await ns." + cmd + "(target)\n\
            }\n", "w");
        }
    }

    getPriority() {
        if (this.servers[this.target][0]) {
            return 0;
        } else if ((this.servers[this.target][1])) {
            return 1;
        } else if (this.servers[this.target][2]) {
            return 2;
        }
        return -1;
    }

    /** @param {NS} ns **/
    printLog(ns) {
        let i = this.getPriority();
        switch (i) {
            case 0:
                ns.print("Weak " + (ns.getServerSecurityLevel(this.target) - ns.getServerMinSecurityLevel(this.target)).toFixed(0) + " on " + this.target + ", " + this.servers[this.target][0] + " threads");
            break;
            case 1:
                ns.print("Grow " + ns.formatNumber(ns.getServerMaxMoney(this.target) - ns.getServerMoneyAvailable(this.target)) + "$ on " + this.target + ", " + this.servers[this.target][1] + " threads");
            break;
            case 2:
                ns.print("Hack " + ns.formatNumber((ns.getServerMaxMoney(this.target) / 5)) + "$ off " + this.target + ", " + this.servers[this.target][2] + " threads");
            break;
            default:
                return;
        }
    }

    /** @param {NS} ns **/
    act(ns, action, server) {
        if (this.available_threads > this.servers[this.target][action]) {
            this.available_threads = this.servers[this.target][action];
            this.i--;
        }
        ns.exec(this.bin_list[action], server, this.available_threads, this.target);
        this.servers[this.target][action] -= this.available_threads;
        if (!this.servers[this.target][action]) {
            this.nextTarget(ns);
        }
    }

    /** @param {NS} ns **/
    nextTarget(ns) {
        this.z++;
        if (this.z == this.arr_servers.length) {
            this.z = 0;
        }
        this.target = this.arr_servers[this.z];
        if (!this.target || !ns.getServerMaxMoney(this.target)) {
            this.nextTarget(ns);
            return;
        }
        this.printLog(ns);
    }

    /** @param {NS} ns **/
    refreshServers(ns) {
        ns.print("refreshing servers...");
        this.servers = checkServer(ns, "home", this.servers);
        this.arr_servers = Array.from(this.servers.keys());
        this.skip = 0;
    }

    /** @param {NS} ns **/
    calcGrowthThreads(ns) {
        let maxMoney = ns.getServerMaxMoney(this.target);
        let avMoney = ns.getServerMoneyAvailable(this.target);
        if (avMoney == maxMoney) {
            return 0;
        }
        let growth = maxMoney / avMoney;
        growth = Math.floor(ns.growthAnalyze(this.target, growth));
        return growth;
    }

    calcWeakenThreads(ns) {
        const securityDiff = ns.getServerSecurityLevel(this.target) - ns.getServerMinSecurityLevel(this.target);
        return Math.floor(securityDiff / 0.05);
    }

    /** @param {NS} ns **/
    calcThreads(ns) {
        this.servers[this.target][0] = this.calcWeakenThreads(ns);
        this.servers[this.target][1] = this.calcGrowthThreads(ns);
        this.servers[this.target][2] = Math.floor(ns.hackAnalyzeThreads(this.target, ns.getServerMaxMoney(this.target) / 5));
        if (this.servers[this.target][2] < 0) {
            this.servers[this.target][2] = 0;
        }
        ns.print("Calculated " + this.target);
    }
}

/** @param {NS} ns **/
function checkServer(ns, hostname, host_connected_servers, scanned = []) {
    const connected_servers = ns.scan(hostname);

    for (let server of connected_servers) {
        if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server)) {
            continue;
        }
        if (!host_connected_servers.has(server)) {
            if (server == "darkweb" || (!ns.hasRootAccess(server) && tryNuke(ns, server))) {
                continue;
            }
            host_connected_servers.add(server);
            host_connected_servers[server] = [0, 0, 0];
        }
        if (!scanned.includes(server)) {
            scanned.push(server);
            checkServer(ns, server, host_connected_servers, scanned);
        }
    }
    return host_connected_servers;
}

/** @param {NS} ns **/
function threadCount(ns, hostname, scriptRam) {
    let threads = 0;
    const free_ram = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)
    threads = free_ram / scriptRam
    return Math.floor(threads)
}

function calcTime(time) {
    let tot = time / 1000 / 60;
    let fract = tot - Math.floor(tot);
    fract /= 100;
    fract *= 60;

    return (Math.floor(tot) + fract).toFixed(2);
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

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();
    ns.resizeTail(450, 400);
    ns.moveTail(innerWidth - 450, 450);
    let s = new Session(ns);

    while (true) {
        s.tot_threads = 0;
        for (let server of s.arr_servers) {
            s.tot_threads += threadCount(ns, server, 1.75);
        }
        if (!s.tot_threads) {
            await ns.asleep(3000);
            continue;
        }
        let remaining_threads = s.tot_threads;
        for (s.i = 0; s.i < s.arr_servers.length; s.i++) {
            const server = s.arr_servers[s.i];
            s.available_threads = threadCount(ns, server, 1.75);
            if (!s.available_threads) {
                continue;
            }
            let i = s.getPriority(ns);
            // if (i == 1 && s.servers[s.target][1] > remaining_threads) {
            //     s.servers[s.target][1] = remaining_threads;
            //     s.servers[s.target][2] = 0;
            // }
            remaining_threads -= s.servers[s.target];
            if (i >= 0) {
                s.act(ns, i, server);
            } else {
                s.calcThreads(ns);
            }
        }
        if (s.skip++ == 50) {
            s.refreshServers(ns);
        }
        await ns.sleep(200);
    }
}
