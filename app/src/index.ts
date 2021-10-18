import config from "./config"
import express, { Application, Request, Response } from "express"
import { getLogger } from "./lib/logger"
import { connect as initializeRedis } from "./lib/redis"
import * as websockets from "./websockets"
import * as controller from "./controller"
import http from "http"
import { VotingGame } from "./voting-game"

const logger = getLogger("main", config.app);
const app = express();
const server = http.createServer(app);

// execute the main program
logger.debug("starting app");
main();

async function main() {
	// bootstrap any necessary connections
	await bootstrap(app);
	logger.debug("bootstrap completed");

    // set up game
    const game = new VotingGame();

	// start listening for traffic
	server.listen(config.app.port, function () {
		logger.info(`listening on port: ${config.app.port}`);
	})
}

async function bootstrap(app: Application) {
	// healthcheck endpoint
	app.get("/healthcheck", (req: Request, res: Response) => res.send("ok"));

	// initialize redis connection
	const redisLogger = getLogger("redis", config.app);
	await initializeRedis(config.redis, redisLogger);
	logger.debug("redis initialized");

    // initialize websockets
    await websockets.initialize(server);
    logger.debug("websockets initialized");

    await controller.initialize();
}
