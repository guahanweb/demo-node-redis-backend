import winston from "winston"
import chalk from "chalk"

function getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
	return o[propertyName];
}

const consoleFormatter = winston.format((info, opts: any) => {
	const { message, service, context, timestamp } = info;

	info.message = [
		getProperty(chalk, opts.color)(`[${service}:${context}]`),
		chalk.gray(`(${timestamp})`),
		message,
	].join(" ");

	return info;
})

let colors = ["magenta", "cyan", "yellow", "green", "red", "white"];
let contexts: string[] = [];
let loggers: any[] = [];

export function getLogger(ctx: string, config: any) {
	if (!contexts.includes(ctx)) {
		let logger = winston.createLogger({
			level: config.logLevel,
			defaultMeta: {
				service: config.appName,
				context: ctx,
			}
		})

		if (["local", "development"].includes(config.env)) {
			// add console debugging for development
			let colIndex: number = loggers.length % colors.length;
			let color: string = colors[colIndex];

			let transport = new winston.transports.Console({
				format: winston.format.combine(
					winston.format.timestamp({
						format: () => (new Date().getTime()).toString(),
					}),
					winston.format.colorize(),
					consoleFormatter({ color }),
					winston.format.simple()
				),
			})

			logger.add(transport);
		} else {
			// standard console logging
			let transport = new winston.transports.Console({
				format: winston.format.combine(
					winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" })
				),
			})

			logger.add(transport);
		}

		contexts.push(ctx);
		loggers.push(logger);
	}

	const index = contexts.indexOf(ctx);
	return loggers[index];
}