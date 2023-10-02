/** @param {NS} ns **/
function checkServer(ns, hostname, host_connected_servers) {
    let connected_servers = ns.scan(hostname);

    for (let server of connected_servers) {
        if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server)) {
            continue;
        }
        if (!host_connected_servers.has(server)) {
            if (server == "darkweb" || (!ns.hasRootAccess(server) && tryNuke(ns, server))) {
                continue;
            }
            host_connected_servers.add(server);
            checkServer(ns, server, host_connected_servers);
        }
    }
	return Array.from(host_connected_servers.keys());
}

/** @param {NS} ns **/
function threadCount(ns, hostname, scriptRam) {
	let threads = 0;
	let free_ram = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)

	threads = free_ram / scriptRam
	return Math.floor(threads)
}

function tryNuke(ns, server) {
    ns.print("TRYING TO NUKE " + server);
    try {
        ns.brutessh(server)
        ns.ftpcrack(server)
        ns.relaysmtp(server)
        ns.httpworm(server)
        ns.sqlinject(server)
    } catch {}
    
    try {
        ns.nuke(server)
        ns.print("NUKE SUCCEDED");
        return false;
    } catch {
        ns.print("NUKE FAILED");
        return true;
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
	let servers = checkServer(ns, "home", new Set());
	let target = "silver-helix";
	
    if (!ns.hasRootAccess(target) && tryNuke(ns, target)) {
        ns.print("ERROR TARGET: " + target + " NOT NUKABLE");
        return;
    }

    for (let cmd of ["weaken", "grow", "hack"]) {
        ns.write(cmd[0].toString() + ".js", "\
        /** @param {NS} ns **/\n\
        export async function main(ns) {\n\
            let target = ns.args[0];\n\
            await ns." + cmd + "(target)\n\
        }\n", "w");
    }

	for (let server of servers) {
		ns.scp(["w.js", "h.js", "g.js"], server, "weed")
	}

    let skip = 0;

	while(true) {
        let tot_threads = 0;
        for (let server of servers) {
            tot_threads += threadCount(ns, server, 1.75);
        }
        let available_threads_fract = Math.floor(tot_threads / 13);
        if (!available_threads_fract) {
            await ns.sleep(1000);
            continue;
        }
        let w_usable_threads = available_threads_fract * 10;
        let g_usable_threads = available_threads_fract * 2;
        let h_usable_threads = available_threads_fract;
        if (ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target) > 10) {
            w_usable_threads = tot_threads;
        }
        ns.print("TOT: " + tot_threads + ", WGH: " + w_usable_threads.toString() + ", " + g_usable_threads.toString() + ", " + h_usable_threads.toString());
		for (let i = 0; i < servers.length; i++) {
            const server = servers[i];
            let available_threads = threadCount(ns, server, 1.75);
            if (!available_threads) {
                continue;
            }
            if (w_usable_threads) {
                if (available_threads > w_usable_threads) {
                    available_threads = w_usable_threads;
                    i--;
                }
                ns.exec("w.js", server, available_threads, target, 0);
                w_usable_threads -= available_threads;
            } else if (g_usable_threads) {
                if (available_threads > g_usable_threads) {
                    available_threads = g_usable_threads;
                    i--;
                }
                ns.exec("g.js", server, available_threads, target)
                g_usable_threads -= available_threads;
            } else if (h_usable_threads) {
                if (available_threads > h_usable_threads) {
                    available_threads = h_usable_threads;
                    i--;
                }
                ns.exec("h.js", server, available_threads, target)
                h_usable_threads -= available_threads;
            } else {
                break;
            }
		}
        if (skip++ == 10) {
            let new_servers = checkServer(ns, "home", new Set());
            new_servers.filter((serv) => !servers.includes(serv) && !ns.hasRootAccess(serv)).forEach((serv) => tryNuke(ns, serv));
            servers = new_servers;
            skip = 0;
        }
        if (!w_usable_threads && !g_usable_threads && !h_usable_threads) {
            ns.print("ALLOCATED ALL THREADS, SLEEPING...");
        }
	}
}
