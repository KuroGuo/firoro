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

window.backupwallet = () => {
  ipcRenderer.send('backupwallet')
}

window.showMessageBox = async () => {
  ipcRenderer.send('showMessageBox')
}

window.showSetPasswordDialog = hasOld => {
  ipcRenderer.send('showSetPasswordDialog', hasOld)
}

window.closeSetpasswordDialog = () => {
  ipcRenderer.send('closeSetpasswordDialog')
}

window.submitPassword = (oldpassword, newpassword) => {
  ipcRenderer.send('submitPassword', oldpassword, newpassword)
}
