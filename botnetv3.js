const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);
/** @type {NS} **/
let ns
let player
let bn

class Target {
    /** @param {Server} refServer */
    constructor(refServer) {
        this.s = refServer
        this.nsServer = null
        this.batches = []
        this.updateNsServer()
        this.props = this.getServerProps()
        if (this.props.ready)
            this.attack()
        else
            this.prepare()
        
    }

    attack() {
        /**@type {Batch}*/
        newBatch = new Batch(this)
        newBatch.addAttack("hack")
        newBatch.addAttack("weak")
        newBatch.addAttack("grow")
        newBatch.addAttack("weak")
        batches.push()
    }

    getServerProps() {
        let cMoney = ns.getServerMoneyAvailable(this.s.name)
        let mMoney = ns.getServerMaxMoney(this.s.name)
        let cSecurity = ns.getServerSecurityLevel(this.s.name)
        let mSecurity = ns.getServerMinSecurityLevel(this.s.name)
        let aMMoney = mMoney == cMoney
        let aMSecurity = mSecurity == cSecurity
        let ready = aMMoney && aMSecurity
        return {
            currMoney: cMoney, 
            maxMoney: mMoney,
            currSecurity: cSecurity,
            minSecurity: mSecurity,
            atMinSecurity: aMSecurity,
            atMaxMoney: aMMoney,
            ready: ready
        }
    }

    prepare() {
        ns.print("thr ", this.s.name, ": ", this.props)

        if (this.props.atMinSecurity)
            this.readyAt = new Attack(this, 'weak', 0)
        
        if (this.props.atMaxMoney)
            return;
        new Attack(this, 'grow', 0)
        new Attack(this, 'weak', 0)
    }

    calcHackThreads() {
        let ret = Math.ceil(ns.hackAnalyzeThreads(this.s.name, this.props.maxMoney - this.props.currMoney));
        if (ret == -1)
            return 0;
        return ret;
    }

    calcWeakThreads() {
        return Math.ceil((this.props.currSecurity - this.props.minSecurity) / 0.05);
    }

    calcGrowThreads() {
        return ns.formulas.hacking.growThreads(this.nsServer, player, this.props.maxMoney);
    }

    updateNsServer() {
        this.nsServer = ns.getServer(this.s.name)
    }

    calcThreads() {
        this.getServerProps()
        this.updateNsServer()
        return {
            grow: this.calcGrowThreads(),
            hack: this.calcHackThreads(),
            weak: this.calcWeakThreads()
        }
    }
}

class Batch {
    /** @param {Target} target */
    constructor(target) {
        this.t = target
        this.level = player.level
        this.startTime = Date.now()
        this.attacks = []
        this.startTimes = []
        this.endTime = 0
        this.handles = []
        ns.print(target.s.name, " batch: ")
    }

    addAttack(type) {
        this.attacks.push(type)
    }

    launch() {
        if (this.attacks.length == 0)
            return
        times = this.calcTimes()
        this.endTime = Date.now() + Math.max(Object.values(times)) + (BATCH_PAUSE * this.attacks.length)
        let pause = 0
        for (let a of this.attacks) {
            switch (a) {
                case "weak":
                    this.startTimes.push({start: this.endTime - times.wkTime - pause, type: this.weakenTarget, time: times.wkTime})
                break

                case "hack":
                    this.startTimes.push({start: this.endTime - times.hkTime - pause, type: this.hackTarget, time: times.hkTime})
                break

                case "grow":
                    this.startTimes.push({start: this.endTime - times.gwTime - pause, type: this.growTarget, time: times.gwTime})
                break
            }
            pause += BATCH_PAUSE
        }

        for (let a of this.startTimes) {
            this.handles.push(setTimeout(a.fun, a.start, a.time))
        }
    }

    execAttack(target, file, threads) {
        print(target, ": ", file, " ", threads, "th")
        // ns.exec(file, target, {threads: threads})
    }

    weakenTarget(target, time) {
        threads = target.calcThreads().weak
        server = bn.requestThreads(threads)
        this.execAttack(target.s.name, "weaken.js", threads)
    }

    growTarget(target, time) {
        threads = target.calcThreads().grow
        server = bn.requestThreads(threads)
        this.execAttack(target.s.name, "grow.js", threads)
    }

    hackTarget(target, time) {
        threads = target.calcThreads().hack
        server = bn.requestThreads(threads)
        this.execAttack(target.s.name, "hack.js", threads)
    }

    calcTimes() {
        return {
            wkTime = this.ns.getWeakenTime(this.t.s.name),
            gwTime = this.ns.getGrowTime(this.t.s.name),
            hkTime = this.ns.getHackTime(this.t.s.name),
        }
    }
}

class Server {
    constructor(newName) {
        this.name = newName
        this.maxRam = ns.getServerMaxRam(this.name)
    }

    freeThreadCount(scriptRam) {
        let threads = 0;
        const free_ram = this.maxRam - ns.getServerUsedRam(this.name)
        threads = free_ram / scriptRam
        return Math.floor(threads)
    }

    tryNuke() {
        ns.print("[NUKE]: " + this.name);
        try {
            ns.brutessh(this.name)
            ns.ftpcrack(this.name)
            ns.relaysmtp(this.name)
            ns.httpworm(this.name)
            ns.sqlinject(this.name)
        } catch { }

        try {
            ns.nuke(this.name)
            ns.print("nuke success");
            return false;
        } catch {
            ns.print("nuke fail");
            return true;
        }
    }
}

class Botnet {
    constructor() {
        this.host = ns.getServer()
        this.servers = this.discoverServers(this.host.hostname, [], true)
        this.targets = this.servers.map((server) => {
                if (ns.getServerMaxMoney(server.name) > 0) {
                    return new Target(server);
                }
            })
    }


    discoverServers(hostname, scanned = [], sKill = true) {
        const connectedServers = ns.scan(hostname);

        for (let server of connectedServers) {
            if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server))
                continue;
            if (!scanned.map((server) => {return server.name}).includes(server)) {
                if (server == "darkweb" || (!ns.hasRootAccess(server) && this.tryNuke(ns, server)))
                    continue;
                if (sKill) {
                    for (let bin of binList)
                    ns.scriptKill(bin, server);
                }
                scanned.push(new Server(server));
                ns.print("Added ", server)
                this.discoverServers(server, scanned, sKill);
            }
        }
        return scanned;
    }
}

function updatePlayer() {
    player = ns.getPlayer()
}

export async function main(newNs) {
    // Init ns
    ns = newNs
    updatePlayer()
    ns.disableLog("ALL");
    ns.clearLog();
    
    // Write scripts
    for (let i in actionList)
            ns.write(binList[i], "\
                /** @param {NS} ns **/\n\
                export async function main(ns) {\n\
                    let target = ns.args[0];\n\
                    await ns." + actionList[i] + "(target, {stock:true})\n\
                }\n", "w");
    
    // Init botnet
    bn = new Botnet();
}
