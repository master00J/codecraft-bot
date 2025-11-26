const service = require('./service');
const config = require('./config');

module.exports = {
  runTask: service.runTask,
  registry: service.registry,
  queue: service.queue,
  config,
};

