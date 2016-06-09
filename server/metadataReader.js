var metadata = require('ffmetadata');
var maxOpenReads = 200;

/*
	Queues all metadata requests to limit concurrent file reads
*/
var Reader = function() {
	this.c = 0;
	this.queue = [];
};

Reader.prototype.read = function(path, callback) {
	this.queue.push({path: path, callback: callback});
	this.tick();
};

Reader.prototype.tick = function() {
	var self = this;
	if (this.queue.length > 0 && this.c < maxOpenReads) {
		this.c++;
		var work = this.queue.pop();
		metadata.read(work.path, function(err, data) {
			work.callback.call(this, err, data);
			self.tick();
			self.c--;
		});
	}
};

module.exports = new Reader();
