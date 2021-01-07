process.env.SENTRY_DSN =
	process.env.SENTRY_DSN ||
	'https://8f145261a4bd46b9ab2a3b08a4d63d47:66141551cbe848e9ad3b5d6c35022093@sentry.cozycloud.cc/82'

const moment = require('moment-timezone')
const cheerio = require('cheerio')

const { log, saveFiles } = require('cozy-konnector-libs')

module.export = fetch

async function fetch(fields, client) {
	let pastOrders = await getPastOrders()
	pastOrders = pastOrders.map((doc) => {
		const url = doc.fileurl
		delete doc.fileurl
		doc.fetchFile = async () => {
			const resp = await fetch(url, {
				credentials: 'include',
				referrer: 'https://www.oui.sncf/espaceclient/commandes-en-cours',
			})
			return resp.blob()
		}
	})
	await saveFiles(pastOrders, fields, {
		fileIdAttributes: ['vendorRef', 'date', 'amount'],
		client,
	})
}

async function getPastOrders() {
	const $ = await getPastOrderPage()
	return parseOrderPage($)
}

async function getPastOrderPage() {
	log('info', 'Download past orders HTML page...')
	const resp = await fetch(
		'https://www.oui.sncf/espaceclient/ordersconsultation/showOrdersForAjaxRequest?pastOrder=true&pageToLoad=1',
		{
			credentials: 'include',
			referrer: 'https://www.oui.sncf/espaceclient/commandes-en-cours',
		}
	)

	const $ = cheerio.load(await resp.text())
	return $
}

function parseOrderPage($) {
	// Parse the orders page
	const result = []
	const $rows = $('.order')
	$rows.each(function eachRow() {
		const $row = $(this)
		const orderInformations = parseOrderRow($, $row)

		const date = moment(orderInformations.date, 'DD/MM/YYYY')
		const bill = {
			date: date.toDate(),
			amount: parseFloat(orderInformations.amount),
			vendorRef: orderInformations.reference,
			vendor: 'VOYAGES SNCF',
			type: 'transport',
			content: `${orderInformations.label} - ${orderInformations.reference}`,
		}

		if (orderInformations.pdfurl) {
			Object.assign(bill, {
				fileurl: orderInformations.pdfurl,
				filename: getFileName(date),
				fileAttributes: {
					metadata: {
						classification: 'invoicing',
						datetime: date.toDate(),
						datetimeLabel: 'issueDate',
						contentAuthor: 'sncf',
						categories: ['transport'],
						issueDate: date.toDate(),
					},
				},
			})
		}
		result.push(bill)
	})
	return result
}

function parseOrderRow($, $row) {
	const reference = $row
		.find(`.order__detail [data-auto=ccl_orders_travel_number]`)
		.text()
		.trim()
	const label = $row
		.find('.order__top .texte--insecable')
		.map(function mapRow() {
			return $(this).text().trim()
		})
		.get()
		.join('/')
	const date = $row
		.find('.order__detail div:nth-child(2) .texte--important')
		.eq(0)
		.text()
		.trim()
	const amount = $row
		.find('.order__detail div:nth-child(3) .texte--important')
		.eq(0)
		.text()
		.trim()
		.replace(' €', '')

	const result = {
		reference,
		label,
		date,
		amount,
	}

	const $filelink = $row.find('.order__detail a:not([target=_blank])')
	if ($filelink.length > 0) {
		result.pdfurl = $filelink.eq(0).attr('href')
	}

	return result
}

function getFileName(date, suffix = '') {
	return `${moment(date).format('YYYYMMDD')}${suffix}_sncf.pdf`
}
