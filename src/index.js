const { Client } = require('cozy-client-js')
const token = require('./token.json').token
// const fetchSncf = require('./sncf.js')

import Cheerio from 'cheerio'

const options = {
	cozyURL: 'https://testchristophe.cozy.works',
	token,
}

const cozyClient = new Client(options)

async function start() {
	// await fetchSncf({ folderPath: '/testtext' }, cozyClient)
	await testOneFile()
}
start()

async function testOneFile() {
	const result = await fetch(
		`https://www.oui.sncf/espaceclient/ordersconsultation/showOrdersForAjaxRequest?pastOrder=true&cancelledOrder=false&pageToLoad=1&_=${Date.now()}`,
		{
			credentials: 'include',
			referrer: 'https://www.oui.sncf/espaceclient/commandes-en-cours',
		}
	)
	console.log('result', result)
	const $ = Cheerio.load(await result.text())
	const links = Array.from(
		$(`.show-for-small-only a[title='Justificatif']`)
	).map((e) => $(e).attr('href'))

	const filelink = links.pop().replace(':80', '').replace('http', 'https')
	console.log('filelink', filelink)
	const file = await (await fetch(filelink)).blob()
	console.log('file', file)
	const resultFile = await cozyClient.files.create(file, {
		name: 'test.pdf',
		dirID: '3fec24be92d97411f4f8c434841aa3b0',
	})
	console.log('resultFile', resultFile)
}
