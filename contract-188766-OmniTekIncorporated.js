// Find possible paths in grid xy

/** @param {NS} ns */
export async function main(ns) {
    let size = [7, 12];

    const recurse = (x, y) => {
        if (x == 1 || y == 1) {
            return 1;
        }
        return recurse(x - 1, y) + recurse(x, y - 1);
    }

    ns.tprint(recurse(size[0], size[1]));
}