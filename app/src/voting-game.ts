import * as websockets from "./websockets"
import * as controller from "./controller"
import WebSocket from "ws"
import { startTimer } from "winston"

interface GameOptions {
    choices?: string[]
    time?: number
}

export class VotingGame {
    running: boolean = false
    gametime: number = 30
    countdown: number = 30
    status: string = "pending"
    options: string[] = []
    auto: boolean = true

    constructor(opts: GameOptions = {}) {
        const { choices, time } = opts;
        if (!!choices) this.options = choices;
        if (!!time) this.gametime = time;
        this.listen();
    }

    listen() {
        const game = this;

        // on a new connection, we need to send the current scores
        websockets.bus.on("connect", async function (ws: WebSocket) {
            const state = await game.getState();
            ws.send(JSON.stringify({ topic: "state", data: state }));
        });

        // whenever a command is received from a websocket, process it here
        websockets.bus.on("command", function (ws: WebSocket, cmd: any) {
            const { action, info } = cmd;
            if (action === "vote") {
                // we send the vote to be stored
                game.vote(info)
                    .then(() => ws.send("ok"));
            } else if (action === "reset") {
                game.reset();
            } else if (action === "start") {
                game.start();
            } else if (action === "stop") {
                game.stop();
            }
        });

        // whenever redis broadcasts a new score update, we will relay the
        // results to all connected clients
        controller.bus.on("scores", async (votes: object[]) => {
            const state = await game.getState(votes);
            websockets.broadcast({
                topic: "state",
                data: state,
            });
        });
    }

    async start(auto = true) {
        if (this.running) {
            throw new Error("Game is arleady running!");
        }

        // reset data first
        await this.reset();

        // set up game start
        let game = this;
        this.auto = auto;
        this.running = true;
        this.status = "running";
        this.countdown = this.gametime;

        // start timer for game
        tick();
        async function tick() {
            websockets.broadcast({
                topic: "timer",
                data: game.countdown,
            });
            game.countdown--;

            // if we are auto-timing the game, tick recursively
            if (auto === true) {
                if (game.countdown >= 0) {
                    // count down every second
                    setTimeout(tick, 1000);
                } else {
                    // we're done, set the game state
                    game.running = false;
                    game.status = "complete";

                    const state = await game.getState();
                    websockets.broadcast({
                        topic: "state",
                        data: state,
                    });
                }
            }
        }
    }

    async stop() {
        if (!this.auto) {
            // final timer at 0 to end game
            this.running = false;
            this.status = "complete";

            const state = await this.getState();
            websockets.broadcast({
                topic: "state",
                data: state,
            });
        }
    }

    vote(choice: string) {
        if (!this.running) throw new Error("Cannot vote while game is idle");
        return controller.vote(choice);
    }

    reset() {
        this.running = false;
        this.status = "pending";

        // remove the current data
        controller.reset()
            .then(() => this.getState())
            .then((state) => {
                websockets.broadcast({
                    topic: "state",
                    data: state,
                });
            });
    }

    async getState(currentVotes?: object[]) {
        const running: boolean = this.running;
        const status: string = this.status;
        // const running: boolean = true;
        // const status: string = "running";
        const countdown: number = this.countdown;
        let votes: any;
        if (typeof currentVotes !== "undefined") {
            votes = currentVotes;
        } else {
            votes = await controller.getVotes();
        }

        return {
            running,
            status,
            countdown,
            votes,
        };
    }
}
