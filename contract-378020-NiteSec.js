// Vigenere cypher

/** @param {NS} ns */
export async function main(ns) {
    const letters = "abcdefghijklmnopqrstuvwxyz".toUpperCase();

    const table = [];
    for (let i in letters) {
        table.push(letters.slice(i).concat(letters.slice(0, i)));
    }

    let input = ["INBOXVIRUSCACHEEMAILFLASH", "VIRTUAL"];

    let res = "";

    for (let i in input[0]) {
        res = res.concat(table[letters.indexOf(input[0][i])][letters.indexOf(input[1][i % input[1].length])]);
    }
    ns.tprint(res);
}
