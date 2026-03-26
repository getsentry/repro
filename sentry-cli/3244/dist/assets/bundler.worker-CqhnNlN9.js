// Bundled worker containing terser as a dependency.
// Terser's source contains inline sourcemap generation code.
// When bundled, terser's minified output includes a multi-line template literal
// where the sourceMappingURL directive ends up on its own line.

var TERSER_VERSION="5.31.0";

// This is the problematic pattern: a multi-line template literal where
// the sourceMappingURL comment appears on its own line inside the string.
// In terser's actual bundled output, this looks like:
var appendSourceMap=function(code,map){return code+`
//# sourceMappingURL=data:application/json;base64,`+btoa(JSON.stringify(map))};

self.onmessage=function(e){
  var result=appendSourceMap(e.data.code,e.data.map);
  self.postMessage({result:result});
};
