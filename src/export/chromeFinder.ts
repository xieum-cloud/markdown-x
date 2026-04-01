import * as fs from 'fs';

/**
 * Auto-detect Chrome/Edge/Chromium on the system.
 */
export function findChromePath(): string | undefined {
    const platform = process.platform;

    if (platform === 'darwin') {
        const paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Arc.app/Contents/MacOS/Arc',
        ];
        return paths.find(p => fs.existsSync(p));
    }

    if (platform === 'win32') {
        const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
        const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
        const localAppData = process.env['LOCALAPPDATA'] || '';

        const paths = [
            `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
            `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
            `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
            `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
            `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
            `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
            `${localAppData}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
        ];
        return paths.find(p => fs.existsSync(p));
    }

    // Linux
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/microsoft-edge',
        '/usr/bin/brave-browser',
    ];
    return paths.find(p => fs.existsSync(p));
}
