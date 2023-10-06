A collection of scripts for BitBurner:

##### botnetv0
finds all servers and make them run an attack to a singular target using a weak/grow/hack rateo of 10/2/1 infinitely, with new hosts discovery

##### botnetv1
same as v0, but with an (wrong) idea of hwgw batching implemented, works without formulas, with new hosts discovery

##### botnetv2
proper implementation of hwgw batching algorythm using setTimeout, with new hosts discovery.
this script restarts itself (and all the already running batches) with different settings to never run out of RAM, this limitation is to tackle the desync of batches

##### stonks
stock market automatization, requires access to all stock APIs