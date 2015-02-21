var through = require('through2');
var uniq = require('uniq');
var debug = require('debug')('bant:factor');
var Readable = require('stream').Readable;
var combine = require('stream-combiner');
var depsTopoSort = require('deps-topo-sort');

module.exports = function (opts) {
  if (!opts) opts = {};

  var rmap_ = opts.resolveMap || {},
      files = opts.files,
      tr = through.obj(write, end),
      groups_ = {},
      streams = {},
      commons = {},
      threshold = opts.threshold || 1;

  function createStream (row, groups) {
    if (!streams[row.id]) {
      var s = new Readable({ objectMode: true });
      s.file = rmap_[row.id] || row.id;
      s._read = function () {};
      streams[s.file] = s;
      groups.push(s.file);
      tr.emit('stream', s);
    }
  }

  function write (row, enc, cb) {
    var groups = uniq(groups_[row.id] || []);
    var id = rmap_[row.id] || row.id;

    if ((!files && row.entry) || (files && files[id]))
      createStream(row, groups);

    if (commons[row.id] || (groups.length > threshold || groups.length === 0)) {
      Object.keys(row.deps).forEach(function (key) {
        commons[row.deps[key]] = true;
      });
      this.push(row);
    } else {
      groups.forEach(function (id) {
        streams[id].push(row);
      });
    }
    
    groups.forEach(function (id) {
      Object.keys(row.deps || {}).forEach(function (key) {
        var file = row.deps[key];
        var group = groups_[file];
        if (!group) group = groups_[file] = [];
        group.push(id);
      });
    });

    cb();
  }

  function end () {
    Object.keys(streams).forEach(function (key) {
      streams[key].push(null);
    });
    this.push(null);
  }

  var data_ = [];

  var dup = combine(depsTopoSort(), 
      through.obj(function (row, enc, cb) {
        data_.push(row);
        cb();
      }, function () {
        for (var i = 0, l = data_.length; i < l; i++) {
          this.push(data_.pop());
        }
        this.push(null);
      }), tr);

  tr.on('error', function (err) { dup.emit('error', err); });
  tr.on('stream', function (s) { dup.emit('stream', s); });

  return dup;
}
