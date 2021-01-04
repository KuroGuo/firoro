const electronInstaller = require('electron-winstaller')
const path = require('path')

const iconPath = path.normalize(`${__dirname}/icon.ico`)

resultPromise = electronInstaller.createWindowsInstaller({
  appDirectory: 'zencoin-win32-x64',
  authors: 'Zenplan',
  exe: 'zencoin.exe',
  setupExe: 'zencoin.exe',
  noMsi: true,
  iconUrl: iconPath,
  setupIcon: iconPath
})

resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`))
