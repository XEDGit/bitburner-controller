const actionList = ["weaken", "grow", "hack"];
const makeJs = (name) => name + ".js";
const binList = actionList.map(makeJs);
let handles = []
let errors = []
const BATCH_PAUSE = 25
const BREAK_BETWEEN_BATCHES = 0.2 * 1000
const HACK_PERCENT = 0.001
let MAX_TARGETS = 50
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
        /**@type {globalThis.Server} */
        let nsServCopy = structuredClone(this.nsServer)
        let hackMoney = nsServCopy.moneyMax * HACK_PERCENT

        let threadHackPercent = ns.formulas.hacking.hackPercent(nsServCopy, player)
        let hThr = Math.max(Math.floor(HACK_PERCENT / threadHackPercent), 1)
        if (hThr > 1000) {
            hThr = 1000
        }
        nsServCopy.hackDifficulty = nsServCopy.minDifficulty
        hackMoney = nsServCopy.moneyMax * (hThr * threadHackPercent)

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
        let attackers = []
        let i = 0
        for (let a of this.attacks) {
            let threads = 0
            let attacker
            let script
            let time
            switch (a) {
                case "weak":
                    script = "weaken.js"
                    time = this.times.wkTime
                    if (!i) {
                        threads = Math.ceil(((this.t.props.currSecurity - this.t.props.minSecurity) / 0.05))
                        if (threads > bn.maxFreeThreads / 4)
                            threads = Math.ceil(bn.maxFreeThreads / 4)
                    }
                    else if (this.attacks[i - 1] == "grow")
                        threads = calculatedThreads.gweak
                    else if (this.attacks[i - 1] == "hack")
                        threads = calculatedThreads.hweak
                    attacker = bn.requestThreads(threads, 1.75, attackers)
                break

                case "hack":
                    script = "hack.js"
                    time = this.times.hkTime
                    threads = calculatedThreads.hack
                    attacker = bn.requestThreads(threads, 1.70)
                break

                case "grow":
                    script = "grow.js"
                    time = this.times.gwTime
                    threads = calculatedThreads.grow
                    attacker = bn.requestThreads(threads, 1.75)
                break
            }
            attackers.push({threads: threads, attacker: attacker, script:script, execTime:time})
            i++
        }
        if (attackers.find((a) => {return a.attacker == null || a.threads <= 0}) != undefined) {
            this.interruptBatch()
            return
        }
        i = 0
        for (let a of this.attacks) {
            this.execAttack(attackers[i].attacker, this.t, attackers[i].script, attackers[i].threads, this.endTime - Date.now() - attackers[i].execTime - pause)
            let procInfo = {pid: null, host:attackers[i].attacker, target: this.t, threads: attackers[i].threads, scriptRam: a == "hack"? 1.70 : 1.75}
            this.processes.push(procInfo)
            pause -= BATCH_PAUSE
            i++
        }
        handles.push(...this.handles)
    }

    interruptBatch(target, file, threads, msg) {
        this.interrupt = true
        this.handles.forEach(clearTimeout)
        this.handles.forEach(clearInterval)
        this.processes.forEach((proc) => {if (proc.pid) ns.kill(proc.pid, proc.host.name, proc.target)})
        if (msg) {
            this.t.s.interruptions++
            errors.unshift(String(target.s.name + ": " + msg + ", " + file + " asks for " + threads))
            errors = errors.slice(0, 5)
        }
        this.t.batches.splice(this.t.batches.length - 1, 1)
    }

    execAttack(attacker, target, file, threads, additionalTime) {
        threads = Math.max(threads, 1)
        additionalTime = Math.max(additionalTime, 0)
        let pid = ns.exec(file, attacker.name, threads, target.s.name, Math.round(additionalTime))
        if (pid <= 0) {
            this.interruptBatch(target, file, threads, attacker.name + " has free threads " + attacker.freeThreadCount(file == "hack.js"? 1.70 : 1.75, 0))
            return
        }
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
    }

    usedRam() {
        return ns.getServerUsedRam(this.name)
    }

    freeThreadCount(scriptRam, busyAmount) {
        let threads = 0;
        const free_ram = this.maxRam - this.usedRam()
        threads = (free_ram / 1.75) - busyAmount
        return Math.floor(threads) - 2
    }

    tryNuke() {
        try {
            ns.brutessh(this.name)
            ns.ftpcrack(this.name)
            ns.relaysmtp(this.name)
            ns.httpworm(this.name)
            ns.sqlinject(this.name)
        } catch { }

        try {
            ns.nuke(this.name)
            ns.print(this.name, ": Nuke");
            return false;
        } catch {
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
            this.maxFreeThreads = Math.max(this.maxFreeThreads, Math.floor(((s.maxRam - s.usedRam()) / 1.75) * 100) / 100)
        })}, 2)
        this.targets = []
        this.servers.sort((a, b) => {return ns.getServerMaxMoney(b.name) - ns.getServerMaxMoney(a.name)}).forEach((s) => {
            let mm = ns.getServerMaxMoney(s.name)
            if (!mm || s.name == "n00dles" || this.targets.length == MAX_TARGETS)
                return
            this.targets.push(new Target(s))
        })
        handles.push(setInterval(() => {
            for (let t of this.targets) {
                if (t.nsServer.minDifficulty != t.nsServer.hackDifficulty ||
                        t.nsServer.moneyMax != t.nsServer.moneyAvailable) {
                    t.prepare()
                } else if (!t.preparing) {
                    t.attack()
                }
            }
        }, BREAK_BETWEEN_BATCHES));
    }

    // ERROR Two consecutive requests will yield same result even if it's not possible
    requestThreads(amount, scriptRam, alreadyRequested = []) {
        for (let s of this.servers) {
            let busyThreads = 0
            alreadyRequested.forEach((aq) => {if (aq.name == s.attacker) busyThreads += aq.threads})
            let freeThreads = s.freeThreadCount(scriptRam, busyThreads)
            if (freeThreads > amount) {
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
    }
}

function updatePlayer() {
    player = ns.getPlayer()
}

function accomodate() {
    ns.resizeTail(800, Math.min(25 * (bn.targets.length + errors.length + 8), innerHeight))
}

export async function main(newNs) {
    // Init ns
    ns = newNs
    updatePlayer()
    let update = 20_000
    ns.disableLog("ALL");
    ns.enableLog("exec")
    ns.clearLog();
    ns.tail()
    ns.moveTail(1320, 0)
    ns.atExit(() => {handles.forEach((h) => {clearTimeout(h); clearInterval(h);}); ns.exit()})
    
    // Write scripts
    for (let i in actionList)
        ns.write(binList[i], "\
            /** @param {NS} ns **/\n\
            export async function main(ns) {\n\
                let target = ns.args[0];\n\
                await ns." + actionList[i] + "(target, {stock:true, additionalMsec: Number(ns.args[1])})\n\
            }\n", "w");

    // Init log
    let scriptName = ns.getScriptName()
    let hostname = ns.getHostname()
    
    // Init botnet
    bn = new Botnet();

    let startTime = Date.now()
    
    // Output
    handles.push(setInterval(() => {
        ns.clearLog()
        update -= BREAK_BETWEEN_BATCHES
        ns.print("╭────────────────────────────────────────────────────────────────────────╮")
        ns.print("│ Time active: ", ns.tFormat(Date.now() - startTime).padEnd(59, " "), "│")
        ns.print("│ Stats: ", String(ns.formatNumber(ns.getScriptExpGain(scriptName, hostname)) + "xp/s │ " + ns.formatNumber(ns.getScriptIncome(scriptName, hostname)) + "$/s" + " | " + player.skills.hacking + " | Update in: " + Math.floor(update / 100) / 10).padEnd(65, " "), "│")
        ns.print("│   ▶️/E    ┬ 🧱 💵 ┬ Pre/Att              ┬ 💵              ┬ Progress ┬ Time          │")
        ns.print("├─────────────────────────────────────────────────────────────────────────┤")
        for (let t of bn.targets) {
            if (!t.nsServer)
                continue
            let threads = t.calcThreads()
            let mm = t.nsServer.moneyMax,
            cm = ns.getServerMoneyAvailable(t.s.name),
            cs = ns.getServerSecurityLevel(t.s.name),
            ms = ns.getServerMinSecurityLevel(t.s.name),
            stolenMoney = threads.hack * ns.formulas.hacking.hackPercent(t.nsServer, player),
            mcheck = cm + 15_000 >= mm - (mm * stolenMoney)? "✅" : "⚠️",
            scheck = cs < ms + Math.max(threads.gweak / 0.05, threads.hweak / 0.05)? "✅" : "⚠️"
            if (cm <= mm * 0.5)
                mcheck = "❌"
            if (cs >= ms * 3)
                scheck = "❌"
            let timeProcess = ns.getWeakenTime(t.s.name) / 1000 / 60
            ns.print("│", t.batches.length.toString().padStart(4, " "), "/", t.interruptions, " | ", scheck, " ", mcheck, " | ", t.preparing? "P " : "A ", t.s.name.padEnd(19, " "), "| ", String(ns.formatNumber(stolenMoney * mm) + "$").padEnd(10), "|", "|".repeat((((Date.now() - startTime) / 1000 / 60) % timeProcess) / timeProcess * 10).padEnd(10), "│ ", String(Math.round(timeProcess) + " min").padEnd(9), "     │")
        }
        ns.print("├─────────────────────────────────────────────────────────────────────────┤")
        let maxLen = "─────────────────────────────────────────────────────────────────────────".length
        for (let e of errors)
            ns.print("├", e.padEnd(maxLen, " "), "┤")
        ns.print("╰────────────────────────────────────────────────────────────────────────╯")
        accomodate()
    }, BREAK_BETWEEN_BATCHES))

    accomodate()
    while (true)
        await new Promise(() => {handles.push(setInterval(() => {
            updatePlayer()
            bn.updateServers()
            update = BREAK_BETWEEN_BATCHES * 10
        }, BREAK_BETWEEN_BATCHES * 10))})
}
