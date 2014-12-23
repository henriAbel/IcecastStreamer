var metadata = require('ffmetadata');

var AudioFile = function(path) {
	var self = this;
	self.path = path;
	self.metadata = {};
	self.metadataCallback = [];
	metadata.read(path, function(err, data) {
		if (!err) {
			self.metadata = data;
			if (self.metadataCallback.length > 0) {
				self.metadataCallback.forEach(function(callback) {
					callback.call(self, data);
				});
				self.metadataCallback = [];
			}
		}
	});

}

AudioFile.prototype.getMetadata = function(callback) {
	// Check if metadata is empty
	if (Object.keys(this.metadata).length === 0) {
		this.metadataCallback.push(callback);
	}
	else {
		callback.call(this, this.metadata);
	}
};

module.exports = AudioFile;
