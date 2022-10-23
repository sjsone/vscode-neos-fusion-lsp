import EventEmitter = require('events');
import { ProgressLocation, window } from 'vscode';

export interface ProgressPayload {
	message?: string
	increment?: number
}

export class ProgressNotification {
	protected progressValue = 0
	protected eventEmitter = new EventEmitter

	constructor(title?: string) {
		window.withProgress({
			cancellable: false,
			location: ProgressLocation.Notification,
			title
		}, (progress) => new Promise((resolve) => {
			this.eventEmitter.addListener("update", (payload) => {
				progress.report(payload)
				if (payload.increment) this.progressValue += payload.increment
				if (this.progressValue >= 100) resolve(this.progressValue)
			})
			this.eventEmitter.addListener("finish", () => {
				resolve(this.progressValue)
			})
		}))
	}

	update(payload: ProgressPayload) {
		this.eventEmitter.emit("update", payload)
	}

	finish() {
		this.eventEmitter.emit("finish")
	}
}


export class ProgressNotificationService {
	protected progressNotifications: Map<string, ProgressNotification> = new Map()

	create(id: string, title?: string) {
		const progressNotification = new ProgressNotification(title)
		this.progressNotifications.set(id, progressNotification)
	}

	update(id: string, payload: ProgressPayload) {
		if (!this.progressNotifications.has(id)) return undefined
		const progressNotification = this.progressNotifications.get(id)
		progressNotification.update(payload)
	}

	finish(id: string) {
		if (!this.progressNotifications.has(id)) return undefined
		const progressNotification = this.progressNotifications.get(id)
		progressNotification.finish()
	}
}