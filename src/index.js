/* eslint-disable no-console */

import ky from 'ky'
import Cheerio from 'cheerio'

window.addEventListener('DOMContentLoaded', () => {
  start()
})
async function start() {
  const isLogin = await testLogin()
  if (!isLogin) {
    console.info('Not logged in')
    return
  }

  const commands = await fetchCommands()
  console.log('commands', commands)

  window.postMessage({ message: 'file', value: commands }, '*')
}

async function fetchCommands() {
  const resp = await ky
    .get(
      `https://www.oui.sncf/espaceclient/ordersconsultation/showOrdersForAjaxRequest?pastOrder=true&cancelledOrder=false&pageToLoad=1&_=${Date.now()}`
    )
    .text()

  const $ = Cheerio.load(resp)
  const links = Array.from(
    $(`.show-for-small-only a[title='Justificatif']`)
  ).map((e) => $(e).attr('href'))

  const filelink = links.pop().replace(':80', '').replace('http', 'https')
  const file = await ky.get(filelink).blob()
  return file
}
async function testLogin() {
  const resp = await ky.get(
    'https://www.oui.sncf/espaceclient/commandes-en-cours'
  )

  return !resp.redirected
}

start().catch((err) => console.error(err))
