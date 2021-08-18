import config from "./config"
import express from "express"
import { getLogger } from "./lib/logger"
import { connect as initializeRedis } from "./lib/redis"
import * as websockets from "./websockets"
import * as controller from "./controller"
import http from "http"
import WebSocket from "ws"

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

    // whenever a command is received from a websocket, process it here
    websockets.command(function (ws: WebSocket, cmd: any) {
        const { action, info } = cmd;
        if (action === "vote") {
            // we send the vote to be stored
            controller.vote(info)
                .then(() => ws.send("ok"));
        }
    });

    controller.bus.on("scores", (votes: any[]) => {
        websockets.broadcast({
            topic: "votes",
            data: votes
        });
    });

	// start listening for traffic
	server.listen(config.app.port, function () {
		logger.info(`listening on port: ${config.app.port}`);
	})
}

async function bootstrap(app: Express.Application) {
	// initialize redis connection
	const redisLogger = getLogger("redis", config.app);
	await initializeRedis(config.redis, redisLogger);
	logger.debug("redis initialized");

    // initialize websockets
    await websockets.initialize(server);
    logger.debug("websockets initialized");

    await controller.initialize();
}
