if (require('electron-squirrel-startup')) return

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const contextMenu = require('electron-context-menu')
const zmq = require("zeromq")
const path = require('path')
const url = require('url')
const fs = require('fs')
const child_process = require("child_process")
const prompt = require('electron-prompt')

const appdatadir = process.env.APPDATA || (process.platform === 'darwin' ? path.normalize(`${process.env.HOME}/Library/Preferences`) : '/var/local')
const firodir = path.normalize(`${appdatadir}/firo`)
const walletDatPath = path.normalize(`${firodir}/wallet.dat`)

const statusSock = new zmq.Subscriber
const requesterSocket = new zmq.Request
const publisherSocket = new zmq.Subscriber

const winDevFiroDataDir = 'f:\\firoclient3'

const firod = child_process.spawn(
  path.normalize('./assets/core/win/firod.exe'),
  [
    '-clientapi=1',
    '-testnet',
    `-datadir=${winDevFiroDataDir}`
  ]
)

let mainWindow, setPasswordDialog, sendcoinsPasswordDialog

let blockchainInfo, keepUpdating

init()

async function init() {
  const [clientPubkey, clientPrivkey] = await readCert(path.join(winDevFiroDataDir + '\\testnet3', "certificates", "client", "keys.json"))
  const serverPubkey = (await readCert(path.join(winDevFiroDataDir + '\\testnet3', "certificates", "server", "keys.json")))[0]

  for (let s of [requesterSocket, publisherSocket]) {
    s.curveServerKey = serverPubkey
    s.curvePublicKey = clientPubkey
    s.curveSecretKey = clientPrivkey
  }

  statusSock.connect("tcp://127.0.0.1:28333")
  statusSock.subscribe("apiStatus")
  console.log("statusSock Subscriber connected to port 28333")
  ;(async () => {
    for await (let [topic, msg] of statusSock) {
      console.log("received a message related to:", topic.toString(), "containing message:", msg.toString())
      msg = JSON.parse(msg.toString())
      const blocks = msg.data.blocks > 0 ? msg.data.blocks : null
      const { synced, walletLock, walletinitialized } = msg.data
      console.log('blocks', blocks)
      console.log('synced', synced)
      mainWindow.webContents.send('status-updated', { blocks, synced, walletLock, walletinitialized })
    }
  })()

  requesterSocket.connect("tcp://127.0.0.1:25557")
  console.log("requesterSocket connected to port 25557")

  const poll = async () => {
    await update()
    keepUpdating = setTimeout(poll, 3000)
  }
  poll()

  publisherSocket.connect("tcp://127.0.0.1:28332")
  publisherSocket.subscribe("rpc")
  console.log("publisherSocket Subscriber connected to port 28332")

  for await (let [topic, msg] of publisherSocket) {
    console.log("received a message related to:", topic.toString(), "containing message:", msg.toString())
  }
}

ipcMain.on('backupwallet', () => {
  dialog.showSaveDialog({
    title: '备份钱包文件',
    defaultPath: 'wallet.dat'
  }, filename => {
    if (!filename) return
    fs.copyFile(walletDatPath, filename, err => {
      if (err) throw err
    })
  })
})

ipcMain.on('showMessageBox', () => {
  prompt({
      title: '输入密码',
      label: '密码',
      inputAttrs: {
        type: 'password'
      },
      type: 'input',
      alwaysOnTop: true,
      height: 180,
      icon: 'icon.ico'
  })
  .then((r) => {
      if(r === null) {
          console.log('user cancelled')
      } else {
          console.log('result', r)
      }
  })
  .catch(console.error)
})

ipcMain.on('showSetPasswordDialog', (e, hasOld) => {
  setPasswordDialog = new BrowserWindow({
    title: '设置密码',
    parent: mainWindow,
    width: 400,
    height: hasOld ? 225 : 177,
    minWidth: 400,
    minHeight: hasOld ? 225 : 177,
    icon: 'icon.ico',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      spellcheck: false
    },
    modal: true,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    backgroundColor: '#21252b'
  })
  setPasswordDialog.once('ready-to-show', () => {
    setPasswordDialog.webContents.send('setWindowData', 'dialogType', 'setPassword')
    if (!hasOld) {
      setPasswordDialog.webContents.send('addClassToBody', 'hide-current')
    }
    setPasswordDialog.show()
  })
  setPasswordDialog.setMenuBarVisibility(false)
  setPasswordDialog.loadURL(url.format({
    pathname: path.join(__dirname, 'password.html'),
    protocol: 'file',
    slashes: true
  }))
})

ipcMain.on('submitSetPassword', async (e, oldpassword, newpassword) => {
  console.log('submitSetPassword', oldpassword, newpassword)
  await requesterSocket.send(JSON.stringify({
    auth: oldpassword ? {
      passphrase: oldpassword, newPassphrase: newpassword
    } : {
      passphrase: newpassword
    },
    type: oldpassword ? 'update' : 'create',
    collection: 'setPassphrase',
    data: null
  }))
  const res = JSON.parse((await requesterSocket.receive())[0].toString())
  console.log('submitSetPassword response: ', res)
  if (res.error && res.error.message) return dialog.showMessageBox({
    title: '错误', message: res.error.message, type: 'error'
  })
  if (oldpassword) {
    dialog.showMessageBox({
      title: '密码已修改',
      message: '钱包密码修改成功。'
    })
  } else {
    dialog.showMessageBoxSync({
      title: '钱包已加密',
      message: '钱包加密成功。钱包现在要关闭，以完成加密过程。请注意，加密钱包不能完全防止入侵你的电脑的恶意程序偷取钱币。'
    })
  }
})

