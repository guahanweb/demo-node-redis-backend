import fs from "fs"
import path from "path"
import RedisConnector from "./redis"

let initialized = false;
let redis = new RedisConnector();

export function connect(config: any, logger: any) {
	return new Promise((resolve, reject) => {
		redis.on("fatal", (err: Error) => {
			logger.error("fatal error encountered: " + err);
			if (!initialized) {
				return reject(err);
			}
		})

		redis.on("error", (err: Error) => {
			logger.error("error encountered: " + err);
		})

		redis.on("ready", (instance: any) => {
			logger.info("connected to host");
			return resolve(instance);
		})

		// if we are configured to add lua scripts, set them up
		const { scriptsDir = null } = config;
		if (scriptsDir !== null) {
			if (!fs.existsSync(scriptsDir)) {
				const err = new Error("provided lua scripts directory does not exist: " + scriptsDir);
				logger.error(err.message);
				return reject(err);
			}

			// load scripts into redis
			const scripts = fs.readdirSync(scriptsDir);
			scripts.forEach(filename => {
				const extName = path.extname(filename);
				if (extName === "lua") {
					// we will inject all .lua scripts into the redis instance
					const scriptName = filename.split(".").slice(0, -1).join(".");
					const scriptContent = fs.readFileSync(path.resolve(scriptsDir, filename)).toString();
					redis.addScript(scriptName, scriptContent);
				}
			});
		}

		redis.init(config);
		initialized = true;
	});
}

export function getClient() {
	if (!initialized) {
		throw new Error("cannot retrieve redis client before initialization");
	}
	return redis;
}

export function clearAll() {
	return new Promise((resolve) => {
		redis.client.flushdb(resolve);
	});
}

export function quit() {
	if (initialized) {
		redis.client.quit();
	}
}
