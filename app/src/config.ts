import dotenv from "dotenv"
import fs from "fs"
import path from "path"

const configuration = init();
export default configuration;

interface AppConfig {
	env: string,
	appName: string,
	logLevel: string,
	port: number,
	redisEndpoint: string,
}

interface RedisConfig {
	host: string,
	port: number,
	endpoint: string,
	retryLimit: number,
	scriptsDir: string,
}

interface BackendConfig {
	app: AppConfig,
	redis: RedisConfig,
}

function init(): BackendConfig {
	let env: string = loadEnvironment();
	return {
		app: loadAppConfig(env),
		redis: loadRedisConfig(),
	}
}

function loadAppConfig(env: string): AppConfig {
	return {
		env,
		appName: getEnvValue("APP_NAME", "backend"),
		logLevel: getEnvValue("LOG_LEVEL", "info"),
		port: parseInt(getEnvValue("PORT", 3000)),
		redisEndpoint: getEnvValue("REDIS_ENDPOINT", "http://localhost:6379"),
	}
}

function loadRedisConfig(): RedisConfig {
	const host = getEnvValue("REDIS_HOST", "localhost");
	const port = parseInt(getEnvValue("REDIS_PORT", 6379));
	const endpoint = getEnvValue("REDIS_ENDPOINT", `redis://${host}:${port}`);
	const retryLimit = parseInt(getEnvValue("REDIS_RETRY_LIMIT", 3));
	const scriptsDir = path.resolve(getEnvValue("REDIS_SCRIPTS_DIR", "./src/lua"));

	return {
		host,
		port,
		endpoint,
		retryLimit,
		scriptsDir,
	}
}

function loadEnvironment(): string {
	let env = getEnvValue("NODE_ENV", "development").toString();

	let supportedFiles = [`.env.${env}`, ".env"].map((file) => path.resolve(__dirname, "..", file));
	let loaded = false;
	supportedFiles.forEach((file) => {
		if (!loaded && fs.existsSync(file)) {
			dotenv.config({ path: file });
			loaded = true;
		}
	})

	return env;
}

function getEnvValue(variable: string, defaultValue: any) {
	const value = process.env && process.env[variable];
	return value || defaultValue;
}
