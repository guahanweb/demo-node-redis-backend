const { EventEmitter } = require("events");
const redis = require("redis");
const crypto = require("crypto");

class RedisConnector extends EventEmitter {
  constructor() {
    super();
    this.connectFailCount = 0;
    this.scriptList = [];
    this.scripts = {};

    this.connRetryLimit = 5;
  }

  /**
   * Initialize the Redis client connector and monitor standard events
   */
  init(config: any) {
    this.config = config;
    if (config && config.retryLimit) {
      this.connRetryLimit = config.retryLimit;
    }

    if (config && config.endpoint) {
      this.client = redis.createClient(config.endpoint);
    } else {
      this.client = redis.createClient(config.port, config.host);
    }

    this.client.on("connect", handleConnect.bind(this));
    this.client.on("error", handleError.bind(this));
  }

  createClient() {
    let client;
    if (this.config && this.config.endpoint) {
      client = redis.createClient(this.config.endpoint);
    } else {
      client = redis.createClient(this.config.port, this.config.host);
    }
    return client;
  }

  /**
   * Queues up a script to be registered into Redis cache for use with EVALSHA
   *
   * @param {string} name the friendly name of the function
   * @param {string} content script content to be cached in redis
   */
  addScript(name: string, content: string) {
    this.scriptList.push({ name, content });
    this.scripts[name] = crypto
      .createHash("sha1")
      .update(content)
      .digest("hex");
  }

  /**
   * Executes a script based on the friendly name used at registration time.
   *
   * @param {string} name the friendly name of the cached function to execute
   * @param {array} keys optional list of keys used in the script
   * @param {array} props optional list of arguments to pass to the script
   */
  execScript(name: string, keys = [], props = []) {
    const hash = this.scripts && this.scripts[name];

    return new Promise((resolve, reject) => {
      if (!hash) {
        return reject("Requested script was not registered");
      }

      const args: any = [keys.length, ...keys, ...props];

      args.unshift(hash);
      args.push(function (err: Error|null, res: any) {
        if (err) {
          return reject(err);
        }
        resolve(res);
      });

      this.client.evalsha.apply(this.client, args);
    });
  }
}

/**
 * Synchronizes all local scripts into the Redis cache for use with EVALSHA.
 * Starts by doing a SCRIPT EXISTS check on all registered sha1 hashes. If
 * scripts are not in cache, we will put them there so all instances can
 * reference them.
 */
function syncLuaScripts(this: RedisConnector) {
  const self = this;
  const client = this.client;

  /**
   * Execute SCRIPT LOAD to push script into Redis cache and verify the
   * resulting sha1 hash matches our calculated one.
   *
   * @param {string} content script content to be cached
   * @param {string} hash calculated sha1 for script
   */
  function uploadAndVerify(content: string, hash: string) {
    return new Promise((resolve, reject) => {
      client.script("load", content, function (err: Error|null, res: any) {
        if (err) {
          reject(err);
        } else if (res !== hash) {
          reject("loaded script does not match sha1");
        } else {
          resolve(res);
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    // argument list contains all scripts registered with our app
    const args = Object.keys(this.scripts).map((k) => this.scripts[k]);
    // prefix the EXISTS command, since we're using fn.apply()
    args.unshift("exists");
    // add handler function to LOAD all nonexistent scripts
    args.push(function (err: Error|null, fns: any) {
      if (err) {
        return reject(err);
      }

      // we want to be sure all LOAD calls have succeeded before we're ready
      Promise.all(
        // set up an array of only nonexistent registered functions
        fns
          .map((exists: boolean, index: number) => {
            if (exists) return null;
            const current = self.scriptList[index];
            return uploadAndVerify(current.content, self.scripts[current.name]);
          })
          .filter((fn: Function) => fn !== null)
      )
        .then(resolve)
        .catch(reject);
    });

    // execute the EXISTS and corresponding LOAD for our scripts
    client.script.apply(client, args);
  });
}

/**
 * Default connection handler that synchronizes all registered scripts before bubbling
 * the ready state to our application.
 */
function handleConnect(this: RedisConnector) {
  syncLuaScripts
    .call(this)
    .then(() => {
      this.emit("ready");
    })
    .catch((err) => {
      this.emit("fatal", err);
    });
}

/**
 * Generic error handler for our Redis client. We will explicitly check for ECONNREFUSED
 * to allow for a specified number of retries before failing completely.
 *
 * @param {Error} err
 */
function handleError(this: RedisConnector, err: any) {
  const { code, syscall } = err;
  if (code === "ECONNREFUSED" && syscall === "connect") {
    this.connectFailCount++;
    if (this.connectFailCount >= this.connRetryLimit) {
      // exceeded connection retry limit
      this.emit("fatal", "exceeded retry limit without connecting");
    }
  } else {
    // on unhandled error, bubble it up
    this.emit("error", err);
  }
}

// Return only a single instance for customization and script registration
export default RedisConnector;
