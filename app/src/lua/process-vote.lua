local votes = KEYS[1]
local leaderboard = KEYS[2]
local pubsub = KEYS[3]

local timestamp = ARGV[1]
local choice = ARGV[2]

-- add the vote to the full list
redis.call("LPUSH", votes, '{"ts":' .. timestamp .. ', "choice":"' .. choice .. '"}');

-- increment the vote results in the leaderboard
redis.call("ZINCRBY", leaderboard, 1, choice);

-- now, we will retrieve the votes and broadcast
local result = {}
local count = 0
local nextKey
local tmp = redis.call("ZREVRANGEBYSCORE", leaderboard, "+inf", "-inf", "WITHSCORES");
for i, v in ipairs(tmp) do
    if i % 2 == 1 then
        nextKey = v
    else
        count = count + 1
        table.insert(result, {
            choice = nextKey,
            votes = tonumber(v)
        });
    end
end

redis.call("PUBLISH", pubsub, cjson.encode(result));
return cjson.encode(result)
