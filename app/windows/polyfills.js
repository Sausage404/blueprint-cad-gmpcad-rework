// Ce qui manque au moteur JavaScript de Windows (Chakra, niveau ES2017) pour le lecteur DXF / .des.
if (typeof globalThis === "undefined") this.globalThis = this;
(function () {
  var def = function (o, nom, f) {
    if (!o[nom]) Object.defineProperty(o, nom, { value: f, configurable: true, writable: true });
  };
  def(Array.prototype, 'flat', function (n) {
    var p = n === undefined ? 1 : n;
    return p < 1 ? Array.prototype.slice.call(this) : Array.prototype.reduce.call(this, function (acc, x) {
      return acc.concat(Array.isArray(x) ? x.flat(p - 1) : [x]);
    }, []);
  });
  def(Array.prototype, 'flatMap', function (f, t) {
    var out = [];
    for (var i = 0; i < this.length; i++) {
      var r = f.call(t, this[i], i, this);
      if (Array.isArray(r)) for (var j = 0; j < r.length; j++) out.push(r[j]);
      else out.push(r);
    }
    return out;
  });
  def(Array.prototype, 'at', function (i) {
    var k = Math.trunc(i) || 0;
    return this[k < 0 ? this.length + k : k];
  });
  def(String.prototype, 'at', function (i) {
    var k = Math.trunc(i) || 0;
    return this.charAt(k < 0 ? this.length + k : k) || undefined;
  });
  def(Object, 'fromEntries', function (l) {
    var o = {};
    Array.from(l).forEach(function (e) { o[e[0]] = e[1]; });
    return o;
  });
  def(String.prototype, 'replaceAll', function (a, b) {
    return a instanceof RegExp ? this.replace(a, b) : this.split(a).join(b);
  });
  def(String.prototype, 'trimStart', String.prototype.trimLeft);
  def(String.prototype, 'trimEnd', String.prototype.trimRight);
  def(String.prototype, 'matchAll', function (re) {
    var r = new RegExp(re.source, re.flags.indexOf('g') < 0 ? re.flags + 'g' : re.flags);
    var s = String(this), out = [], m;
    while ((m = r.exec(s))) { out.push(m); if (m[0] === '') r.lastIndex++; }
    return out[Symbol.iterator]();
  });
})();
