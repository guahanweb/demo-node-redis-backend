const EventEmitter = require("events");
const redis = require("./lib/redis");

const keys = {
    votes: "demo:votes",
    leaderboard: "demo:leaderboard",
    pubsub: "demo:pubsub",
};

export const bus = new EventEmitter();

export function initialize() {
    const client = redis.createClient();
    client.subscribe(keys.pubsub);
    client.on("message", function (channel: string, message: any) {
        if (channel === keys.pubsub) {
            const votes = JSON.parse(message);
            bus.emit("votes", votes);
        }
    });
}

export async function vote(choice: string) {
    const client = redis.getClient();
    const now = new Date();

    await client.execScript(
        "process-vote",
        [
            keys.votes,
            keys.leaderboard,
            keys.pubsub,
        ],
        [
            now.getTime(),
            choice,
        ]
    );
}
