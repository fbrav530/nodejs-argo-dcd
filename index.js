const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

// 自动获取云平台分配的端口，默认 3000
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const FILE_PATH = process.env.FILE_PATH || './tmp';
const BIN_NAME = 'xts';
const BIN_PATH = path.join(FILE_PATH, BIN_NAME);

// 1. 创建运行目录
if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(FILE_PATH, { recursive: true });
}

// 2. 判断系统架构并匹配下载链接
function getDownloadUrl() {
    const arch = os.arch();
    if (arch === 'x64' || arch === 'amd64') {
        console.log("检测到 Linux amd64 (x86_64) 架构...");
        return "https://github.com/fbrav530/one-myweb64/raw/refs/heads/main/app/xts";
    } else if (arch === 'arm64' || arch === 'aarch64') {
        console.log("检测到 Linux arm64 (aarch64) 架构...");
        return "https://github.com/fbrav530/one-myweb64/raw/refs/heads/main/app/xtsa";
    } else {
        console.error(`不支持的系统架构: ${arch}`);
        process.exit(1);
    }
}

// 3. 原生 HTTPS 下载函数（完美支持 GitHub 的 302 重定向）
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // 自动处理 GitHub 文件的重定向跳转
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败，HTTP 状态码: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve());
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

// 主运行逻辑
async function main() {
    try {
        const downloadUrl = getDownloadUrl();
        console.log(`开始从 GitHub 下载 xts 二进制文件...`);
        await downloadFile(downloadUrl, BIN_PATH);
        console.log(`下载成功，文件保存至: ${BIN_PATH}`);

        // 赋予二进制文件可执行权限 (755)
        fs.chmodSync(BIN_PATH, 0o755);
        console.log(`成功赋予执行权限`);

        // 4. 在前台启动 xts 并死守进程，将日志直接实时输出到云平台控制台
        console.log(`正在启动 xts，当前锁定监听地址: ws://0.0.0.0:${PORT}/ggjj`);
        const args = ['-l', `ws://0.0.0.0:${PORT}/ggjj`, '-token', 'sliao530'];
        
        // 使用 inherit 让 xts 的日志直接打印在 dcdeploy 的日志面板上
        const child = spawn(BIN_PATH, args, { stdio: 'inherit' });

        child.on('close', (code) => {
            console.log(`xts 进程意外退出，退出码: ${code}`);
            process.exit(code);
        });

        child.on('error', (err) => {
            console.error('xts 启动失败:', err);
            process.exit(1);
        });

    } catch (error) {
        console.error('脚本运行中发生错误:', error);
        process.exit(1);
    }
}

main();
