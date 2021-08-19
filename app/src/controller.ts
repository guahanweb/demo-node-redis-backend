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

// retrieve and format the current total votes
export function getVotes() {
    const { client } = redis.getClient();
    return new Promise((resolve, reject) => {
        client.zrevrangebyscore(
            keys.leaderboard,
            "+inf",
            "-inf",
            "withscores",
            function (err: Error, reply: any) {
                if (err) {
                    return reject(err);
                }

                let result: object[] = [];
                for (let i = 0; i < reply.length; i += 2) {
                    result.push({
                        choice: reply[i],
                        votes: parseInt(reply[i+1]),
                    });
                }
                resolve(result);
            }
        );
    })
}

export function reset() {
    const { client } = redis.getClient();
    return new Promise((resolve, reject) => {
        // we are only clearing the leaderboard
        // all time historical votes are not impacted
        client.del(
            keys.leaderboard,
            function (err: Error, reply: any) {
                if (!!err) {
                    return reject(err);
                }
                resolve(reply);
            }
        )
    })
}
