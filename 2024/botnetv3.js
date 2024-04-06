const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);
let handles = []
const BATCH_PAUSE = 100
const BREAK_BETWEEN_BATCHES = 0.6 * 1000
const HACK_PERCENT = 0.02
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
        this.preparing = false
        this.interruptions = 0
        this.updateNsServer()
        this.props = this.getServerProps()
        // handles.push(setInterval(() => {this.prepare()}))
        handles.push(setInterval(() => {
            let threads = this.calcThreads()
            if (this.nsServer.minDifficulty != this.nsServer.hackDifficulty ||
                    this.nsServer.moneyMax != this.nsServer.moneyAvailable) {
                this.prepare()
            } else if (!this.preparing) {
                this.attack()
            }
            let mm = this.nsServer.moneyMax,
            cm = ns.getServerMoneyAvailable(this.s.name),
            cs = ns.getServerSecurityLevel(this.s.name),
            ms = ns.getServerMinSecurityLevel(this.s.name),
            mcheck = cm >= mm - (mm * threads.hack * ns.formulas.hacking.hackPercent(this.nsServer, player)),
            scheck = cs < ms + Math.max(threads.gweak / 0.05, threads.hweak / 0.05)
            ns.print(this.batches.length.toString().padStart(3, " "), "/", this.interruptions, " | ", scheck? "✓" : "✗", " ", mcheck? "✓" : "✗", " | ", this.preparing? "Prepare " : "Attack ", this.s.name.padEnd(18, " "), "~ h:", threads.hack, " g:", threads.grow, " hw:", threads.hweak, " gw:", threads.gweak)
        }, BREAK_BETWEEN_BATCHES));
    }

    attack() {
        let newBatch = new Batch(this)
        newBatch.addAttack("hack")
        newBatch.addAttack("weak")
        newBatch.addAttack("grow")
        newBatch.addAttack("weak")
        newBatch.launch()
        this.batches.push(newBatch)
        handles.push(setTimeout(() => {if (!newBatch.interrupt) this.batches.splice(0, 1)}, newBatch.endTime - Date.now()))
    }

    prepare() {
        let newBatch = new Batch(this)
        if (this.nsServer.minDifficulty != this.nsServer.hackDifficulty)
                newBatch.addAttack('weak')
        newBatch.addAttack('grow')
        newBatch.addAttack('weak')
        newBatch.launch() 
        this.preparing = true
        handles.push(setTimeout(() => {this.updateNsServer();this.preparing = false; if (!newBatch.interrupt) this.batches.splice(0, 1)}, newBatch.endTime - Date.now()))
        this.batches.push(newBatch)
    }

    getServerProps() {
        let cMoney = ns.getServerMoneyAvailable(this.s.name)
        let mMoney = ns.getServerMaxMoney(this.s.name)
        let cSecurity = ns.getServerSecurityLevel(this.s.name)
        let mSecurity = ns.getServerMinSecurityLevel(this.s.name)
        return {
            currMoney: cMoney, 
            maxMoney: mMoney,
            currSecurity: cSecurity,
            minSecurity: mSecurity,
        }
    }

    updateNsServer() {
        this.nsServer = ns.getServer(this.s.name)
    }

    calcThreads() {
        
        let nsServCopy = structuredClone(this.nsServer)
        let hackMoney = nsServCopy.moneyMax * HACK_PERCENT

        let threadHackPercent = ns.formulas.hacking.hackPercent(nsServCopy, player)
        let hThr = Math.max(Math.floor(HACK_PERCENT / threadHackPercent), 1)
        
        nsServCopy.moneyAvailable = nsServCopy.moneyMax - hackMoney
        let gThr = Math.ceil(ns.formulas.hacking.growThreads(nsServCopy, player, nsServCopy.moneyMax) * 1.2)
        gThr = Math.min(gThr, Math.ceil(bn.maxFreeThreads / 4))

        return {
            grow: gThr,
            hack: hThr,
            gweak: Math.ceil(gThr * 0.004 / 0.05),
            hweak: Math.ceil(hThr * 0.002 / 0.05)
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
        this.processes = []
        this.interrupt = false
    }

    addAttack(type) {
        this.attacks.push(type)
    }

    launch() {
        if (this.attacks.length == 0) {
            ns.print("Interrupting launch")
            return
        }
        this.times = this.calcTimes()
        let pause = BATCH_PAUSE * this.attacks.length
        this.endTime = Date.now() + Math.max(...Object.values(this.times)) + pause
        let calculatedThreads = this.t.calcThreads()
        let i = 0
        for (let a of this.attacks) {
            let threads = 0
            let attacker = null
            switch (a) {
                case "weak":
                    if (!i) {
                        threads = Math.ceil(((this.t.props.currSecurity - this.t.props.minSecurity) / 0.05))
                        if (threads > bn.maxFreeThreads / 4)
                            threads = Math.ceil(bn.maxFreeThreads / 4)
                    }
                    else if (this.attacks[i - 1] == "grow")
                        threads = calculatedThreads.gweak
                    else if (this.attacks[i - 1] == "hack")
                        threads = calculatedThreads.hweak
                    attacker = bn.requestThreads(threads, 1.75)
                    if (attacker == null) {
                        this.interruptBatch(this.t, "weaken.js", threads, null)
                        return
                    }
                    this.handles.push(setTimeout(this.weakenTarget.bind(this), Math.round(this.endTime - Date.now() - this.times.wkTime - pause), this.t, this.times.wkTime, threads, attacker))
                break

                case "hack":
                    threads = calculatedThreads.hack
                    attacker = bn.requestThreads(threads, 1.70)
                    if (attacker == null) {
                        this.interruptBatch(this.t, "hack.js", threads, null)
                        return
                    }
                    this.handles.push(setTimeout(this.hackTarget.bind(this), Math.round(this.endTime - Date.now() - this.times.hkTime - pause), this.t, this.times.hkTime, threads, attacker))
                break

                case "grow":
                    threads = calculatedThreads.grow
                    attacker = bn.requestThreads(threads, 1.75)
                    if (attacker == null) {
                        this.interruptBatch(this.t, "grow.js", threads, null)
                        return
                    }
                    this.handles.push(setTimeout(this.growTarget.bind(this), Math.round(this.endTime - Date.now() - this.times.gwTime - pause), this.t, this.times.gwTime, threads, attacker))
                break
            }
            let procInfo = {pid: null, host:attacker, target: this.t, threads: threads, scriptRam: a == "hack"? 1.70 : 1.75}
            this.processes.push(procInfo)
            pause -= BATCH_PAUSE
            i++
        }
        handles.push(...this.handles)
    }

    interruptBatch(target, file, threads, msg) {
        this.interrupt = true
        this.t.batches.splice(this.t.batches.length - 1, 1)
        this.handles.forEach(clearTimeout)
        this.processes.forEach((proc) => {if (proc.pid) ns.kill(proc.pid, proc.host.name, proc.target); proc.host.currRam = Math.round((proc.host.currRam - proc.threads * proc.scriptRam) * 100) / 100})
        if (msg) {
            this.t.s.interruptions++
            ns.print(msg, " batch on ", target.s.name, ": ", file, "->", threads)
        }
    }

    execAttack(attacker, target, file, threads, time) {
        let pid = ns.exec(file, attacker.name, {threads: threads, temporary: true}, target)
        if (pid <= 0) {
            this.interruptBatch(target, file, threads, "Interrupt")
            return
        }
        let procInfo = {pid: pid, host:attacker, target: target, threads: threads, scriptRam: file == "hack.js"? 1.70 : 1.75}
        this.handles.push(setTimeout(() => {attacker.currRam = Math.round((attacker.currRam - procInfo.threads * procInfo.scriptRam)* 100) / 100;}, time))
        handles.push(this.handles[-1])
    }

    /**@param {Target} target*/
    weakenTarget(target, time, threads, attacker) {
        this.execAttack(attacker, target.s.name, "weaken.js", threads, time)
    }

    growTarget(target, time, threads, attacker) {
        this.execAttack(attacker, target.s.name, "grow.js", threads, time)
    }

    hackTarget(target, time, threads, attacker) {
        this.execAttack(attacker, target.s.name, "hack.js", threads, time)
    }

    calcTimes() {
        return {
            wkTime: ns.getWeakenTime(this.t.s.name),
            gwTime: ns.getGrowTime(this.t.s.name),
            hkTime: ns.getHackTime(this.t.s.name),
        }
    }
}

