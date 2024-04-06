/** @type {NS} */
let ns
let equipment

async function getInGang() {
    while (!ns.gang.createGang('Nitesec')) {
        ns.print("\rNot in gang yet, backdoor Nitesec to create...")
        ns.sleep(10)
    }
}

function getAvgHackLvl(members) {
    let avgHackLvl = 0
    members.forEach(m => {avgHackLvl += ns.gang.getMemberInformation(m.name).hack})
    return avgHackLvl / members.length
}

class Memeber {
    constructor(newName) {
        this.name = newName
        this.updateInfo()
        this.updateEquipment()
        this.period = 0
    }

    periodicUpdate() {
        if (this.period < 10) {
            this.period++
            return
        }
        this.updateEquipment()
        this.period = 0
    }

    updateEquipment() {
        for (const e of equipment) {
            ns.gang.purchaseEquipment(this.name, e)
        }
    }

    updateInfo() {
        this.info = ns.gang.getMemberInformation(this.name)
    }

    printStatus() {
        ns.print(this.name.padStart(7), ": ", ns.formatNumber(this.info.hack).padStart(10), String(Math.round(this.info.hack_asc_mult)).padStart(5), " | ", String(Math.floor(ns.gang.getAscensionResult(this.name)?.hack * 100) / 100).padStart(5), " | ", this.info.task.split(" ").map(n => {return n[0] + "."}).join(''))
    }

    setTask(task) {
        this.updateInfo()
        if (this.info.task == task) {
            return
        }
        ns.gang.setMemberTask(this.name, task)
    }

    checkAscension() {
        // return false
        let ascension = ns.gang.getAscensionResult(this.name)
        if (ascension == undefined)
            return false
        if (ascension.hack > 1.2) {
            ns.gang.ascendMember(this.name)
            this.setTask("Train Hacking")
            return true
        }
        return false
    }
}

/** @param {NS} newNs */
export async function main(newNs) {
    ns = newNs
    ns.tail()
    ns.disableLog("ALL")
    ns.clearLog()
    ns.moveTail(900, 0)
    ns.resizeTail(420, 100)
    if (!ns.gang.inGang())
        await getInGang()
    equipment = ns.gang.getEquipmentNames().filter(e => {if (ns.gang.getEquipmentStats(e).hack > 0) return true; return false})
    let taskNames = ns.gang.getTaskNames()
    let members = ns.gang.getMemberNames().map(m => {return new Memeber(m)})
    ns.resizeTail(420, (members.length + 2) * 25)
    let avgHackLvl = getAvgHackLvl(members)
    while (true) {
        for (const memb of members) {
            if (memb.checkAscension()) {
                ns.print("Ascend: ", memb.name)
                continue
            }
            
            if (memb.info.hack < avgHackLvl) {
                memb.setTask('Train Hacking')
            }
            else if (ns.gang.getGangInformation().wantedLevel > 1) {
                memb.setTask('Ethical Hacking')
            }
            else {
                memb.setTask('Money Laundering')
            }
            memb.printStatus()
            memb.periodicUpdate()
        }
        avgHackLvl = getAvgHackLvl(members)
        ns.print("Avg Lvl: ", ns.formatNumber(avgHackLvl))
        while (ns.gang.canRecruitMember()) {
            let newName = (Math.random() + 1).toString(36).substring(7)
            if (ns.gang.recruitMember(newName))
                members.push(new Memeber(newName))
            ns.resizeTail(420, (members.length + 2) * 25)
        }
        await ns.gang.nextUpdate()
        ns.clearLog()
    }
}