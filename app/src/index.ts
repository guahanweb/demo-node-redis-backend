import config from "./config"
import express from "express"
import { getLogger } from "./lib/logger"
import { connect as initializeRedis } from "./lib/redis"

const logger = getLogger("main", config.app);
const app = express();

// execute the main program
logger.debug("starting app");
main();

async function main() {
	// bootstrap any necessary connections
	await bootstrap(app);
	logger.debug("bootstrap completed");

	// start listening for traffic
	app.listen(config.app.port, function () {
		logger.info(`listening on port: ${config.app.port}`);
	})
}

async function bootstrap(app: Express.Application) {
	// initialize redis connection
	const redisLogger = getLogger("redis", config.app);
	await initializeRedis(config.redis, redisLogger);
	logger.debug("redis initialized");
}