class Server {
    constructor(newName) {
        this.name = newName
        this.maxRam = ns.getServerMaxRam(this.name)
        setTimeout(() => {this.currRam = this.usedRam();}, 1)
    }

    usedRam() {
        return ns.getServerUsedRam(this.name)
    }

    freeThreadCount(scriptRam) {
        let threads = 0;
        const free_ram = this.maxRam - this.currRam
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
        this.servers = this.discoverServers(true)
        this.maxFreeThreads = 0
        setTimeout(() => {this.servers.forEach((s) => {
            this.maxFreeThreads = Math.max(this.maxFreeThreads, Math.floor(((s.maxRam - s.currRam) / 1.75) * 100) / 100)
        })}, 2)
        this.targets = []
        this.servers.forEach((s) => {
            let mm = ns.getServerMaxMoney(s.name)
            if (!mm)
                return
            this.targets.push(new Target(s))
        })
    }

    requestThreads(amount, scriptRam) {
        for (let s of this.servers) {
            let freeThreads = s.freeThreadCount(scriptRam)
            if (freeThreads > amount) {
                s.currRam += amount * scriptRam
                s.currRam = Math.round(s.currRam * 100) / 100
                return s
            }
        }
        return null
    }

    discoverServers(sKill, hostname = "home", scanned = [new Server("home")]) {
        const connectedServers = ns.scan(hostname);

        for (let server of connectedServers) {
            if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server))
                continue;
            if (!scanned.map((s) => {return s.name}).includes(server)) {
                let newServer = new Server(server)
                if (server == "darkweb" || (!ns.hasRootAccess(server) && newServer.tryNuke()))
                    continue;
                if (sKill) {
                    for (let bin of binList)
                    ns.scriptKill(bin, server);
                }
                ns.scp(binList, server)
                scanned.push(newServer);
                this.discoverServers(sKill, server, scanned);
            }
        }
        return scanned;
    }

    updateServers() {
        let newServers = this.discoverServers(false)
        newServers.forEach((s) => {
            let oldServer = this.servers.find((ogs) => {if (ogs.name == s.name) return true; return false})
            if (oldServer == undefined) {
                this.servers.push(s)
                if (ns.getServerMaxMoney(s.name))
                    this.targets.push(new Target(s))
                return
            }
            oldServer.maxRam = s.maxRam
        })
        ns.resizeTail(650, 25 * ((this.targets.length) + 2))
    }
}

