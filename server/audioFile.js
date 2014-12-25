var logger = require('logger');
var metadata = require('ffmetadata');
var util = require('util');

var i = 0;
var AudioFile = function(path) {
	var self = this;
	self.id = i;
	i++;
	self.path = path;
	self.metadata = {};
	self.metadataCallback = [];
	self.readMetadata();
}

AudioFile.prototype.readMetadata = function() {
	var self = this;
	metadata.read(self.path, function(err, data) {
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

AudioFile.prototype.updateMetadata = function(data) {
	var self = this;
	metadata.write(this.path, data, function(err) {
		if (err) {
			logger.debug("Error writing metadata", err)
		}
		else {
			logger.debug(util.format("Updated %s metadata %s", self.path, data));
			self.readMetadata();
		}
	});
};

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
