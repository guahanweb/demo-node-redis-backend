import WebSocket from "ws"
import { getLogger } from "./lib/logger"
import config from "./config"

const logger = getLogger("websockets", config.app);

let wss: WebSocket.Server;
let initialized: boolean = false;
let handler: Function = () => {}; // default to noop

export async function initialize(server: any) {
    if (!initialized) {
        wss = new WebSocket.Server({ server });
        
        wss.on("connection", (ws: WebSocket) => {
            ws.on("message", handleMessage);
            // immediately send a welcome message to connection
            ws.send("welcome");
        });

        initialized = true;
    }
}

export function command(cb: Function) {
    handler = cb;
}

function handleMessage(this: WebSocket, buffer: Buffer, isBinary: boolean) {
    const ws = this;
    const message = buffer.toString();
    const [ type, data ] = message.split("::");
    const payload = !!data ? JSON.parse(data) : null;

    switch (type) {
        case "c":
            // command signal
            return handler(ws, payload);
        default:
            logger.debug(`Unknown message: ${message}`);
    }
}

export async function broadcast(data: any, isBinary: boolean = false) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data), { binary: isBinary });
        }
    });
}
