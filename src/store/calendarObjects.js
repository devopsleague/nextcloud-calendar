/**
 * @copyright Copyright (c) 2019 Georg Ehrke
 *
 * @author Georg Ehrke <oc.list@georgehrke.com>
 * @author John Molakvoæ <skjnldsv@protonmail.com>
 * @author Thomas Citharel <tcit@tcit.fr>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
import Vue from 'vue'
import CalendarObject from '../models/calendarObject'
import logger from '../services/loggerService'

const state = {
	calendarObjects: {},
}

const mutations = {

	/**
	 * Adds an array of calendar-objects to the store
	 *
	 * @param {Object} state The store data
	 * @param {Object[]} calendarObjects Calendar-objects to add
	 */
	appendCalendarObjects(state, calendarObjects = []) {
		for (const calendarObject of calendarObjects) {
			if (calendarObject instanceof CalendarObject) {
				Vue.set(state.calendarObjects, calendarObject.id, calendarObject)
			} else {
				logger.error('Invalid calendarObject object')
			}
		}
	},

	/**
	 * Adds one calendar-object to the store
	 *
	 * @param {Object} state The store data
	 * @param {Object} calendarObject Calendar-object to add
	 */
	appendCalendarObject(state, calendarObject) {
		if (calendarObject instanceof CalendarObject) {
			Vue.set(state.calendarObjects, calendarObject.id, calendarObject)
		} else {
			logger.error('Invalid calendarObject object')
		}
	},

	/**
	 * Removes a calendar-object from the store
	 *
	 * @param {Object} state The store data
	 * @param {Object} calendarObject Calendar-object to add
	 */
	deleteCalendarObject(state, calendarObject) {
		Vue.delete(state.calendarObject, calendarObject.id)
	},

	/**
	 *
	 * @param {Object} state The store data
	 * @param {Object} data destructuring object
	 * @param {CalendarObject} data.calendarObject Calendar-object to delete
	 * @param {String} data.newCalendarId Calendar-Id of calendar to move this calendar-object to
	 */
	moveCalendarObject(state, { calendarObject, newCalendarId }) {
		Vue.set(calendarObject, 'calendarId', newCalendarId)
	}
}

const getters = {

	/**
	 *
	 * @param {Object} state The store data
	 * @returns {CalendarObject[]}
	 */
	getCalendarObjects: (state) => state.calendarObjects,

	/**
	 *
	 * @param {Object} state The store data
	 * @returns {function({Number}): CalendarObject}
	 */
	getCalendarObjectById: (state) => (id) => state.calendarObjects[id]
}

const actions = {

	/**
	 * Moves a calendar-object to a different calendar
	 *
	 * @param {Object} context the store mutations
	 * @param {Object} data destructuring object
	 * @param {CalendarObject} data.calendarObject Calendar-object to delete
	 * @param {String} data.newCalendarId Calendar-Id of calendar to move this calendar-object to
	 * @returns {Promise<void>}
	 */
	async moveCalendarObject(context, { calendarObject, newCalendarId }) {
		if (!calendarObject.dav) {
			return
		}

		const oldCalendarId = calendarObject.calendarId
		const newCalendar = context.getters.getCalendarById(newCalendarId)
		await calendarObject.dav.move(newCalendar)
		context.commit('moveCalendarObject', { calendarObject, newCalendarId })
		context.commit('addCalendarObjectToCalendar', {
			calendar: {
				id: calendarObject.calendarId
			},
			calendarObjectId: calendarObject.id
		})
		context.commit('deleteCalendarObjectFromCalendar', {
			calendar: {
				id: oldCalendarId
			},
			calendarObjectId: calendarObject.id
		})
		context.commit('removeCalendarObjectIdFromAnyTimeRange', {
			calendarObjectId: calendarObject.id
		})
	},

	/**
	 * Update a calendar-object
	 *
	 * @param {Object} context the store mutations
	 * @param {Object} data destructuring object
	 * @param {CalendarObject} data.calendarObject Calendar-object to delete
	 * @returns {Promise<void>}
	 */
	async updateCalendarObject(context, { calendarObject }) {
		if (calendarObject.dav) {
			calendarObject.dav.data = calendarObject.vcalendar.toICS()
			return calendarObject.dav.update()

			// TODO - update time-range
			// TODO - catch conflicts
		}

		const calendar = context.getters.getCalendarById(calendarObject.id)
		calendarObject.dav = await calendar.dav.createVObject(calendarObject.vcalendar.toICS())

		context.commit('appendCalendarObject', { calendarObject })
		context.commit('addCalendarObjectToCalendar', {
			calendar: {
				id: calendarObject.calendarId
			},
			calendarObjectId: calendarObject.id
		})
		// TODO - update time-range
	},

	/**
	 * Delete a calendar-object
	 *
	 * @param {Object} context the store mutations
	 * @param {Object} data destructuring object
	 * @param {CalendarObject} data.calendarObject Calendar-object to delete
	 * @returns {Promise<void>}
	 */
	async deleteCalendarObject(context, { calendarObject }) {
		// If this calendar-object was not created on the server yet,
		// no need to send requests to the server
		if (calendarObject.dav) {
			await calendarObject.dav.delete()
		}

		context.commit('deleteCalendarObject', { calendarObject })
		context.commit('deleteCalendarObjectFromCalendar', {
			calendar: {
				id: calendarObject.calendarId
			},
			calendarObjectId: calendarObject.id
		})
		context.commit('removeCalendarObjectIdFromAnyTimeRange', {
			calendarObjectId: calendarObject.id
		})
	}
}

export default { state, mutations, getters, actions }
