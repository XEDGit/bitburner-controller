A collection of scripts for BitBurner:

## 2022
##### botnetv0
finds all servers and make them run an attack to a singular target using a weak/grow/hack rateo of 10/2/1 infinitely, with new hosts discovery

##### botnetv1
same as v0, but with an (wrong) idea of hwgw batching implemented, works without formulas, with new hosts discovery

##### botnetv2
proper implementation of hwgw batching algorythm using setTimeout, with new hosts discovery.
this script restarts itself (and all the already running batches) with different settings to never run out of RAM, this limitation is to tackle the desync of batches

##### stonks
stock market automatization, requires access to all stock APIs

## 2024
##### botnetv3.js
HWGW batching balanced through formulas and auto-correcting, with live monitoring output

##### gangs_nitesec.js
Very simple script to manage Nitesec gang, keeps raising the members level while also assigning the higher level ones to tasks

##### servers.js
Upgrades or buys new servers for you, WARNING: uses all money

##### run.js
Starts the preceding scripts in one command, if provided with any argument it'll use ns.spawn, otherwise ns.run
