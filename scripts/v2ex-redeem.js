/*
V2EX 手动签到脚本 (修复版)
基于 TypeScript 参考脚本修改

作者: Mikukko
更新时间: 2025-07-07
参考: https://github.com/coolpace/V2EX_Polish
*/

const cookieName = 'V2EX'
const cookieKey = 'chavy_cookie_v2ex'
const lastCheckInKey = 'v2ex_last_checkin_time'
const checkInDaysKey = 'v2ex_checkin_days'
const successText = '每日登录奖励已领取'
const targetTextFragment = '/mission/daily/redeem'
const v2exOrigin = 'https://www.v2ex.com'

// 检查是否为同一天
function isSameDay(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1)
    const date2 = new Date(timestamp2)
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
}

// 处理已签到状态
function handleCheckedIn(htmlText) {
    // 提取连续签到天数
    const matchedArr = htmlText.match(/已连续登录 (\d+) 天/)
    let checkInDays = undefined

    if (matchedArr && matchedArr[1]) {
        const days = Number(matchedArr[1])
        if (!isNaN(days)) {
            checkInDays = days
        }
    }

    // 保存签到信息
    const now = Date.now()
    $persistentStore.write(String(now), lastCheckInKey)
    if (checkInDays !== undefined) {
        $persistentStore.write(String(checkInDays), checkInDaysKey)
    }

    console.log(`✅ V2EX 签到成功，连续签到 ${checkInDays || '未知'} 天`)
    $notification.post(
        'V2EX 签到成功',
        `连续签到 ${checkInDays || '未知'} 天`,
        '明天记得再来哦'
    )
}

// 主签到函数
function checkIn() {
    // 检查Cookie
    const cookieVal = $persistentStore.read(cookieKey)
    if (!cookieVal) {
        console.log('❌ V2EX Cookie 未找到，请先获取Cookie')
        $notification.post('V2EX 签到失败', 'Cookie 未找到', '请先获取Cookie')
        $done()
        return
    }

    // 检查是否今天已签到
    const lastCheckInTime = $persistentStore.read(lastCheckInKey)
    if (lastCheckInTime && isSameDay(Number(lastCheckInTime), Date.now())) {
        console.log('✅ V2EX 今天已经签到过了')
        $notification.post('V2EX 签到', '今天已签到', '无需重复签到')
        $done()
        return
    }

    console.log('🚀 开始执行 V2EX 签到任务')

    // 第一步：访问签到页面
    const targetUrl = `${v2exOrigin}${targetTextFragment}`
    const options = {
        url: targetUrl,
        headers: {
            'Cookie': cookieVal,
            'Referer': v2exOrigin,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        }
    }

    $httpClient.get(options, (error, response, data) => {
        if (error) {
            console.log(`❌ V2EX 签到页面访问失败: ${error}`)
            $notification.post('V2EX 签到失败', '网络请求错误', error.toString())
            $done()
            return
        }

        if (!data) {
            console.log('❌ V2EX 签到页面返回数据为空')
            $notification.post('V2EX 签到失败', '页面数据为空', '请检查网络连接')
            $done()
            return
        }

        console.log('📡 V2EX 签到页面访问成功')

        // 检查是否已经签到
        if (data.includes(successText)) {
            console.log('✅ V2EX 今日已签到')
            handleCheckedIn(data)
            $done()
            return
        }

        // 查找签到链接
        const startIndex = data.indexOf(targetTextFragment)
        if (startIndex === -1) {
            console.log('❌ V2EX 未找到签到链接，可能Cookie已失效')
            $notification.post('V2EX 签到失败', '未找到签到链接', 'Cookie可能已失效，请重新获取')
            $done()
            return
        }

        // 提取完整的签到URL
        const endIndex = data.indexOf("'", startIndex + targetTextFragment.length)
        if (endIndex === -1) {
            console.log('❌ V2EX 签到链接格式异常')
            $notification.post('V2EX 签到失败', '签到链接格式异常', '页面结构可能已变化')
            $done()
            return
        }

        const matchedString = data.slice(startIndex, endIndex)
        const checkInUrl = `${v2exOrigin}${matchedString}`

        console.log(`🔗 找到签到链接: ${checkInUrl}`)

        // 第二步：执行签到
        const checkInOptions = {
            url: checkInUrl,
            headers: {
                'Cookie': cookieVal,
                'Referer': targetUrl,
                'User-Agent': options.headers['User-Agent']
            }
        }

        $httpClient.get(checkInOptions, (checkInError, checkInResponse, checkInData) => {
            if (checkInError) {
                console.log(`❌ V2EX 签到执行失败: ${checkInError}`)
                $notification.post('V2EX 签到失败', '签到执行错误', checkInError.toString())
                $done()
                return
            }

            if (!checkInData) {
                console.log('❌ V2EX 签到返回数据为空')
                $notification.post('V2EX 签到失败', '签到返回数据为空', '请检查网络连接')
                $done()
                return
            }

            // 检查签到结果
            if (checkInData.includes(successText)) {
                handleCheckedIn(checkInData)
            } else {
                console.log('❌ V2EX 签到失败，未找到成功标识')
                console.log(`返回内容: ${checkInData.substring(0, 500)}...`)
                $notification.post('V2EX 签到失败', '签到未成功', '请查看日志获取详细信息')
            }

            $done()
        })
    })
}

// 执行签到
checkIn()