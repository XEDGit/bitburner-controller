/** @param {NS} ns */
export async function main(ns) {
    const startPrograms = ["stonks", "gangs", "servers", "botv3"];
    if (ns.args.length) {
        ns.write("spawner.js", "\n\
        /** @param {NS} ns */\n\
        export async function main(ns) {\n\
            ns.spawn(ns.args[0], 1);\n\
        }\n", "w");

        for (let program of startPrograms) {
            ns.run("spawner.js", 1, program + ".js");
            await ns.sleep(100);
        }
    } else {
        for (let program of startPrograms) {
            ns.run(program + ".js", 1);
        }
    }
}