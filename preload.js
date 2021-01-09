const { ipcRenderer } = require('electron')

console.log(require('electron'))
ipcRenderer.on('status-updated', (...args) => {
  window.onStatusUpdated(...args)
})

ipcRenderer.on('balances-updated', (...args) => {
  console.log('balances-updated', JSON.stringify(args))
  window.onBalancesUpdated(...args)
})

ipcRenderer.on('address-updated', (...args) => {
  console.log('address-updated', JSON.stringify(args))
  window.onAddressUpdated(...args)
})

ipcRenderer.on('blockchain-updated', (...args) => {
  console.log('blockchain-updated', JSON.stringify(args))
  window.onBlockchainUpdated(...args)
})

ipcRenderer.on('request-error', (...args) => {
  window.onRequestError(...args)
})

ipcRenderer.on('exit', () => {
  while (true) {
    window.alert('正在关闭...')
  }
})

ipcRenderer.on('addClassToBody', (e, className) => {
  window.document.body.classList.add(className)
})

ipcRenderer.on('setWindowData', (e, name, data) => {
  window[name] = data
})

window.backupwallet = () => {
  ipcRenderer.send('backupwallet')
}

window.sendcoins = async (address, amount, password) => {
  if (window.walletLocked && !password) {
    ipcRenderer.send('showSendcoinsPasswordDialog', address, amount)
  } else {
    ipcRenderer.send('sendcoins', address, amount, password)
  }
}

window.showSetPasswordDialog = hasOld => {
  ipcRenderer.send('showSetPasswordDialog', hasOld)
}

window.submitPassword = (oldpassword, newpassword) => {
  if (window.dialogType = 'setPassword') {
    ipcRenderer.send('submitSetPassword', oldpassword, newpassword)
  } else if (window.dialogType = 'sendcoins') {
    ipcRenderer.send('sendcoins', oldpassword, newpassword)
  }
}
