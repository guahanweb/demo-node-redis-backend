import EventEmitter from "events"
import WebSocket from "ws"
import { getLogger } from "./lib/logger"
import config from "./config"

const logger = getLogger("websockets", config.app);

export const bus = new EventEmitter;

let wss: WebSocket.Server;
let initialized: boolean = false;

// initialize the websocket server and listen for connections
export async function initialize(server: any) {
    if (!initialized) {
        wss = new WebSocket.Server({ server });
        
        wss.on("connection", (ws: WebSocket) => {
            // handle inbound messages
            ws.on("message", handleMessage);
            // emit a connection for any initialization messages
            bus.emit("connect", ws);
        });

        initialized = true;
    }
}

// basic message parsing
// example: c::{"action":"vote","choice":"smile"}
function handleMessage(this: WebSocket, buffer: Buffer, isBinary: boolean) {
    const ws = this;
    const message = buffer.toString();
    const [ type, data ] = message.split("::");
    const payload = !!data ? JSON.parse(data) : null;

    switch (type) {
        case "c":
            // command signal
            bus.emit("command", ws, payload);
        default:
            logger.debug(`Unknown message: ${message}`);
    }
}

// enable broadcasting to all connected sockets
export async function broadcast(data: any, isBinary: boolean = false) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data), { binary: isBinary });
        }
    });
}
