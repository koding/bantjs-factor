var test = require('tape');
var factor = require('..');
var mdeps = require('module-deps');
var pack = require('browser-pack');
var concat = require('concat-stream');
var vm = require('vm');

test('commons', function (t) {
  t.plan(5);

  var d = mdeps();
  var s = d.pipe(factor({ commons: true }));
  d.write({ file: __dirname + '/commons/x.js' });
  d.end({ file: __dirname + '/commons/y.js' });
  
  var packs = '';

  s.on('stream', function (stream) {
    t.ok(1);
    stream.pipe(pack({ raw: true, hasExports: true }))
      .pipe(concat(function (src) {
        packs += src.toString('utf8'); 
      }));
  });

  s.on('data', function (row) {
    t.equal(row.file, __dirname + '/commons/k.js');
  });

  s.pipe(pack({ raw: true, hasExports: true }))
    .pipe(concat(function (src) {
      var res = src.toString('utf8') + packs;
      var ctx = {
        t: t
      };
      vm.runInNewContext(res, ctx);
    }));
});