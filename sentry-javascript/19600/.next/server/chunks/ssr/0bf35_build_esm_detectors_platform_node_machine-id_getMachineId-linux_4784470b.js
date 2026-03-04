;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="f5005f7e-b3b2-b08a-ada4-d413b3b675c5")}catch(e){}}();
module.exports=[36595,a=>{"use strict";var b=a.i(22734),c=a.i(18304);async function d(){for(let a of["/etc/machine-id","/var/lib/dbus/machine-id"])try{return(await b.promises.readFile(a,{encoding:"utf8"})).trim()}catch(a){c.diag.debug(`error reading machine id: ${a}`)}}a.s(["getMachineId",()=>d])}];

//# debugId=f5005f7e-b3b2-b08a-ada4-d413b3b675c5
//# sourceMappingURL=0bf35_build_esm_detectors_platform_node_machine-id_getMachineId-linux_4784470b.js.map