ipcMain.on('showSendcoinsPasswordDialog', (e, address, amount) => {
  sendcoinsPasswordDialog = new BrowserWindow({
    title: '输入密码',
    parent: mainWindow,
    width: 400,
    height: 129,
    minWidth: 400,
    minHeight: 129,
    icon: 'icon.ico',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      spellcheck: false
    },
    modal: true,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    backgroundColor: '#21252b'
  })
  sendcoinsPasswordDialog.once('ready-to-show', () => {
    sendcoinsPasswordDialog.webContents.send('addClassToBody', 'only-current')
    sendcoinsPasswordDialog.webContents.send('setWindowData', 'dialogType', 'sendcoins')
    sendcoinsPasswordDialog.webContents.send('setWindowData', 'address', address)
    sendcoinsPasswordDialog.webContents.send('setWindowData', 'amount', amount)
    sendcoinsPasswordDialog.show()
  })
  sendcoinsPasswordDialog.setMenuBarVisibility(false)
  sendcoinsPasswordDialog.loadURL(url.format({
    pathname: path.join(__dirname, 'password.html'),
    protocol: 'file',
    slashes: true
  }))
})

ipcMain.on('sendcoins', async (e, address, amount, password) => {
  console.log('sendcoins', address, amount, password, JSON.stringify({
    auth: {
      passphrase: password
    },
    type: 'create',
    collection: 'sendLelantus',
    data: {
      recipient: address,
      amount: amount * 100000000,
      subtractFeeFromAmount: false
    }
  }))

  await requesterSocket.send(JSON.stringify({
    auth: {
      passphrase: password
    },
    type: 'create',
    collection: 'sendLelantus',
    data: {
      recipient: address,
      amount: amount * 100000000,
      subtractFeeFromAmount: false,
      feePerKb: 0
    }
  }))
  const res = JSON.parse((await requesterSocket.receive())[0].toString())
  console.log('sendcoins response: ', res)
  if (res.error && res.error.message) return dialog.showMessageBox({
    title: '错误', message: res.error.message, type: 'error'
  })
})

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 730,
    height: 451,
    minWidth: 730,
    minHeight: 451,
    icon: 'icon.ico',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      spellcheck: false
    },
    show: false,
    backgroundColor: '#21252b'
  })

  mainWindow.once('ready-to-show', () => { mainWindow.show() })

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file',
    slashes: true
  }))

  // mainWindow.webContents.openDevTools()

  mainWindow.on('close', async e => {
    e.preventDefault()
    if (!blockchainInfo) {
      closeAllSockets()
      return app.exit()
    }
    closeAllSubscribeSockets()
    clearTimeout(keepUpdating)
    mainWindow.webContents.send('exit')
    try {
      await requesterSocket.send(JSON.stringify({
        auth: {
          passphrase: null
        },
        type: 'initial',
        collection: 'stop',
        data: null
      }))
      const res = JSON.parse((await requesterSocket.receive())[0].toString())
      console.log('firod stop response: ', res)
    } catch (err) {
      app.exit()
    }
    closeAllSockets()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.setMenuBarVisibility(false)
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

firod.stdout.on('data', data => {
  console.log(`firod stdout: ${data}`)
})

firod.stderr.on('data', data => {
  console.error(`firod stderr: ${data}`)
})

firod.on('error', err => {
  console.error('firod error: ', err)
  dialog.showMessageBoxSync({
    title: 'firod 错误',
    message: err
  })
})

firod.on('close', code => {
  console.error('firod close: ', code)
  // firod.kill()
  app.exit()
})

firod.on('exit', code => {
  console.log('firod exit: ', code)
})

contextMenu({
  showInspectElement: false,
  showSearchWithGoogle: false,
  labels: {
    cut: '剪切',
		copy: '复制',
		paste: '粘贴'
	}
})

async function readCert(path) {
  let parsed
  let count = 0
  while (!parsed) {
    try {
      parsed = JSON.parse(fs.readFileSync(path).toString())
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    console.log(count++)
  }

  return [parsed.data.public, parsed.data.private]
}

function closeAllSockets() {
  requesterSocket.close()
  statusSock.close()
  publisherSocket.close()
}

function closeAllSubscribeSockets() {
  statusSock.close()
  publisherSocket.close()
}

async function update() {
  await requesterSocket.send(JSON.stringify({
    auth: {
      passphrase: null
    },
    type: 'get',
    collection: 'balance',
    data: null
  }))
  const balances = JSON.parse((await requesterSocket.receive())[0].toString())
  console.log(balances)
  if (balances.error) return mainWindow.webContents.send('request-error', balances.error)
  mainWindow.webContents.send('balances-updated', balances)

  await requesterSocket.send(JSON.stringify({
    auth: {
      passphrase: null
    },
    type: 'none',
    collection: 'paymentRequestAddress',
    data: null
  }))
  const address = JSON.parse((await requesterSocket.receive())[0].toString()).data.address
  mainWindow.webContents.send('address-updated', address)

  await requesterSocket.send(JSON.stringify({
    auth: {
      passphrase: null
    },
    type: 'get',
    collection: 'blockchain',
    data: null
  }))
  blockchainInfo = JSON.parse((await requesterSocket.receive())[0].toString()).data
  console.log('blockchainInfo', blockchainInfo)
  mainWindow.webContents.send('blockchain-updated', blockchainInfo)

  await requesterSocket.send(JSON.stringify({
    auth: {
      passphrase: null
    },
    type: 'get',
    collection: 'stateWallet',
    data: null
  }))
  stateWalletInfo = JSON.parse((await requesterSocket.receive())[0].toString()).data
  console.log('stateWalletInfo', stateWalletInfo)
  mainWindow.webContents.send('statewallet-updated', stateWalletInfo)
}
