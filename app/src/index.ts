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

    // on a new connection, we need to send the current scores
    websockets.bus.on("connect", async function (ws: WebSocket) {
        const votes = await controller.getVotes();
        ws.send(JSON.stringify({ topic: "votes", data: votes }));
    });

    // whenever a command is received from a websocket, process it here
    websockets.bus.on("command", function (ws: WebSocket, cmd: any) {
        const { action, info } = cmd;
        if (action === "vote") {
            // we send the vote to be stored
            controller.vote(info)
                .then(() => ws.send("ok"));
        } else if (action === "reset") {
            controller.reset()
                .then(() => {
                    ws.send("ok");
                    websockets.broadcast({
                        topic: "votes",
                        data: [],
                    });
                })
        }
    });

    // whenever redis broadcasts a new score update, we will relay the
    // results to all connected clients
    controller.bus.on("scores", (votes: object[]) => {
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
