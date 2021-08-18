const EventEmitter = require("events");
const redis = require("./lib/redis");

// our redis keys are defined here
const keys = {
    votes: "demo:votes",
    leaderboard: "demo:leaderboard",
    scores: "demo:pubsub:scores",
};

// create an event bus that the calling scripts can listen to
export const bus = new EventEmitter();

/**
 * upon initialization, we will subscribe to our redis topic and relay any messages
 * across our event bus for handling.
 */
export function initialize() {
    const client = redis.createClient();
    client.subscribe(keys.scores);
    client.on("message", function (channel: string, message: any) {
        if (channel === keys.scores) {
            const votes = JSON.parse(message);
            bus.emit("scores", votes);
        }
    });
}

/**
 * upon vote, we will execute a lua script to process the data, increment, and return
 * the summary of the data. additionally, this script will publish the updated vote
 * counts.
 * @param choice {string} the choice from the inbound vote
 */
export async function vote(choice: string) {
    const client = redis.getClient();
    const now = new Date();

    await client.execScript(
        "process-vote",
        [
            keys.votes,
            keys.leaderboard,
            keys.scores,
        ],
        [
            now.getTime(),
            choice,
        ]
    );
}