function updatePlayer() {
    player = ns.getPlayer()
}

export async function main(newNs) {
    // Init ns
    ns = newNs
    updatePlayer()
    let update = 20_000
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail()
    ns.moveTail(1320, 0)
    ns.atExit(() => {handles.forEach((h) => {clearTimeout(h)}); ns.exit()})
    
    // Write scripts
    for (let i in actionList)
        ns.write(binList[i], "\
            /** @param {NS} ns **/\n\
            export async function main(ns) {\n\
                let target = ns.args[0];\n\
                await ns." + actionList[i] + "(target, {stock:true})\n\
            }\n", "w");

    // Init log
    let scriptName = ns.getScriptName()
    let hostname = ns.getHostname()
    handles.push(setInterval(() => {
        ns.clearLog()
        update -= BREAK_BETWEEN_BATCHES
        ns.print("  B/E | S  M | ", ns.formatNumber(ns.getScriptExpGain(scriptName, hostname)), "xp/s | ", ns.formatNumber(ns.getScriptIncome(scriptName, hostname)), "$/s", " | ", player.skills.hacking, " | Update in: ", Math.floor(update / 100) / 10, )
    }, BREAK_BETWEEN_BATCHES))

    // Init botnet
    bn = new Botnet();
    ns.resizeTail(650, 25 * ((bn.targets.length) + 2))
    while (true)
        await new Promise(() => setInterval(() => {
            updatePlayer()
            bn.updateServers()
            update = 20_000
        }, 20_000))
}